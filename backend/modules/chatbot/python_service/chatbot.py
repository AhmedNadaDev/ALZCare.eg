"""
ALZCare Chatbot — Clinically-Safe Dual-Mode AI Engine
======================================================

Modes
-----
PATIENT MODE  — patient_id supplied + patient found in DB.
                All statements grounded in MongoDB data.
                LLM MUST NOT modify any DB fact.

FAMILY MODE   — same as PATIENT MODE but uses simplified,
                layperson language with compassionate tone.
                Still strictly DB-grounded.

GENERAL MODE  — no patient selected, or patient not found.
                Uses only the RAG knowledge base (PDFs + web).
                Never invents patient-specific data.

Anti-Hallucination Guarantees
------------------------------
• MongoDB is the ONLY source of truth for patient facts.
• Missing fields → explicitly reported as "Not recorded in patient file".
• Alzheimer stage, medications, diagnoses → verbatim from DB only.
• RAG knowledge enriches context but NEVER overrides DB facts.
• User claims that contradict DB facts are politely corrected.
"""
import os
import logging
from typing import Optional
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from memory import add_to_memory, format_memory, knowledge_tool
from mongo_handler import get_patient, format_patient

load_dotenv()

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
MAX_QUESTION_CHARS = 2000   # hard cap on question length to protect context budget

# ── LLM ─────────────────────────────────────────────────────────────────────
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="llama-3.3-70b-versatile",
    temperature=0,   # deterministic — no creative liberties
)

# ── Vector DB — loaded ONCE at startup, never rebuilt at runtime ─────────────
FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "faiss_index")

_embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

vector_db = None
if os.path.exists(FAISS_INDEX_PATH):
    try:
        vector_db = FAISS.load_local(
            FAISS_INDEX_PATH,
            _embeddings,
            allow_dangerous_deserialization=True,
        )
        logger.info(f"FAISS index loaded from '{FAISS_INDEX_PATH}'")
    except Exception as exc:
        logger.warning(f"Could not load FAISS index: {exc}")
else:
    logger.warning(
        f"FAISS index not found at '{FAISS_INDEX_PATH}'. "
        "Run build_vector_store.py to create it."
    )

# ── Semantic router ──────────────────────────────────────────────────────────
_embedder = SentenceTransformer("all-MiniLM-L6-v2")

_route_labels = {
    "patient": (
        "Questions about a specific patient's medical record, history, "
        "medications, appointments, mood, behaviors, or health status."
    ),
    "knowledge": (
        "General medical questions about Alzheimer's disease, dementia, symptoms, "
        "caregiving, treatments, clinical trials, safety, or prevention — "
        "not related to any specific individual."
    ),
    "hybrid": (
        "Questions that need both the specific patient's data and general medical "
        "knowledge to give a complete, useful answer."
    ),
}

_route_embeddings = {k: _embedder.encode(v) for k, v in _route_labels.items()}


def _classify_question(question: str) -> str:
    """Return 'patient', 'knowledge', or 'hybrid'."""
    q_emb = _embedder.encode([question])
    scores = {
        label: float(cosine_similarity(q_emb, [emb])[0][0])
        for label, emb in _route_embeddings.items()
    }
    best = max(scores, key=scores.get)
    confidence = scores[best]

    top2 = sorted(scores.values(), reverse=True)
    if len(top2) > 1 and (top2[0] - top2[1]) < 0.05:
        return "hybrid"

    if confidence < 0.65:
        fallback = (
            "You are a routing system. Classify into exactly one of: patient, knowledge, hybrid\n\n"
            f"Question: {question}\n\nReturn only the single word."
        )
        result = llm.invoke(fallback).content.strip().lower()
        return result if result in ("patient", "knowledge", "hybrid") else "hybrid"

    return best


# ── RAG retrieval ────────────────────────────────────────────────────────────
def _rag_context(question: str) -> str:
    if vector_db:
        return knowledge_tool(vector_db, question)
    return (
        "Medical knowledge base temporarily unavailable. "
        "Respond from established medical training, marking any uncertainty clearly."
    )


# ── PROMPT BUILDERS ──────────────────────────────────────────────────────────

