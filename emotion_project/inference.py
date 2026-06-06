"""
inference.py — Stateless emotion inference module.

Loads the model ONCE (lazy singleton) and exposes predict_from_audio().
Imported by main.py so the FastAPI server never re-loads weights per request.
"""

import os
import torch
import numpy as np
from collections import Counter

# Resolve paths relative to this file so the service can be started from any CWD
_HERE = os.path.dirname(os.path.abspath(__file__))

SR = 16000
LABELS = ["neutral", "happy", "sad", "angry", "fear", "disgust", "surprise", "bored"]

_model = None
_feature_extractor = None
_extract_mfcc_fn = None


def _load_model():
    """Load model + helpers once; called only by get_model()."""
    global _model, _feature_extractor, _extract_mfcc_fn

    # Import here so model.py's module-level code (downloading wav2vec2) only
    # runs when the service actually starts, not on bare import of inference.py.
    from model import EmotionModel, feature_extractor, extract_mfcc  # noqa: F401

    _feature_extractor = feature_extractor
    _extract_mfcc_fn = extract_mfcc

    model = EmotionModel().to(torch.device("cpu"))

    candidates = [
        os.path.join(_HERE, "models", "best.pt"),
        os.path.join(_HERE, "models", "last.pt"),
        os.path.join(_HERE, "models", "emotion_model.pt"),
    ]
    model_path = next((p for p in candidates if os.path.exists(p)), None)

    if model_path is None:
        raise FileNotFoundError(
            f"No model checkpoint found. Expected one of: {candidates}"
        )

    print(f"[Inference] Loading checkpoint: {model_path}")
    state = torch.load(model_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state, strict=True)
    model.eval()
    print("[Inference] Model ready.")
    _model = model


def get_model():
    """Return singleton model; load on first call."""
    if _model is None:
        _load_model()
    return _model


def predict_from_audio(audio: np.ndarray) -> dict:
    """
    Run inference on a mono float32 waveform sampled at SR=16000.

    Returns:
        {"emotion": str, "confidence": float (0-1)}
    """
    model = get_model()

    audio = np.ascontiguousarray(audio, dtype=np.float32)

    inputs = _feature_extractor(
        audio,
        sampling_rate=SR,
        return_tensors="pt",
        padding=True,
    )

    mfcc = _extract_mfcc_fn(audio, SR)
    mfcc_tensor = torch.tensor(mfcc, dtype=torch.float32).unsqueeze(0)

    with torch.inference_mode():
        out = model(inputs["input_values"], mfcc_tensor)
        # Temperature-scaled softmax (same as original app.py)
        probs = torch.softmax(out / 1.7, dim=1)[0]

    idx = torch.argmax(probs).item()
    confidence = float(probs[idx].item())

    return {
        "emotion": LABELS[idx],
        "confidence": round(confidence, 4),
        "all_scores": {
            label: round(float(probs[i].item()), 4)
            for i, label in enumerate(LABELS)
        },
    }
