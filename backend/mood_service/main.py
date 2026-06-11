"""
main.py — ALZCare Mood Detection FastAPI microservice (WavLM multi-task).

This is the Python inference sidecar for the Node/Express backend. The backend
(backend/modules/aiMood/moodInference.service.js) calls it over HTTP on localhost.

Start:
    cd backend/mood_service
    uvicorn main:app --host 0.0.0.0 --port 8001
(or use:  python main.py)

POST /mood/analyze
    Body  : multipart/form-data { audio: <file>, tta?: int, topk?: int, abstain?: float }
    Return: {
        mood, moodConfidence, moodScores, topk,
        arousal, arousalConfidence, arousalScores, arousalFromMood,
        abstained, temperature, ttaViews, ensembleSize, note?, durationSec
    }

The model analyses *acoustic* speech patterns (prosody, energy, timbre) — NOT the
meaning of the words. Outputs are probabilistic estimates, not diagnoses.

ffmpeg is NOT required: the frontend sends 16 kHz PCM WAV, decoded here by
soundfile/librosa natively. WebM/OGG would need ffmpeg (graceful error if absent).
"""
import logging
import os
import sys
import tempfile
import time

import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Make relative imports work regardless of CWD.
_HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(_HERE)
sys.path.insert(0, _HERE)

import librosa  # noqa: E402
from predictor import get_predictor  # noqa: E402

# Defaults (env-overridable).
DEFAULT_TTA = int(os.environ.get("MOOD_DEFAULT_TTA", "1"))        # 1 = no TTA (fast)
DEFAULT_TOPK = int(os.environ.get("MOOD_DEFAULT_TOPK", "3"))
DEFAULT_ABSTAIN = float(os.environ.get("MOOD_DEFAULT_ABSTAIN", "0.0"))
SR = 16000

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("mood-api")

app = FastAPI(
    title="ALZCare Mood Detection (WavLM)",
    version="3.0.0",
    description="WavLM multi-task mood + arousal estimation — clinical decision-support prototype.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("[MoodAPI] Warming up WavLM mood model…")
    t0 = time.time()
    try:
        get_predictor()
        logger.info(f"[MoodAPI] Model ready in {time.time() - t0:.1f}s")
    except Exception as exc:  # don't crash; surface via /health
        logger.error(f"[MoodAPI] STARTUP ERROR — model failed to load: {exc}")


@app.get("/health")
async def health():
    import predictor as _p
    loaded = _p._predictor is not None
    info = {}
    if loaded:
        p = _p._predictor
        info = {"classes": list(p.id2label.values()), "temperature": p.temperature,
                "ensemble": len(p.models), "sample_rate": p.sample_rate}
    return {"status": "ok" if loaded else "degraded", "model_loaded": loaded,
            "service": "alzcare-mood-detection", "sr": SR, **info}


def _load_audio(content: bytes, suffix: str) -> np.ndarray:
    """Decode bytes to a 16 kHz mono float32 waveform (librosa -> soundfile fallback)."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            audio, _ = librosa.load(tmp_path, sr=SR, mono=True)
            return audio.astype(np.float32)
        except Exception as librosa_err:
            try:
                import soundfile as sf
                raw, sr_raw = sf.read(tmp_path, always_2d=False)
                if raw.ndim > 1:
                    raw = raw.mean(axis=1)
                if sr_raw != SR:
                    raw = librosa.resample(raw.astype(np.float32), orig_sr=sr_raw, target_sr=SR)
                return raw.astype(np.float32)
            except Exception as sf_err:
                raise ValueError(
                    f"Could not decode audio ({suffix}). librosa: {type(librosa_err).__name__}: {librosa_err}. "
                    f"soundfile: {type(sf_err).__name__}: {sf_err}. The browser should send audio/wav (PCM); "
                    "WebM/OGG decoding requires ffmpeg on the server."
                ) from sf_err
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/mood/analyze")
async def analyze_mood(
    audio: UploadFile = File(...),
    tta: int = Form(DEFAULT_TTA),
    topk: int = Form(DEFAULT_TOPK),
    abstain: float = Form(DEFAULT_ABSTAIN),
):
    t_start = time.time()
    content = await audio.read()
    filename = audio.filename or "audio.wav"
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file received.")

    suffix = os.path.splitext(filename)[1].lower()
    if not suffix:
        ct = (audio.content_type or "").lower()
        suffix = ".wav" if "wav" in ct else (".ogg" if "ogg" in ct else (".mp4" if "mp4" in ct else ".webm"))

    logger.info(f"[MoodAPI] analyze: file='{filename}' type='{audio.content_type}' size={len(content)}B suffix={suffix}")

    try:
        y = _load_audio(content, suffix)
    except ValueError as ve:
        logger.error(f"[MoodAPI] decode error: {ve}")
        raise HTTPException(status_code=422, detail=str(ve))

    duration_s = len(y) / SR
    rms = float(np.sqrt(np.mean(y ** 2))) if y.size else 0.0
    logger.info(f"[MoodAPI] decoded: dur={duration_s:.2f}s samples={len(y)} rms={rms:.6f}")

    # Quality gates — return a safe, low-confidence Neutral/low result with a note.
    note = None
    if rms < 0.001:
        note = "silence_detected"
    elif duration_s < 0.5:
        note = "audio_too_short"

    if note:
        logger.warning(f"[MoodAPI] quality gate: {note}")
        p = get_predictor()
        zero = {k: 0.0 for k in p.id2label.values()}
        return {
            "mood": "Neutral", "moodConfidence": 0.0, "moodScores": {**zero, "Neutral": 1.0},
            "topk": [{"mood": "Neutral", "prob": 1.0}],
            "arousal": "low", "arousalConfidence": 0.0, "arousalScores": {"low": 1.0, "high": 0.0},
            "arousalFromMood": "low", "abstained": True,
            "temperature": p.temperature, "ttaViews": 0, "ensembleSize": len(p.models),
            "note": note, "durationSec": round(duration_s, 2),
        }

    # Peak-normalise to [-1, 1].
    peak = float(np.max(np.abs(y)))
    if peak > 0:
        y = y / (peak + 1e-8)

    try:
        p = get_predictor()
        result = p.predict_array(y, topk=topk, tta=tta, abstain=abstain)
    except Exception as exc:
        logger.error(f"[MoodAPI] inference error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Model inference error: {exc}")

    result["note"] = None
    result["durationSec"] = round(duration_s, 2)
    total_ms = int((time.time() - t_start) * 1000)
    logger.info(f"[MoodAPI] done in {total_ms}ms: mood={result['mood']} ({result['moodConfidence']}) "
                f"arousal={result['arousal']} ({result['arousalConfidence']})")
    return result


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("MOOD_SERVICE_PORT", "8001")),
                log_level="info", reload=False)
