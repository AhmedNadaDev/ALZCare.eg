"""
predictor.py — Lazy-singleton loader + inference for the MultiTaskMoodModel.

Loads the checkpoint(s) ONCE (singleton) and exposes:
    get_predictor()                         -> MoodPredictor (built on first call)
    MoodPredictor.predict_array(y)          -> structured dict for an in-memory waveform

Inference reproduces the reference notebook / mood_inference.py exactly:
    softmax(logits / T) averaged over (optional) TTA views and (optional) ensemble.

Defaults are tuned for production: a single checkpoint, no TTA (tta=1), CPU-safe.
"""
import json
import os
from pathlib import Path

import numpy as np
import torch

from mood_model import (
    MultiTaskMoodModel,
    WavLMModel,
    augment_waveform,
    build_backbone_config,
    build_feature_extractor,
    infer_arch_from_state_dict,
    softmax_np,
    strip_module_prefix,
    torch_load,
)

try:
    import librosa
except Exception as e:  # pragma: no cover
    librosa = None
    _LIBROSA_ERR = e

# ── Configuration (env-overridable) ──────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get("MOOD_MODEL_DIR", str(_HERE / "models")))
# Comma-separated checkpoint filenames (relative to MODEL_DIR) — multiple = ensemble.
CKPTS = [c.strip() for c in os.environ.get("MOOD_CKPTS", "best.pt").split(",") if c.strip()]
DEVICE = os.environ.get("MOOD_DEVICE", "auto")