_ANTI_HALLUCINATION_RULES = """
ABSOLUTE RULES — VIOLATION IS NOT PERMITTED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. GROUNDING: Every patient-specific claim MUST be traceable to the
   [DB FACT] fields in the patient record above.
   If a field says "Not recorded in patient file" → report exactly that.
   NEVER substitute your medical knowledge for missing patient data.

2. STAGE IMMUTABILITY: The Alzheimer Level field contains the ONLY valid
   stage for this patient. You MUST reproduce it verbatim.
   Example: if the record shows "early" → always write "early stage".
   NEVER write "moderate", "late", "advanced", or any other stage.

3. NO INFERENCE: Do NOT infer disease progression, likely medications,
   probable symptoms, or future prognosis beyond what the record states.

4. MISSING DATA: If any field is absent or "Not recorded in patient file",
   say exactly: "This information is not recorded in the patient's file."
   Do NOT guess, estimate, or fill in based on typical cases.

5. RAG SEPARATION: Medical knowledge from the context section enriches
   general explanations only. It MUST NOT override or contradict any
   [DB FACT] value.

6. INFERENCE LABELLING: If you must reason or estimate (e.g., about
   prognosis), clearly prefix with "Based on general knowledge (not this
   patient's record):".

7. USER CONTRADICTION OVERRIDE: If the user's question contains a claim
   about the patient that CONTRADICTS a [DB FACT] (e.g., user says "he is
   in late stage" but the record shows "early"), you MUST:
   a) Politely correct the misunderstanding.
   b) State the correct [DB FACT] value.
   c) NEVER accept the user's incorrect claim as truth.
   Example: "The patient's record shows early stage Alzheimer's, not late stage.
   You may be thinking of disease progression patterns in general."
"""

_SAFETY_DISCLAIMER = (
    "\n\n⚠️ MEDICAL DISCLAIMER: This response is AI-generated from structured patient "
    "data and medical literature. It does not replace clinical judgement. Always consult "
    "a qualified medical professional before making any clinical decision."
)


def _build_patient_prompt(
    question: str,
    history: str,
    patient_record: str,
    rag_ctx: str,
    role: str = "doctor",
    route: str = "hybrid",
) -> str:
    """
    Strict patient-grounded prompt.
    `role`  controls output style:  'doctor' = clinical,  'family' = simplified.
    `route` provides a routing hint to the LLM about where to focus.
    """
    if role == "doctor":
        audience = (
            "You are assisting a DOCTOR. Use precise clinical language. "
            "Structure your response professionally with clear clinical reasoning."
        )
    else:
        audience = (
            "You are assisting a FAMILY MEMBER caring for this patient. "
            "Use clear, compassionate, non-technical language. "
            "Avoid medical jargon — explain any necessary terms in plain English. "
            "Focus on practical care implications and actionable guidance. "
            "If the caregiver expresses fear, worry, or distress, acknowledge their "
            "feelings warmly before providing information. "
            "Never use alarming language without context and reassurance."
        )

    # Routing hint helps the LLM calibrate the balance of patient vs. general content
    if route == "knowledge":
        focus_hint = (
            "FOCUS NOTE: This is primarily a general medical knowledge question. "
            "Answer using the medical knowledge base. Reference the patient record "
            "only if it is directly relevant to personalise the answer."
        )
    elif route == "patient":
        focus_hint = (
            "FOCUS NOTE: This question is specifically about this patient's record. "
            "Ground every answer in the [DB FACT] fields. Use general knowledge only "
            "to provide clinical context around the facts."
        )
    else:  # hybrid
        focus_hint = (
            "FOCUS NOTE: This question requires both patient-specific facts and "
            "general medical knowledge. Clearly distinguish each source."
        )

    output_format = """
REQUIRED RESPONSE STRUCTURE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Patient Facts
[List ONLY facts directly from the [DB FACT] fields above, verbatim or closely paraphrased.
 For each fact, cite the field. Example: "Alzheimer Level (from record): early"
 If no patient facts are relevant to this question, write "N/A — general question".]

## Medical Context
[General medical explanation relevant to the question, sourced from the knowledge base.
 Do NOT blend this with patient-specific facts.]

## Summary
[Concise answer to the question combining the above two sections.
 Clearly distinguish between what the record shows vs. general medical knowledge.
 Any inference or estimation MUST be labelled: "Based on general knowledge (not this patient's record):"]
"""

    return f"""╔══════════════════════════════════════════════════════════════╗
║  ALZCare AI  —  MODE: PATIENT  —  ROLE: {role.upper():<18}║
╚══════════════════════════════════════════════════════════════╝
{audience}
{_ANTI_HALLUCINATION_RULES}
{focus_hint}
{output_format}
━━ CONVERSATION HISTORY ━━
{history}

━━ PATIENT RECORD (SOURCE OF TRUTH) ━━
{patient_record}

━━ MEDICAL KNOWLEDGE BASE ━━
{rag_ctx}

━━ QUESTION ━━
{question}

Answer (follow the required structure above):"""


