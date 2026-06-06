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
import re
import json as _json

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
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Voice-Intent Schemas ──────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    text:        str
    context:     Optional[str] = "medication"   # wake_up | medication | appointment | custom
    event_title: Optional[str] = None           # full event title for richer context


class AnalyzeResponse(BaseModel):
    intent:          Literal["confirm_taken", "deny_taken", "forgot", "feeling_bad", "confused"]
    confidence:      float
    action:          Literal["mark_completed", "mark_missed", "alert_family", "ask_again"]
    reasoning:       str = ""
    decision_source: str = "ai_model"


# ── Chat Schemas ──────────────────────────────────────────────────────────────

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


# ── Voice-Intent Analysis ─────────────────────────────────────────────────────

_GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ── Context-specific guidance injected into the AI prompt per event type ──────
_CONTEXT_GUIDANCE = {
    "medication": (
        "The patient was asked whether they took their medication.\n"
        "CONFIRM signals: 'yes', 'took it', 'done', 'already', 'swallowed', 'drank it', 'had it'.\n"
        "DENY signals: 'no', 'didn\\'t', 'haven\\'t', 'not yet', 'skip', 'refused'.\n"
        "FORGOT signals: 'forgot', 'don\\'t remember', 'slipped my mind'.\n"
        "HEALTH signals: side effects, nausea, dizziness, pain, feeling unwell."
    ),
    "wake_up": (
        "The patient was asked whether they woke up and got out of bed.\n"
        "CONFIRM signals: 'yes', 'awake', 'up', 'woke', 'I\\'m here', 'good morning', 'ready'.\n"
        "DENY signals: 'no', 'still in bed', 'not yet', 'five more minutes', 'sleeping'.\n"
        "HEALTH signals: dizzy when standing, fell, pain, trouble getting up, feels weak."
    ),
    "appointment": (
        "The patient was asked about their appointment readiness.\n"
        "CONFIRM signals: 'ready', 'yes', 'ok', 'I\\'m prepared', 'dressed', 'waiting'.\n"
        "DENY signals: 'no', 'not ready', 'can\\'t make it', 'too tired', 'need more time'.\n"
        "HEALTH signals: too sick to go, pain, not feeling well enough to attend."
    ),
    "custom": (
        "The patient was asked about completing a scheduled activity.\n"
        "Look for general affirmative (yes, done, ok, sure, finished) or negative (no, haven\\'t, not yet) responses."
    ),
}

_INTENT_SYSTEM_PROMPT_TEMPLATE = """\
You are a clinical AI assistant embedded in an Alzheimer's patient monitoring system.

TASK: Classify the patient's spoken response to a scheduled health check-in.

EVENT TYPE: {context}
EVENT: "{event_title}"

CONTEXT-SPECIFIC GUIDANCE:
{context_guidance}

INTENT TAXONOMY (choose exactly one):
  confirm_taken  → mark_completed   Patient clearly confirms they completed the activity.
  deny_taken     → mark_missed      Patient clearly states they did NOT complete it.
  forgot         → mark_missed      Patient says they forgot or cannot remember.
  feeling_bad    → alert_family     Patient mentions ANY physical discomfort, pain, illness, or emergency.
  confused       → ask_again        Patient is confused, doesn't understand, or utterance is unclear.

PRIORITY RULES (apply strictly):
  1. feeling_bad ALWAYS wins if any health keyword is present — even alongside other signals.
  2. deny_taken > forgot > confirm_taken when signals conflict.
  3. NEVER return "unknown"; map uncertainty to "confused".
  4. Prefer mark_missed over ask_again for determinism when possible.

CONFIDENCE GUIDELINES:
  0.90–1.00 — crystal clear, single unambiguous signal
  0.75–0.89 — clear, maybe slight ambiguity
  0.60–0.74 — recognizable pattern but somewhat ambiguous
  0.45–0.59 — weak signal, best available interpretation
  < 0.45    — still return best intent; use "confused" when truly unclear

OUTPUT FORMAT — return ONLY this JSON object, no markdown, no explanation:
{{"intent": "...", "confidence": 0.00, "action": "...", "reasoning": "one concise sentence"}}
"""


