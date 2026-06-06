"""
main.py — ALZCare Emotion Analysis FastAPI microservice.

Start:
    cd emotion_project
    uvicorn main:app --host 0.0.0.0 --port 8001

POST /emotion/analyze
    Body : multipart/form-data { audio: <file> }
    Return: { emotion, confidence, all_scores, note? }

Debug tracing:
    Every stage prints to stdout with [EmotionAPI] prefix so you can follow
    the pipeline in the uvicorn log without ambiguity.
"""

import io
import logging
import os
import sys
import tempfile
import time

import librosa
import numpy as np
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# ── Make sure relative imports (model.py, inference.py) work regardless of CWD ──
_HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(_HERE)
sys.path.insert(0, _HERE)

from inference import SR, predict_from_audio  # noqa: E402

# ── Configure logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("emotion-api")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ALZCare Emotion Analysis",
    version="2.0.0",
    description="Wav2Vec2 + MFCC emotion detection — production debug build",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup: warm up model ────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("[EmotionAPI] Warming up emotion model…")
    t0 = time.time()
    try:
        from inference import get_model
        get_model()
        logger.info(f"[EmotionAPI] Model ready in {time.time() - t0:.1f}s")
    except Exception as exc:
        logger.error(f"[EmotionAPI] STARTUP ERROR — model failed to load: {exc}")
        # Don't crash the server; report the error on the /health endpoint instead


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    from inference import _model  # module-level singleton
    model_loaded = _model is not None
    logger.info(f"[EmotionAPI] /health  model_loaded={model_loaded}")
    return {
        "status": "ok" if model_loaded else "degraded",
        "model_loaded": model_loaded,
        "service": "alzcare-emotion-analysis",
        "sr": SR,
    }