def _build_general_prompt(question: str, history: str, rag_ctx: str) -> str:
    """General medical knowledge prompt — no patient data involved."""
    return f"""╔══════════════════════════════════════════════════════════════╗
║  ALZCare AI  —  MODE: GENERAL  —  No patient selected       ║
╚══════════════════════════════════════════════════════════════╝
You are a knowledgeable medical AI assistant specializing in Alzheimer's disease
and dementia care, answering a general medical question.

RULES:
1. Answer ONLY from the medical knowledge context provided below.
2. Be accurate, clear, and helpful.
3. Do NOT pretend you have data about any specific patient.
   NEVER invent patient records, histories, medications, or names.
4. If the knowledge base does not cover the topic, say so honestly.
   Do NOT fabricate medical information.
5. If unsure, say "I don't have enough information to answer this reliably"
   rather than guessing.
6. Do NOT give specific dosage or prescribing recommendations.
   Always direct to a qualified healthcare professional for clinical decisions.

━━ CONVERSATION HISTORY ━━
{history}

━━ MEDICAL KNOWLEDGE BASE ━━
{rag_ctx}

━━ QUESTION ━━
{question}

Answer:"""


# ── MAIN FUNCTION ────────────────────────────────────────────────────────────

def answer(
    question: str,
    patient_id: Optional[str] = None,
    session_id: str = "general",
    user_role: str = "doctor",
) -> dict:
    """
    Generate a clinically-safe, hallucination-resistant response.

    Parameters
    ----------
    question   : User's question.
    patient_id : MongoDB ObjectId. None → GENERAL MODE.
    session_id : Memory key when no patient is selected.
    user_role  : 'doctor' | 'family' — controls output style in patient mode.

    Returns
    -------
    dict: { answer, mode }
    """
    # ── Question length guard ────────────────────────────────────────────────
    if len(question) > MAX_QUESTION_CHARS:
        logger.warning(
            f"Question truncated from {len(question)} to {MAX_QUESTION_CHARS} chars"
        )
        question = question[:MAX_QUESTION_CHARS] + " … [question truncated]"

    # ── Memory key — composite to isolate per-user conversations ────────────
    # Using session_id + patient_id prevents two doctors' conversations about
    # the same patient from bleeding into each other's context.
    if patient_id:
        memory_key = f"{session_id}_{patient_id}"
    else:
        memory_key = session_id

    history = format_memory(memory_key)
    rag_ctx = _rag_context(question)

    mode   = "general"
    prompt = None

    # ── PATIENT / FAMILY MODE ────────────────────────────────────────────────
    if patient_id:
        patient      = get_patient(patient_id)
        patient_data = format_patient(patient) if patient else None

        if patient_data and "No patient data found" not in patient_data:
            route = _classify_question(question)
            logger.info(f"[PATIENT MODE] route={route}  patient={patient_id}  role={user_role}")

            # All routes use the patient prompt; the `route` hint adjusts focus
            prompt = _build_patient_prompt(
                question, history, patient_data, rag_ctx,
                role=user_role, route=route,
            )

            mode = "patient" if user_role == "doctor" else "family"

        else:
            logger.warning(
                f"Patient {patient_id!r} not found in DB — falling back to GENERAL MODE."
            )
            patient_id = None  # trigger general mode below

    # ── GENERAL MODE ────────────────────────────────────────────────────────
    if not patient_id:
        logger.info(f"[GENERAL MODE]  session={session_id}")
        prompt = _build_general_prompt(question, history, rag_ctx)
        mode   = "general"

    response_text = llm.invoke(prompt).content

    # Append safety disclaimer to ALL responses (patient, family, general)
    if "MEDICAL DISCLAIMER" not in response_text:
        response_text += _SAFETY_DISCLAIMER

    add_to_memory(memory_key, question, response_text)
    logger.info(f"[{mode.upper()} MODE] response generated")

    return {"answer": response_text, "mode": mode}
