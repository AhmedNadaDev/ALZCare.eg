#!/usr/bin/env python3
"""
Standalone inference for the custom Mood Detection checkpoint (best.pt / last.pt).

This checkpoint is NOT a HuggingFace AutoModelForAudioClassification. It is a custom
multi-task model:  WavLM-Base-Plus backbone -> Attentive Masked Pooling -> {Mood head, Arousal head}.

The script:
  1. Inspects the checkpoint structure (metadata + state_dict shapes).
  2. Reconstructs the EXACT MultiTaskMoodModel architecture and loads the weights.
  3. Loads temperature calibration (from checkpoint, else label_mapping.json, else 1.0).
  4. Loads the label mapping + arousal mapping (from checkpoint, else label_mapping.json).
  5. Runs the same inference logic used in the notebook: softmax(logits / T), optional
     test-time augmentation (TTA) averaging, optional multi-checkpoint ensemble averaging,
     Top-K mood predictions, an abstain threshold, plus a direct Arousal-head prediction.

Backbone weights come from the checkpoint's state_dict, so the large pretrained WavLM
weights are NOT downloaded. Only a small config is needed; it is taken (in order) from
--hf-export, then the model name, then inferred from the checkpoint itself (fully offline).

Usage
-----
  # Inspect only
  python mood_inference.py --ckpt outputs/best.pt --inspect

  # Predict on one file (Top-3, with 5-view TTA, abstain below 0.5 confidence)
  python mood_inference.py --ckpt outputs/best.pt --audio clip.wav --topk 3 --tta 5 --abstain 0.5

  # Ensemble several checkpoints + a whole folder, JSON output
  python mood_inference.py --ckpt outputs/best_seed42.pt outputs/best_seed7.pt \
      --audio my_clips/ --json
"""
import os, sys, json, glob, argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

# Audio + feature extraction (lazy-imported with clear errors)
try:
    import librosa
except Exception as e:  # pragma: no cover
    librosa = None
    _LIBROSA_ERR = e

from transformers import WavLMModel, WavLMConfig

# Feature extractor: prefer AutoFeatureExtractor; fall back to a manual Wav2Vec2 one.
try:
    from transformers import AutoFeatureExtractor
except Exception:  # pragma: no cover
    AutoFeatureExtractor = None
from transformers import Wav2Vec2FeatureExtractor


# =====================================================================================
# 1. EXACT architecture (identical attribute names => state_dict keys match the notebook)
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
    """
    WavLM backbone + attentive masked pooling + a Mood head and an Arousal head.

    `backbone` is a prebuilt WavLMModel (so we can construct an empty skeleton from config
    and let the checkpoint provide the trained weights, with no weight download).
    Submodule names (backbone, pool, drop, mood_head, arousal_head) match the training code,
    so the saved state_dict loads strictly.
    """
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
# 2. Augmentation (only used for TTA views > 0; mirrors the training/eval augmentation)
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
    Y = np.fft.rfft(y); fr = np.fft.rfftfreq(len(y), 1.0 / sr)
    Y[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(Y, n=len(y)).astype(np.float32)


def _reverb(y, sr, rng):
    decay = float(rng.uniform(0.2, 0.5)); n = int(sr * decay)
    ir = np.exp(-np.linspace(0, 6, max(n, 1))).astype(np.float32); ir[0] = 1.0
    out = np.convolve(y, ir)[:len(y)]
    m = np.max(np.abs(out)) + 1e-9
    return (out / m).astype(np.float32)


def augment_waveform(y, sr, rng, scale=1.0, cfg=_AugCfg):
    if rng.random() < cfg.aug_stretch_prob * scale:
        try: y = librosa.effects.time_stretch(y, rate=float(rng.uniform(0.9, 1.1)))
        except Exception: pass
    if rng.random() < cfg.aug_pitch_prob * scale:
        try: y = librosa.effects.pitch_shift(y, sr=sr, n_steps=float(rng.uniform(-cfg.aug_pitch_max_steps, cfg.aug_pitch_max_steps)))
        except Exception: pass
    if rng.random() < cfg.aug_reverb_prob * scale:
        y = _reverb(y, sr, rng)
    if rng.random() < cfg.aug_telephony_prob * scale:
        y = _bandpass(y, sr)
    if rng.random() < cfg.aug_noise_prob * scale:
        snr = float(rng.uniform(15, 30)); sp = np.mean(y ** 2) + 1e-12; npw = sp / (10 ** (snr / 10))
        y = y + np.sqrt(npw) * rng.standard_normal(y.shape).astype(np.float32)
    if rng.random() < cfg.aug_gain_prob * scale:
        y = y * float(10 ** (rng.uniform(-6, 6) / 20))
    m = np.max(np.abs(y)) + 1e-9
    if m > 1.0:
        y = y / m
    return y.astype(np.float32)


# =====================================================================================
# Helpers
# =====================================================================================
def _torch_load(path, map_location="cpu"):
    """Load a checkpoint that contains Python metadata (needs weights_only=False on torch>=2.6)."""
    try:
        return torch.load(path, map_location=map_location, weights_only=False)
    except TypeError:
        return torch.load(path, map_location=map_location)  # older torch (no weights_only kwarg)


def _strip_module_prefix(state_dict):
    if any(k.startswith("module.") for k in state_dict):
        return {k[len("module."):] if k.startswith("module.") else k: v for k, v in state_dict.items()}
    return state_dict


def softmax_np(z):
    z = np.asarray(z, dtype=np.float64)
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)


