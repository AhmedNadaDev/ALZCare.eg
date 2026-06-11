"""
mood_model.py — Exact architecture of the custom multi-task Mood Detection model.

This MUST mirror the training code attribute names (backbone, pool, drop, mood_head,
arousal_head) so the saved state_dict loads strictly. The model is:

    WavLM-Base-Plus backbone -> Attentive Masked Pooling -> {Mood head, Arousal head}

Backbone weights come from the checkpoint's state_dict, so the large pretrained WavLM
weights are NOT downloaded — only a small config is needed (taken from hf_export, then
the model name, then inferred from the checkpoint itself, fully offline).

Adapted from the project's standalone mood_inference.py so server-side inference is
byte-for-byte identical to the reference implementation.
"""
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from transformers import WavLMModel, WavLMConfig

try:
    from transformers import AutoFeatureExtractor
except Exception:  # pragma: no cover
    AutoFeatureExtractor = None
from transformers import Wav2Vec2FeatureExtractor


# =====================================================================================
# Architecture (identical attribute names => state_dict keys match the training code)
# =====================================================================================
class AttentiveMaskedPool(nn.Module):
    """Attention-weighted temporal pooling over (B, T, H) with a frame mask (B, T)."""

    def __init__(self, dim):
        super().__init__()
        self.attn = nn.Linear(dim, 1)

    def forward(self, h, mask):
        s = self.attn(h).squeeze(-1)
        s = s.masked_fill(mask == 0, float("-inf"))
        w = torch.softmax(s, dim=1).unsqueeze(-1)
        return (h * w).sum(1)


class MultiTaskMoodModel(nn.Module):
    """WavLM backbone + attentive masked pooling + a Mood head and an Arousal head."""

    def __init__(self, backbone, num_moods, num_arousal=2, dropout=0.1):
        super().__init__()
        self.backbone = backbone
        h = self.backbone.config.hidden_size
        self.pool = AttentiveMaskedPool(h)
        self.drop = nn.Dropout(dropout)
        self.mood_head = nn.Sequential(
            nn.Linear(h, h), nn.GELU(), nn.Dropout(dropout), nn.Linear(h, num_moods)
        )
        self.arousal_head = nn.Linear(h, num_arousal)

    def _feat_mask(self, attn, T, device):
        if attn is None:
            return torch.ones(1, T, device=device)
        try:
            lengths = self.backbone._get_feat_extract_output_lengths(attn.sum(-1)).long()
        except Exception:
            return torch.ones(attn.size(0), T, device=device)
        idx = torch.arange(T, device=device)[None, :]
        return (idx < lengths[:, None]).long()

    def forward(self, input_values, attention_mask=None):
        out = self.backbone(input_values, attention_mask=attention_mask)
        h = out.last_hidden_state
        m = self._feat_mask(attention_mask, h.size(1), h.device)
        if m.size(0) == 1 and h.size(0) > 1:
            m = m.expand(h.size(0), -1)
        pooled = self.drop(self.pool(h, m))
        return self.mood_head(pooled), self.arousal_head(pooled), pooled


# =====================================================================================
# Augmentation (only used for TTA views > 0; mirrors the training/eval augmentation)
# =====================================================================================
class _AugCfg:
    aug_stretch_prob = 0.3
    aug_pitch_prob = 0.3
    aug_pitch_max_steps = 2.0
    aug_reverb_prob = 0.2
    aug_telephony_prob = 0.25
    aug_noise_prob = 0.5
    aug_gain_prob = 0.5