def _preprocess_text(text: str) -> str:
    """Normalise patient speech: strip fillers, collapse whitespace, lower-case."""
    fillers = r'\b(um|uh|hmm|err|well|like|i mean|you know|so|just|actually|basically|honestly|literally)\b'
    cleaned = re.sub(fillers, ' ', text.lower().strip(), flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', cleaned).strip()


def _rule_based_fallback(text: str, context: str) -> AnalyzeResponse:
    """
    Minimal Python-side rule engine used ONLY when the LLM is completely unavailable.
    Mirrors the Node.js logic so the system degrades gracefully.
    """
    t = text.lower()

    # Health signals — highest priority
    if re.search(r'\b(sick|pain|hurts|dizzy|tired|nausea|fell|bleed|help|emergency|not well|terrible|awful)\b', t):
        return AnalyzeResponse(intent="feeling_bad",   confidence=0.70, action="alert_family",   reasoning="Fallback rule: health keyword detected",  decision_source="rule_engine")
    if re.search(r'\b(forgot|forget|don\'t remember|can\'t remember)\b', t):
        return AnalyzeResponse(intent="forgot",        confidence=0.72, action="mark_missed",    reasoning="Fallback rule: forgot keyword",            decision_source="rule_engine")
    if re.search(r'\b(no|nope|didn\'t|did not|haven\'t|not yet|skip)\b', t):
        return AnalyzeResponse(intent="deny_taken",    confidence=0.74, action="mark_missed",    reasoning="Fallback rule: denial keyword",            decision_source="rule_engine")
    if re.search(r'\b(yes|yeah|took|taken|done|did|already|ok|okay|sure)\b', t):
        return AnalyzeResponse(intent="confirm_taken", confidence=0.70, action="mark_completed", reasoning="Fallback rule: confirmation keyword",       decision_source="rule_engine")
    if re.search(r'\b(what|huh|confused|don\'t understand|pardon)\b', t):
        return AnalyzeResponse(intent="confused",      confidence=0.60, action="ask_again",      reasoning="Fallback rule: confusion keyword",         decision_source="rule_engine")

    # No direct signal — still deterministic: map to confused (never unknown)
    return AnalyzeResponse(intent="confused", confidence=0.30, action="ask_again", reasoning="Fallback rule: no recognizable signal", decision_source="rule_engine")


def _analyze_with_llm(text: str, context: str, event_title: str = "") -> AnalyzeResponse:
    """
    Call Groq LLaMA-3 8B to classify patient intent.
    Always returns a valid AnalyzeResponse — never raises.
    """
    preprocessed = _preprocess_text(text)
    context_key  = context if context in _CONTEXT_GUIDANCE else "custom"
    system_prompt = _INTENT_SYSTEM_PROMPT_TEMPLATE.format(
        context=context_key,
        event_title=event_title or context_key,
        context_guidance=_CONTEXT_GUIDANCE[context_key],
    )

    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage, HumanMessage

        if not _GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY not configured")

        llm = ChatGroq(
            api_key=_GROQ_API_KEY,
            model="llama3-8b-8192",
            temperature=0.05,   # near-deterministic for clinical decisions
            max_tokens=200,
        )

        user_msg = f'Patient said: "{preprocessed}"'
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_msg),
        ])

        raw = response.content.strip()
        logger.debug(f"[analyze] LLM raw response: {raw[:300]}")

        # Extract JSON — handle markdown code fences and stray text
        json_match = re.search(r'\{[^{}]+\}', raw, re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON object found in LLM response: {raw[:200]}")

        data = _json.loads(json_match.group())

        # Validate required fields with safe defaults
        intent     = data.get("intent",     "confused")
        confidence = float(data.get("confidence", 0.5))
        action     = data.get("action",     "ask_again")
        reasoning  = str(data.get("reasoning", "AI classification"))

        # Clamp confidence to [0.0, 1.0]
        confidence = max(0.0, min(1.0, confidence))

        # Validate enums — fall back gracefully if LLM hallucinated
        valid_intents = {"confirm_taken", "deny_taken", "forgot", "feeling_bad", "confused"}
        valid_actions = {"mark_completed", "mark_missed", "alert_family", "ask_again"}

        if intent not in valid_intents:
            logger.warning(f"[analyze] LLM returned invalid intent '{intent}' — mapping to confused")
            intent, action, confidence = "confused", "ask_again", min(confidence, 0.35)

        if action not in valid_actions:
            logger.warning(f"[analyze] LLM returned invalid action '{action}' — mapping to ask_again")
            action = "ask_again"

        # Enforce intent ↔ action consistency
        INTENT_ACTION_MAP = {
            "confirm_taken": "mark_completed",
            "deny_taken":    "mark_missed",
            "forgot":        "mark_missed",
            "feeling_bad":   "alert_family",
            "confused":      "ask_again",
        }
        expected_action = INTENT_ACTION_MAP.get(intent)
        if expected_action and action != expected_action:
            logger.warning(
                f"[analyze] Intent/action mismatch: intent={intent} action={action} "
                f"→ correcting to {expected_action}"
            )
            action = expected_action

        return AnalyzeResponse(
            intent=intent,
            confidence=confidence,
            action=action,
            reasoning=reasoning,
            decision_source="ai_model",
        )

    except Exception as exc:
        logger.warning(f"[analyze] LLM pipeline failed ({type(exc).__name__}: {exc}) — using rule fallback")
        return _rule_based_fallback(preprocessed, context)


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_intent(request: AnalyzeRequest):
    """
    Analyze a patient's voice response and return a structured intent classification.
    Called by the Node.js daily-plan service as the AI layer in the hybrid pipeline.

    Always returns a valid, deterministic response — never raises 5xx for ML failures.
    """
    text = (request.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text cannot be empty")

    context     = request.context     or "medication"
    event_title = request.event_title or ""

    logger.info(f"[analyze] context={context!r}  event={event_title!r}  text={text!r}")

    result = _analyze_with_llm(text, context, event_title)

    logger.info(
        f"[analyze] → intent={result.intent}  confidence={result.confidence:.2f}  "
        f"action={result.action}  source={result.decision_source}  reason={result.reasoning!r}"
    )
    return result


@app.post("/chat/ask", response_model=ChatResponse)
def ask_question(request: ChatRequest):
    question_stripped = (request.question or "").strip()
    if not question_stripped:
        raise HTTPException(status_code=400, detail="question cannot be empty")
    if len(question_stripped) > 4000:
        raise HTTPException(
            status_code=400,
            detail="Question is too long (max 4000 characters). Please shorten your query.",
        )

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