def infer_arch_from_state_dict(sd):
    """Inspect the checkpoint and infer architecture dims (robust, offline)."""
    info = {}
    # mood head: Sequential(Linear(h,h), GELU, Dropout, Linear(h,num_moods))
    if "mood_head.0.weight" in sd:
        info["hidden_size"] = int(sd["mood_head.0.weight"].shape[1])
    if "mood_head.3.weight" in sd:
        info["num_moods"] = int(sd["mood_head.3.weight"].shape[0])
    if "arousal_head.weight" in sd:
        info["num_arousal"] = int(sd["arousal_head.weight"].shape[0])
    # backbone transformer depth
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
    """Get a WavLMConfig: prefer hf_export, then model_name, then infer from checkpoint."""
    cfg = None
    src = None
    if hf_export and Path(hf_export).exists():
        try:
            cfg = WavLMConfig.from_pretrained(hf_export); src = f"hf_export ({hf_export})"
        except Exception:
            cfg = None
    if cfg is None and model_name:
        try:
            cfg = WavLMConfig.from_pretrained(model_name); src = f"model_name ({model_name})"
        except Exception:
            cfg = None
    if cfg is None:
        cfg = WavLMConfig(); src = "inferred/default (offline)"
    # Reconcile with what the checkpoint actually contains (handles base vs large, offline).
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
    """Feature extractor: hf_export -> model_name -> manual Wav2Vec2 fallback (all offline-capable)."""
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
    fe = Wav2Vec2FeatureExtractor(feature_size=1, sampling_rate=sample_rate,
                                  padding_value=0.0, do_normalize=True, return_attention_mask=True)
    return fe, "manual Wav2Vec2FeatureExtractor (fallback)"