def _bandpass(y, sr, lo=300, hi=3400):
    Y = np.fft.rfft(y)
    fr = np.fft.rfftfreq(len(y), 1.0 / sr)
    Y[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(Y, n=len(y)).astype(np.float32)


def _reverb(y, sr, rng):
    decay = float(rng.uniform(0.2, 0.5))
    n = int(sr * decay)
    ir = np.exp(-np.linspace(0, 6, max(n, 1))).astype(np.float32)
    ir[0] = 1.0
    out = np.convolve(y, ir)[: len(y)]
    m = np.max(np.abs(out)) + 1e-9
    return (out / m).astype(np.float32)


def augment_waveform(y, sr, rng, scale=1.0, cfg=_AugCfg, librosa=None):
    if librosa is not None:
        if rng.random() < cfg.aug_stretch_prob * scale:
            try:
                y = librosa.effects.time_stretch(y, rate=float(rng.uniform(0.9, 1.1)))
            except Exception:
                pass
        if rng.random() < cfg.aug_pitch_prob * scale:
            try:
                y = librosa.effects.pitch_shift(
                    y, sr=sr, n_steps=float(rng.uniform(-cfg.aug_pitch_max_steps, cfg.aug_pitch_max_steps))
                )
            except Exception:
                pass
    if rng.random() < cfg.aug_reverb_prob * scale:
        y = _reverb(y, sr, rng)
    if rng.random() < cfg.aug_telephony_prob * scale:
        y = _bandpass(y, sr)
    if rng.random() < cfg.aug_noise_prob * scale:
        snr = float(rng.uniform(15, 30))
        sp = np.mean(y ** 2) + 1e-12
        npw = sp / (10 ** (snr / 10))
        y = y + np.sqrt(npw) * rng.standard_normal(y.shape).astype(np.float32)
    if rng.random() < cfg.aug_gain_prob * scale:
        y = y * float(10 ** (rng.uniform(-6, 6) / 20))
    m = np.max(np.abs(y)) + 1e-9
    if m > 1.0:
        y = y / m
    return y.astype(np.float32)


# =====================================================================================
# Checkpoint / config helpers
# =====================================================================================
def torch_load(path, map_location="cpu"):
    """Load a checkpoint that contains Python metadata (needs weights_only=False on torch>=2.6)."""
    try:
        return torch.load(path, map_location=map_location, weights_only=False)
    except TypeError:
        return torch.load(path, map_location=map_location)


def strip_module_prefix(state_dict):
    if any(k.startswith("module.") for k in state_dict):
        return {k[len("module."):] if k.startswith("module.") else k: v for k, v in state_dict.items()}
    return state_dict


def softmax_np(z):
    z = np.asarray(z, dtype=np.float64)
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def infer_arch_from_state_dict(sd):
    info = {}
    if "mood_head.0.weight" in sd:
        info["hidden_size"] = int(sd["mood_head.0.weight"].shape[1])
    if "mood_head.3.weight" in sd:
        info["num_moods"] = int(sd["mood_head.3.weight"].shape[0])
    if "arousal_head.weight" in sd:
        info["num_arousal"] = int(sd["arousal_head.weight"].shape[0])
    layer_ids = set()
    for k in sd:
        if k.startswith("backbone.encoder.layers."):
            try:
                layer_ids.add(int(k.split("backbone.encoder.layers.")[1].split(".")[0]))
            except Exception:
                pass
    if layer_ids:
        info["num_hidden_layers"] = max(layer_ids) + 1
    ff = "backbone.encoder.layers.0.feed_forward.intermediate_dense.weight"
    if ff in sd:
        info["intermediate_size"] = int(sd[ff].shape[0])
    return info


def build_backbone_config(model_name, hf_export, arch_info):
    cfg, src = None, None
    if hf_export and Path(hf_export).exists():
        try:
            cfg = WavLMConfig.from_pretrained(hf_export)
            src = f"hf_export ({hf_export})"
        except Exception:
            cfg = None
    if cfg is None and model_name:
        try:
            cfg = WavLMConfig.from_pretrained(model_name)
            src = f"model_name ({model_name})"
        except Exception:
            cfg = None
    if cfg is None:
        cfg = WavLMConfig()
        src = "inferred/default (offline)"
    h = arch_info.get("hidden_size")
    if h and getattr(cfg, "hidden_size", None) != h:
        cfg.hidden_size = h
        cfg.num_attention_heads = max(1, h // 64)
    if arch_info.get("num_hidden_layers"):
        cfg.num_hidden_layers = arch_info["num_hidden_layers"]
    if arch_info.get("intermediate_size"):
        cfg.intermediate_size = arch_info["intermediate_size"]
    return cfg, src


def build_feature_extractor(model_name, hf_export, sample_rate):
    if hf_export and Path(hf_export).exists() and AutoFeatureExtractor is not None:
        try:
            return AutoFeatureExtractor.from_pretrained(hf_export), f"hf_export ({hf_export})"
        except Exception:
            pass
    if model_name and AutoFeatureExtractor is not None:
        try:
            return AutoFeatureExtractor.from_pretrained(model_name), f"model_name ({model_name})"
        except Exception:
            pass
    fe = Wav2Vec2FeatureExtractor(
        feature_size=1, sampling_rate=sample_rate, padding_value=0.0,
        do_normalize=True, return_attention_mask=True,
    )
    return fe, "manual Wav2Vec2FeatureExtractor (fallback)"
