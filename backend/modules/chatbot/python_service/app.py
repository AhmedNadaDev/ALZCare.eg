"""
ALZCare Chatbot Python Service
Entry point — run with: uvicorn app:app --host 0.0.0.0 --port 8000
"""
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal

from chatbot import answer

app = FastAPI(
    title="ALZCare Chatbot Service",
    version="3.0.0",
    description=(
        "Clinically-safe dual-mode AI assistant. "
        "PATIENT/FAMILY MODE when patient_id is supplied (DB-grounded, anti-hallucination). "
        "GENERAL MODE otherwise (RAG knowledge base only)."
    ),
)

_allowed_origins = [
    os.getenv("NODE_SERVICE_ORIGIN", "http://localhost:5001"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question:   str
    patient_id: Optional[str]                           = None
    session_id: Optional[str]                           = None
    user_role:  Optional[Literal["doctor", "family"]]   = "doctor"


class ChatResponse(BaseModel):
    answer:   str
    mode:     str                  # "patient" | "family" | "general"
    sources:  Optional[list]       = None
    metadata: Optional[dict]       = None


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ALZCare Chatbot v3 (anti-hallucination)"}


@app.post("/chat/ask", response_model=ChatResponse)
def ask_question(request: ChatRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty")

    session_id = request.session_id or "general"
    user_role  = request.user_role  or "doctor"

    try:
        logger.info(
            f"Request — patient={request.patient_id!r}  "
            f"role={user_role!r}  session={session_id!r}"
        )
        result = answer(
            question   = request.question.strip(),
            patient_id = request.patient_id or None,
            session_id = session_id,
            user_role  = user_role,
        )
        return ChatResponse(
            answer   = result["answer"],
            mode     = result["mode"],
            metadata = {
                "patient_id": request.patient_id,
                "session_id": session_id,
                "mode":       result["mode"],
                "user_role":  user_role,
            },
        )
    except Exception as exc:
        logger.error(f"Error generating answer: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating a response. Please try again.",
        )