# =====================================================================================
# 3. The predictor
# =====================================================================================
class MoodPredictor:
    def __init__(self, ckpt_paths, hf_export=None, label_mapping=None,
                 device="auto", verbose=True):
        if librosa is None:
            raise RuntimeError(f"librosa is required for audio loading: {_LIBROSA_ERR}")
        if isinstance(ckpt_paths, (str, Path)):
            ckpt_paths = [ckpt_paths]
        self.ckpt_paths = [str(p) for p in ckpt_paths]
        self.device = torch.device(
            ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device)
        self.verbose = verbose

        # Auto-detect sibling artifacts next to the first checkpoint if not given.
        ck_dir = Path(self.ckpt_paths[0]).resolve().parent
        if hf_export is None and (ck_dir / "hf_export").exists():
            hf_export = str(ck_dir / "hf_export")
        if label_mapping is None and (ck_dir / "label_mapping.json").exists():
            label_mapping = str(ck_dir / "label_mapping.json")
        self.hf_export = hf_export
        self.mapping_file = label_mapping
        self.mapping = {}
        if label_mapping and Path(label_mapping).exists():
            with open(label_mapping) as fh:
                self.mapping = json.load(fh)

        self.models = []
        self.meta = None
        for p in self.ckpt_paths:
            m, meta = self._load_one(p)
            self.models.append(m)
            if self.meta is None:
                self.meta = meta

        # Resolve metadata (checkpoint first, then label_mapping.json, then sane defaults).
        self.sample_rate = int(self.meta.get("sample_rate") or self.mapping.get("sample_rate") or 16000)
        self.max_samples = int(self.meta.get("max_samples")
                               or self.mapping.get("max_samples")
                               or int(self.mapping.get("max_duration_sec", 6.0) * self.sample_rate))
        self.id2label = self._resolve_id2label()
        self.num_classes = len(self.id2label)
        self.mood_arousal = (self.meta.get("mood_arousal") or self.mapping.get("mood_arousal")
                             or {"Calm": "low", "Neutral": "low", "Low": "low",
                                 "Content": "high", "Anxious": "high", "Agitated": "high"})
        self.arousal2id = self.mapping.get("arousal2id", {"low": 0, "high": 1})
        self.id2arousal = {v: k for k, v in self.arousal2id.items()}
        # Temperature: checkpoint -> label_mapping.json -> 1.0
        T = self.meta.get("temperature", None)
        if T is None:
            T = self.mapping.get("temperature", 1.0)
        self.temperature = float(T) if T else 1.0

        self.feature_extractor, fe_src = build_feature_extractor(
            self.meta.get("model_name"), self.hf_export, self.sample_rate)
        if self.verbose:
            print(f"[predictor] {len(self.models)} model(s) | device={self.device} "
                  f"| sr={self.sample_rate} | max_samples={self.max_samples} "
                  f"| T={self.temperature:.3f}")
            print(f"[predictor] classes={list(self.id2label.values())}")
            print(f"[predictor] feature extractor: {fe_src}")

    # ---- loading / reconstruction --------------------------------------------------
    def _load_one(self, path):
        ck = _torch_load(path, map_location="cpu")
        if "model_state_dict" not in ck:
            # tolerate a raw state_dict checkpoint
            sd = ck if all(isinstance(v, torch.Tensor) for v in ck.values()) else None
            if sd is None:
                raise ValueError(f"{path}: no 'model_state_dict' and not a raw state_dict.")
            ck = {"model_state_dict": sd}
        sd = _strip_module_prefix(ck["model_state_dict"])
        arch = infer_arch_from_state_dict(sd)
        num_moods = ck.get("num_classes") or arch.get("num_moods")
        num_arousal = ck.get("num_arousal") or arch.get("num_arousal", 2)
        dropout = ck.get("dropout", 0.1)
        cfg, cfg_src = build_backbone_config(ck.get("model_name"), self.hf_export, arch)
        if self.verbose:
            print(f"[load] {os.path.basename(path)} | backbone config from {cfg_src} "
                  f"| hidden={cfg.hidden_size} layers={cfg.num_hidden_layers} "
                  f"| moods={num_moods} arousal={num_arousal}")
        backbone = WavLMModel(cfg)  # empty skeleton; weights come from the checkpoint
        model = MultiTaskMoodModel(backbone, num_moods, num_arousal, dropout)
        missing, unexpected = model.load_state_dict(sd, strict=False)
        # Only weights that legitimately differ (none expected) should show up here.
        crit_missing = [k for k in missing if not k.endswith("position_ids")]
        if crit_missing:
            print(f"[warn] {os.path.basename(path)}: {len(crit_missing)} missing keys "
                  f"(e.g. {crit_missing[:3]}). Architecture may not match exactly.")
        if unexpected:
            print(f"[warn] {os.path.basename(path)}: {len(unexpected)} unexpected keys "
                  f"(e.g. {unexpected[:3]}).")
        model.to(self.device).eval()
        return model, ck

    def _resolve_id2label(self):
        src = self.meta.get("id2label") or self.mapping.get("id2label")
        if src:
            return {int(k): v for k, v in src.items()}
        l2i = self.meta.get("label2id") or self.mapping.get("label2id")
        if l2i:
            return {int(v): k for k, v in l2i.items()}
        raise ValueError("No id2label/label2id in checkpoint or label_mapping.json.")

    # ---- inference -----------------------------------------------------------------
    def _featurize(self, y):
        feats = self.feature_extractor([y.astype(np.float32)], sampling_rate=self.sample_rate,
                                       return_tensors="pt", padding="longest",
                                       max_length=self.max_samples, truncation=True)
        inp = {"input_values": feats["input_values"].to(self.device)}
        if "attention_mask" in feats:
            inp["attention_mask"] = feats["attention_mask"].to(self.device)
        return inp

    @torch.no_grad()
    def _logits_one_view(self, y):
        """Average mood/arousal logits across the (optional) ensemble for a single view."""
        ml_sum = None; al_sum = None
        inp = self._featurize(y)
        for m in self.models:
            ml, al, _ = m(**inp)
            ml = ml.float().cpu().numpy()[0]; al = al.float().cpu().numpy()[0]
            ml_sum = ml if ml_sum is None else ml_sum + ml
            al_sum = al if al_sum is None else al_sum + al
        return ml_sum / len(self.models), al_sum / len(self.models)

    @torch.no_grad()
    def predict(self, audio_path, topk=3, tta=1, abstain=0.0):
        """Reproduces notebook inference: softmax(logits/T) averaged over TTA views + ensemble."""
        y0, _ = librosa.load(audio_path, sr=self.sample_rate, mono=True)
        if y0.size == 0:
            y0 = np.zeros(self.sample_rate, dtype=np.float32)
        if len(y0) > self.max_samples:
            y0 = y0[:self.max_samples]

        views = max(1, int(tta))
        mood_prob = np.zeros(self.num_classes, dtype=np.float64)
        arousal_prob = None
        for v in range(views):
            y = y0.copy()
            if v > 0:  # augmented TTA views (deterministic per view, like the notebook)
                rng = np.random.default_rng(1000 + v)
                y = augment_waveform(y, self.sample_rate, rng, 1.0)
            ml, al = self._logits_one_view(y)
            mood_prob += softmax_np(ml[None, :] / self.temperature)[0]
            ap = softmax_np(al[None, :] / self.temperature)[0]
            arousal_prob = ap if arousal_prob is None else arousal_prob + ap
        mood_prob /= views
        arousal_prob /= views

        order = mood_prob.argsort()[::-1][:max(1, topk)]
        top_mood = self.id2label[int(order[0])]
        top_conf = float(mood_prob[order[0]])
        abstained = top_conf < abstain
        ar_idx = int(np.argmax(arousal_prob))
        arousal_head_label = self.id2arousal.get(ar_idx, str(ar_idx))

        return {
            "file": str(audio_path),
            "predicted_mood": ("UNCERTAIN(abstain)" if abstained else top_mood),
            "mood_confidence": round(top_conf, 4),
            "abstained": bool(abstained),
            "topk_mood": [{"mood": self.id2label[int(i)], "prob": round(float(mood_prob[i]), 4)} for i in order],
            "arousal_head": {"label": arousal_head_label,
                             "prob": round(float(arousal_prob[ar_idx]), 4),
                             "probs": {self.id2arousal.get(j, str(j)): round(float(arousal_prob[j]), 4)
                                       for j in range(len(arousal_prob))}},
            "arousal_from_mood": self.mood_arousal.get(top_mood, "unknown"),
            "temperature": round(self.temperature, 4),
            "tta_views": views,
            "ensemble_size": len(self.models),
        }


