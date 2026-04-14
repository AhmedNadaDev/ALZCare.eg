import base64
import io
import os
import time
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import onnxruntime as ort
import torch
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from facenet_pytorch import InceptionResnetV1
from insightface.app import FaceAnalysis
from PIL import Image

# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent
MODELS_DIR = ROOT_DIR / ".models"
MODELS_DIR.mkdir(exist_ok=True)

SUPPORTED_MODELS = {
    "buffalo_l": {"type": "arcface", "embedding_dim": 512},
    "facenet": {"type": "facenet", "embedding_dim": 512, "pretrained": "casia-webface"},
    "vggface2": {"type": "facenet", "embedding_dim": 512, "pretrained": "vggface2"},
}

DEFAULT_MODELS = list(SUPPORTED_MODELS.keys())

# Try GPU for heavy models when available
HAS_CUDA = torch.cuda.is_available()
TORCH_DEVICE = torch.device("cuda" if HAS_CUDA else "cpu")
ONNX_PROVIDERS = ["CPUExecutionProvider"]

app = FastAPI(title="Face Embedding Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Utilities
# ---------------------------------------------------------
def l2_normalize(vec: np.ndarray) -> np.ndarray:
    if vec.size == 0:
        raise ValueError("Empty embedding cannot be normalized")
    flattened = vec.flatten()
    norm = np.linalg.norm(flattened)
    if norm == 0.0:
        raise ValueError("Embedding has zero norm, cannot normalize")
    return flattened / norm


def to_rgb_image(data: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(data)).convert("RGB")
    return np.array(image)


def crop_face(image: np.ndarray, bbox: np.ndarray, target_size: Tuple[int, int]) -> Image.Image:
    x1, y1, x2, y2 = bbox.astype(int)
    h, w, _ = image.shape
    # Add a small margin to better include full face
    margin_x = int((x2 - x1) * 0.05)
    margin_y = int((y2 - y1) * 0.05)
    x1 = max(0, x1 - margin_x)
    y1 = max(0, y1 - margin_y)
    x2 = min(w, x2 + margin_x)
    y2 = min(h, y2 + margin_y)
    face = image[y1:y2, x1:x2]
    if face.size == 0:
        raise ValueError("Invalid crop size (empty face)")
    pil_face = Image.fromarray(face).resize(target_size)
    return pil_face


def download_file(url: str, dest: Path) -> Path:
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return dest
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return dest


# ---------------------------------------------------------
# Model loaders
# ---------------------------------------------------------
face_detector: FaceAnalysis = None
arcface_app: FaceAnalysis = None
facenet_model: InceptionResnetV1 = None
vggface2_model: InceptionResnetV1 = None


def prepare_models():
    global face_detector, arcface_app, facenet_model, vggface2_model

    ctx_id = 0 if HAS_CUDA else -1
    face_detector = FaceAnalysis(name="buffalo_l")
    face_detector.prepare(ctx_id=ctx_id, det_size=(640, 640))

    # ArcFace embeddings via the same app
    arcface_app = face_detector

    # FaceNet (casia-webface)
    facenet_model = (
        InceptionResnetV1(pretrained="casia-webface")
        .eval()
        .to(TORCH_DEVICE)
    )

    # VGGFace2 (still Facenet architecture, different weights)
    vggface2_model = (
        InceptionResnetV1(pretrained="vggface2")
        .eval()
        .to(TORCH_DEVICE)
    )

# ---------------------------------------------------------
# Embedding helpers
# ---------------------------------------------------------
def encode_arcface(face) -> np.ndarray:
    emb = face.embedding.astype(np.float32)
    return l2_normalize(emb)


def encode_facenet(image: np.ndarray, bbox: np.ndarray, model: InceptionResnetV1) -> np.ndarray:
    face_img = crop_face(image, bbox, (160, 160))
    tensor = (
        torch.from_numpy(np.asarray(face_img))
        .float()
        .permute(2, 0, 1)
        / 255.0
    )
    tensor = (tensor - 0.5) / 0.5  # normalize to [-1, 1]
    tensor = tensor.unsqueeze(0).to(TORCH_DEVICE)
    with torch.inference_mode():
        emb = model(tensor).cpu().numpy()[0]
    return l2_normalize(emb)


def extract_embeddings_from_image(
    image_bytes: bytes, requested_models: List[str]
) -> Dict[str, List[Dict]]:
    image = to_rgb_image(image_bytes)
    faces = face_detector.get(image)
    if not faces:
        return {model: [] for model in requested_models}

    faces_by_model: Dict[str, List[Dict]] = {m: [] for m in requested_models}

    for face in faces:
        bbox = face.bbox.astype(int)
        for model in requested_models:
            start = time.perf_counter()
            try:
                if model == "buffalo_l":
                    embedding = encode_arcface(face)
                elif model == "facenet":
                    embedding = encode_facenet(image, bbox, facenet_model)
                elif model == "vggface2":
                    embedding = encode_facenet(image, bbox, vggface2_model)
                else:
                    raise ValueError(f"Unsupported model {model}")
            except Exception as exc:  # pylint: disable=broad-except
                # Skip this model for this face but continue
                print(f"[WARN] Failed to encode model={model}: {exc}")
                continue

            duration_ms = (time.perf_counter() - start) * 1000
            faces_by_model[model].append(
                {
                    "bbox": bbox.tolist(),
                    "embedding": embedding.tolist(),
                    "embedding_dim": embedding.shape[0],
                    "model": model,
                    "inference_ms": round(duration_ms, 2),
                }
            )

    return faces_by_model


def parse_model_names(model_name: str | None) -> List[str]:
    if not model_name or model_name.lower() in ("all", "auto"):
        return DEFAULT_MODELS
    selected = [m.strip().lower() for m in model_name.split(",") if m.strip()]
    invalid = [m for m in selected if m not in SUPPORTED_MODELS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported model(s): {', '.join(invalid)}. Supported: {', '.join(SUPPORTED_MODELS.keys())}",
        )
    return selected


# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------
@app.on_event("startup")
async def _startup():
    prepare_models()
    print(
        f"[ML] Models ready. CUDA: {HAS_CUDA}. Providers: {ONNX_PROVIDERS}. Supported: {', '.join(DEFAULT_MODELS)}"
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ml-service",
        "models": DEFAULT_MODELS,
        "cuda": HAS_CUDA,
        "torch_device": str(TORCH_DEVICE),
        "onnx_providers": ONNX_PROVIDERS,
    }


@app.post("/embed")
async def embed(model_name: str = "all", files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    requested_models = parse_model_names(model_name)
    aggregated = {m: [] for m in requested_models}

    for idx, file in enumerate(files):
        try:
            data = await file.read()
            if len(data) == 0:
                raise HTTPException(
                    status_code=400, detail=f"File {idx + 1} is empty"
                )
            faces = extract_embeddings_from_image(data, requested_models)
            for key, items in faces.items():
                aggregated[key].extend(items)
        except HTTPException:
            raise
        except Exception as exc:  # pylint: disable=broad-except
            raise HTTPException(
                status_code=400,
                detail=f"Failed to process file {idx + 1}: {str(exc)}",
            ) from exc

    if all(len(v) == 0 for v in aggregated.values()):
        raise HTTPException(status_code=400, detail="No faces detected in any uploaded images")

    return {"faces": aggregated, "models": requested_models}


@app.post("/embed/base64")
async def embed_base64(payload: dict):
    image_b64 = payload.get("image")
    model_name = payload.get("model_name", "all")
    if not image_b64:
        raise HTTPException(status_code=400, detail="image (base64) is required")

    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]

    try:
        data = base64.b64decode(image_b64)
        if len(data) == 0:
            raise HTTPException(status_code=400, detail="Decoded image data is empty")
    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=400, detail="Invalid base64 image") from exc

    requested_models = parse_model_names(model_name)
    faces = extract_embeddings_from_image(data, requested_models)

    if all(len(v) == 0 for v in faces.values()):
        raise HTTPException(status_code=400, detail="No faces detected in the provided image")

    return {"faces": faces, "models": requested_models}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