# Keep CPU inference responsive without starving the rest of the box.
try:
    torch.set_num_threads(int(os.environ.get("MOOD_TORCH_THREADS", str(max(1, (os.cpu_count() or 4) // 2)))))
except Exception:
    pass


class MoodPredictor:
    def __init__(self, ckpt_paths, hf_export=None, label_mapping=None, device="auto", verbose=True):
        if librosa is None:
            raise RuntimeError(f"librosa is required for audio loading: {_LIBROSA_ERR}")
        self.ckpt_paths = [str(p) for p in ckpt_paths]
        self.device = torch.device(
            ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device
        )
        self.verbose = verbose

        ck_dir = Path(self.ckpt_paths[0]).resolve().parent
        if hf_export is None and (ck_dir / "hf_export").exists():
            hf_export = str(ck_dir / "hf_export")
        if label_mapping is None and (ck_dir / "label_mapping.json").exists():
            label_mapping = str(ck_dir / "label_mapping.json")
        self.hf_export = hf_export
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

        self.sample_rate = int(self.meta.get("sample_rate") or self.mapping.get("sample_rate") or 16000)
        self.max_samples = int(
            self.meta.get("max_samples")
            or self.mapping.get("max_samples")
            or int(self.mapping.get("max_duration_sec", 6.0) * self.sample_rate)
        )
        self.id2label = self._resolve_id2label()
        self.num_classes = len(self.id2label)
        self.mood_arousal = (
            self.meta.get("mood_arousal")
            or self.mapping.get("mood_arousal")
            or {"Calm": "low", "Neutral": "low", "Low": "low",
                "Content": "high", "Anxious": "high", "Agitated": "high"}
        )
        self.arousal2id = self.mapping.get("arousal2id", {"low": 0, "high": 1})
        self.id2arousal = {v: k for k, v in self.arousal2id.items()}
        T = self.meta.get("temperature", None)
        if T is None:
            T = self.mapping.get("temperature", 1.0)
        self.temperature = float(T) if T else 1.0

        self.feature_extractor, fe_src = build_feature_extractor(
            self.meta.get("model_name"), self.hf_export, self.sample_rate
        )
        if self.verbose:
            print(f"[predictor] {len(self.models)} model(s) | device={self.device} | sr={self.sample_rate} "
                  f"| max_samples={self.max_samples} | T={self.temperature:.3f}")
            print(f"[predictor] classes={list(self.id2label.values())}")
            print(f"[predictor] feature extractor: {fe_src}")

    # ── loading / reconstruction ────────────────────────────────────────────
    def _load_one(self, path):
        ck = torch_load(path, map_location="cpu")
        if "model_state_dict" not in ck:
            sd = ck if all(isinstance(v, torch.Tensor) for v in ck.values()) else None
            if sd is None:
                raise ValueError(f"{path}: no 'model_state_dict' and not a raw state_dict.")
            ck = {"model_state_dict": sd}
        sd = strip_module_prefix(ck["model_state_dict"])
        arch = infer_arch_from_state_dict(sd)
        num_moods = ck.get("num_classes") or arch.get("num_moods")
        num_arousal = ck.get("num_arousal") or arch.get("num_arousal", 2)
        dropout = ck.get("dropout", 0.1)
        cfg, cfg_src = build_backbone_config(ck.get("model_name"), self.hf_export, arch)
        if self.verbose:
            print(f"[load] {os.path.basename(path)} | backbone from {cfg_src} | hidden={cfg.hidden_size} "
                  f"layers={cfg.num_hidden_layers} | moods={num_moods} arousal={num_arousal}")
        backbone = WavLMModel(cfg)
        model = MultiTaskMoodModel(backbone, num_moods, num_arousal, dropout)
        missing, unexpected = model.load_state_dict(sd, strict=False)
        crit_missing = [k for k in missing if not k.endswith("position_ids")]
        if crit_missing:
            print(f"[warn] {os.path.basename(path)}: {len(crit_missing)} missing keys (e.g. {crit_missing[:3]}).")
        if unexpected:
            print(f"[warn] {os.path.basename(path)}: {len(unexpected)} unexpected keys (e.g. {unexpected[:3]}).")
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

    # ── inference ───────────────────────────────────────────────────────────
    def _featurize(self, y):
        feats = self.feature_extractor(
            [y.astype(np.float32)], sampling_rate=self.sample_rate, return_tensors="pt",
            padding="longest", max_length=self.max_samples, truncation=True,
        )
        inp = {"input_values": feats["input_values"].to(self.device)}
        if "attention_mask" in feats:
            inp["attention_mask"] = feats["attention_mask"].to(self.device)
        return inp

    @torch.no_grad()
    def _logits_one_view(self, y):
        ml_sum = al_sum = None
        inp = self._featurize(y)
        for m in self.models:
            ml, al, _ = m(**inp)
            ml = ml.float().cpu().numpy()[0]
            al = al.float().cpu().numpy()[0]
            ml_sum = ml if ml_sum is None else ml_sum + ml
            al_sum = al if al_sum is None else al_sum + al
        return ml_sum / len(self.models), al_sum / len(self.models)

    @torch.no_grad()
    def predict_array(self, y, topk=3, tta=1, abstain=0.0):
        """Run inference on an already-decoded mono waveform at self.sample_rate."""
        y0 = np.asarray(y, dtype=np.float32)
        if y0.size == 0:
            y0 = np.zeros(self.sample_rate, dtype=np.float32)
        if len(y0) > self.max_samples:
            y0 = y0[: self.max_samples]

        views = max(1, int(tta))
        mood_prob = np.zeros(self.num_classes, dtype=np.float64)
        arousal_prob = None
        for v in range(views):
            yv = y0.copy()
            if v > 0:
                rng = np.random.default_rng(1000 + v)
                yv = augment_waveform(yv, self.sample_rate, rng, 1.0, librosa=librosa)
            ml, al = self._logits_one_view(yv)
            mood_prob += softmax_np(ml[None, :] / self.temperature)[0]
            ap = softmax_np(al[None, :] / self.temperature)[0]
            arousal_prob = ap if arousal_prob is None else arousal_prob + ap
        mood_prob /= views
        arousal_prob /= views

        order = mood_prob.argsort()[::-1][: max(1, topk)]
        top_mood = self.id2label[int(order[0])]
        top_conf = float(mood_prob[order[0]])
        abstained = top_conf < abstain
        ar_idx = int(np.argmax(arousal_prob))
        arousal_label = self.id2arousal.get(ar_idx, str(ar_idx))

        return {
            "mood": top_mood,
            "moodConfidence": round(top_conf, 4),
            "abstained": bool(abstained),
            "moodScores": {self.id2label[i]: round(float(mood_prob[i]), 4) for i in range(self.num_classes)},
            "topk": [{"mood": self.id2label[int(i)], "prob": round(float(mood_prob[i]), 4)} for i in order],
            "arousal": arousal_label,
            "arousalConfidence": round(float(arousal_prob[ar_idx]), 4),
            "arousalScores": {self.id2arousal.get(j, str(j)): round(float(arousal_prob[j]), 4)
                              for j in range(len(arousal_prob))},
            "arousalFromMood": self.mood_arousal.get(top_mood, "unknown"),
            "temperature": round(self.temperature, 4),
            "ttaViews": views,
            "ensembleSize": len(self.models),
        }


# ── Lazy singleton ───────────────────────────────────────────────────────────
_predictor = None


def get_predictor():
    global _predictor
    if _predictor is None:
        ckpts = [str(MODEL_DIR / c) for c in CKPTS]
        _predictor = MoodPredictor(ckpts, device=DEVICE, verbose=True)
    return _predictor