# =====================================================================================
# Checkpoint inspection
# =====================================================================================
def inspect_checkpoint(path):
    ck = _torch_load(path, map_location="cpu")
    print("=" * 70)
    print("CHECKPOINT:", path)
    print("=" * 70)
    if "model_state_dict" not in ck and all(isinstance(v, torch.Tensor) for v in ck.values()):
        ck = {"model_state_dict": ck}
    print("Top-level keys:", sorted(ck.keys()))
    meta = {k: v for k, v in ck.items() if k != "model_state_dict"}
    for k, v in meta.items():
        s = v if not isinstance(v, dict) else {kk: meta[k][kk] for kk in list(v)[:6]}
        print(f"  [meta] {k}: {s}")
    sd = _strip_module_prefix(ck.get("model_state_dict", {}))
    groups = {}
    for k in sd:
        g = k.split(".")[0]
        groups[g] = groups.get(g, 0) + 1
    print("State-dict parameter groups (top-level module -> #tensors):")
    for g, n in sorted(groups.items()):
        print(f"  {g:18s}: {n}")
    arch = infer_arch_from_state_dict(sd)
    print("Inferred architecture from weights:", arch)
    for key in ["pool.attn.weight", "mood_head.0.weight", "mood_head.3.weight", "arousal_head.weight"]:
        if key in sd:
            print(f"  {key:24s} shape={tuple(sd[key].shape)}")
    print("=" * 70)