# ── Audio loading helper ──────────────────────────────────────────────────────
def _load_audio(content: bytes, suffix: str) -> np.ndarray:
    """
    Write bytes to a temp file and load with librosa at 16 kHz mono.
    Tries librosa first; falls back to soundfile for plain WAV if librosa
    fails (e.g. ffmpeg not installed for WebM).

    Raises ValueError with a clear message if loading fails entirely.
    """
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        logger.info(f"[EmotionAPI] Temp file: {tmp_path}  ({len(content)} bytes)")

        # ── Strategy ──────────────────────────────────────────────────────────
        # 1. Try librosa.load first — handles everything IF ffmpeg is on PATH.
        # 2. If librosa fails (most likely: ffmpeg absent for WebM/OGG/MP4),
        #    fall back to soundfile which reads WAV/FLAC/AIFF natively.
        # 3. If the frontend sends WAV (our preferred path), soundfile succeeds
        #    immediately and ffmpeg is never needed.
        try:
            audio, sr_actual = librosa.load(tmp_path, sr=SR, mono=True)
            logger.info(
                f"[EmotionAPI] librosa.load OK: shape={audio.shape} "
                f"sr={sr_actual} duration={len(audio)/SR:.2f}s"
            )
            return audio
        except Exception as librosa_err:
            err_type = type(librosa_err).__name__
            err_msg  = str(librosa_err) or "(no message)"
            logger.warning(
                f"[EmotionAPI] librosa.load failed "
                f"({err_type}: {err_msg}). Trying soundfile…"
            )
            # soundfile reads WAV/FLAC/AIFF without ffmpeg
            try:
                import soundfile as sf
                audio_raw, sr_raw = sf.read(tmp_path, always_2d=False)
                if audio_raw.ndim > 1:
                    audio_raw = audio_raw.mean(axis=1)      # stereo → mono
                if sr_raw != SR:
                    audio_raw = librosa.resample(
                        audio_raw.astype(np.float32),
                        orig_sr=sr_raw, target_sr=SR,
                    )
                logger.info(
                    f"[EmotionAPI] soundfile OK: shape={audio_raw.shape} "
                    f"orig_sr={sr_raw} → {SR}Hz"
                )
                return audio_raw.astype(np.float32)
            except Exception as sf_err:
                sf_type = type(sf_err).__name__
                raise ValueError(
                    f"Could not decode audio ({suffix}). "
                    f"librosa: {err_type}: {err_msg}. "
                    f"soundfile: {sf_type}: {sf_err}. "
                    "SOLUTION: the browser should send audio/wav (PCM), not WebM/OGG. "
                    "Check the frontend WAV conversion step. "
                    "If you need WebM support on the server, install ffmpeg: "
                    "https://ffmpeg.org/download.html"
                ) from sf_err
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Main inference endpoint ───────────────────────────────────────────────────
@app.post("/emotion/analyze")
async def analyze_emotion(audio: UploadFile = File(...)):
    """
    Accept an audio file and return the detected emotion.

    Logs every stage so failures are easy to trace:
      [EmotionAPI] STEP 1 — file metadata
      [EmotionAPI] STEP 2 — file loaded into array
      [EmotionAPI] STEP 3 — silence check
      [EmotionAPI] STEP 4 — model inference
      [EmotionAPI] STEP 5 — returning result
    """
    t_start = time.time()

    # ── STEP 1: File metadata ──────────────────────────────────────────────
    content = await audio.read()
    filename = audio.filename or "audio.webm"
    content_type = audio.content_type or "audio/webm"

    logger.info(
        f"[EmotionAPI] STEP 1 — received: filename='{filename}' "
        f"content_type='{content_type}' size={len(content)}B"
    )

    if not content:
        logger.error("[EmotionAPI] STEP 1 ERROR — empty file content")
        raise HTTPException(status_code=400, detail="Empty audio file received.")

    # Derive file extension
    suffix = os.path.splitext(filename)[1].lower()
    if not suffix:
        if "ogg" in content_type:
            suffix = ".ogg"
        elif "mp4" in content_type or "aac" in content_type:
            suffix = ".mp4"
        elif "wav" in content_type:
            suffix = ".wav"
        else:
            suffix = ".webm"
        logger.info(f"[EmotionAPI] STEP 1 — no extension in filename; guessed '{suffix}' from MIME")

    # ── STEP 2: Decode audio ───────────────────────────────────────────────
    logger.info(f"[EmotionAPI] STEP 2 — decoding audio (suffix={suffix})…")
    try:
        audio_array = _load_audio(content, suffix)
    except ValueError as ve:
        logger.error(f"[EmotionAPI] STEP 2 ERROR: {ve}")
        raise HTTPException(status_code=422, detail=str(ve))

    # ── STEP 3: Silence / quality check ───────────────────────────────────
    duration_s = len(audio_array) / SR
    rms = float(np.sqrt(np.mean(audio_array ** 2)))  # RMS is better than mean(abs)
    logger.info(
        f"[EmotionAPI] STEP 3 — audio stats: duration={duration_s:.2f}s  "
        f"samples={len(audio_array)}  RMS={rms:.6f}  max={float(np.max(np.abs(audio_array))):.4f}"
    )

    if rms < 0.001:
        logger.warning("[EmotionAPI] STEP 3 — SILENCE DETECTED (RMS < 0.001)")
        return {
            "emotion": "neutral",
            "confidence": 0.0,
            "all_scores": {},
            "note": "silence_detected",
        }

    if duration_s < 0.5:
        logger.warning(f"[EmotionAPI] STEP 3 — Audio too short ({duration_s:.2f}s < 0.5s)")
        return {
            "emotion": "neutral",
            "confidence": 0.0,
            "all_scores": {},
            "note": "audio_too_short",
        }

    # Normalise amplitude
    peak = float(np.max(np.abs(audio_array)))
    audio_array = audio_array / (peak + 1e-8)
    logger.info(f"[EmotionAPI] STEP 3 — normalised (peak was {peak:.4f})")

    # ── STEP 4: Model inference ────────────────────────────────────────────
    logger.info("[EmotionAPI] STEP 4 — running model inference…")
    t_inf = time.time()
    try:
        result = predict_from_audio(audio_array)
    except Exception as exc:
        logger.error(f"[EmotionAPI] STEP 4 ERROR — inference failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Model inference error: {exc}")

    inf_ms = int((time.time() - t_inf) * 1000)
    logger.info(
        f"[EmotionAPI] STEP 4 — inference done in {inf_ms}ms: "
        f"emotion='{result['emotion']}' confidence={result['confidence']:.4f}"
    )

    # ── STEP 5: Return ─────────────────────────────────────────────────────
    total_ms = int((time.time() - t_start) * 1000)
    logger.info(f"[EmotionAPI] STEP 5 — returning result (total {total_ms}ms)")

    return {
        "emotion":     result["emotion"],
        "confidence":  result["confidence"],
        "all_scores":  result.get("all_scores", {}),
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        log_level="info",
        reload=False,
    )