# =====================================================================================
# CLI
# =====================================================================================
def _gather_audio(path):
    p = Path(path)
    if p.is_dir():
        files = []
        for ext in ("*.wav", "*.WAV", "*.flac", "*.mp3", "*.ogg", "*.m4a"):
            files.extend(sorted(p.rglob(ext)))
        return [str(f) for f in files]
    return [str(p)]


def main(argv=None):
    ap = argparse.ArgumentParser(description="Inference for the custom MultiTaskMoodModel checkpoint.")
    ap.add_argument("--ckpt", nargs="+", required=True, help="One or more checkpoint paths (best.pt). Multiple => ensemble.")
    ap.add_argument("--audio", help="Audio file or directory of audio files.")
    ap.add_argument("--hf-export", dest="hf_export", default=None, help="Optional hf_export/ dir (offline config + feature extractor).")
    ap.add_argument("--label-mapping", dest="label_mapping", default=None, help="Optional label_mapping.json.")
    ap.add_argument("--topk", type=int, default=3)
    ap.add_argument("--tta", type=int, default=1, help="Test-time augmentation views (1 = no TTA).")
    ap.add_argument("--abstain", type=float, default=0.0, help="Abstain if top mood prob < this.")
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    ap.add_argument("--inspect", action="store_true", help="Print checkpoint structure (then exit unless --audio given).")
    ap.add_argument("--json", action="store_true", help="Emit results as JSON.")
    args = ap.parse_args(argv)

    if args.inspect:
        for c in args.ckpt:
            inspect_checkpoint(c)
        if not args.audio:
            return 0

    if not args.audio:
        print("No --audio given. Use --inspect to view the checkpoint, or pass --audio.")
        return 1

    predictor = MoodPredictor(args.ckpt, hf_export=args.hf_export,
                              label_mapping=args.label_mapping, device=args.device,
                              verbose=not args.json)
    results = [predictor.predict(f, topk=args.topk, tta=args.tta, abstain=args.abstain)
               for f in _gather_audio(args.audio)]

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        for r in results:
            print("-" * 60)
            print(f"file              : {r['file']}")
            print(f"predicted mood    : {r['predicted_mood']}  (conf {r['mood_confidence']})")
            print(f"top-{args.topk} moods       : " + ", ".join(f"{d['mood']}={d['prob']}" for d in r["topk_mood"]))
            print(f"arousal (head)    : {r['arousal_head']['label']} (p={r['arousal_head']['prob']}) "
                  f"probs={r['arousal_head']['probs']}")
            print(f"arousal (by mood) : {r['arousal_from_mood']}")
            print(f"temperature       : {r['temperature']} | tta={r['tta_views']} | ensemble={r['ensemble_size']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
