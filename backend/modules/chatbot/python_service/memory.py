import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
import logging

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/alzcare_doctor_dashboard")
_db_name = MONGODB_URI.rstrip("/").split("/")[-1].split("?")[0]

client = MongoClient(MONGODB_URI)
db = client[_db_name]
chat_histories = db["chat_histories"]

# Index on session_key for fast lookups (field stored as "session_key" in Mongo)
chat_histories.create_index("session_key")

HISTORY_WINDOW = 10       # number of exchanges (user + assistant) to keep in prompt
MAX_MSG_CHARS  = 600      # per-message character cap in prompt to control token usage


def get_memory(session_key: str, limit: int = HISTORY_WINDOW) -> list:
    """Return the last `limit` exchanges for a session."""
    doc = chat_histories.find_one({"session_key": session_key})
    if not doc:
        return []
    messages = doc.get("messages", [])
    return messages[-(limit * 2):]


def add_to_memory(session_key: str, user_msg: str, ai_msg: str) -> None:
    """Persist a new conversation exchange to MongoDB."""
    now = datetime.utcnow()
    chat_histories.update_one(
        {"session_key": session_key},
        {
            "$push": {
                "messages": {
                    "$each": [
                        {"role": "user",      "content": user_msg, "timestamp": now},
                        {"role": "assistant", "content": ai_msg,   "timestamp": now},
                    ]
                }
            },
            "$set":         {"updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    logger.debug(f"Saved exchange for session {session_key!r}")


def format_memory(session_key: str) -> str:
    """
    Format conversation history as a readable string for the LLM prompt.

    Each message is capped at MAX_MSG_CHARS characters to prevent a single
    long structured response from consuming the entire context budget.
    """
    messages = get_memory(session_key)
    if not messages:
        return "No previous conversation."

    lines = []
    for msg in messages:
        role    = "User" if msg["role"] == "user" else "Assistant"
        content = msg["content"]

        # Truncate very long messages — protects token budget
        if len(content) > MAX_MSG_CHARS:
            content = content[:MAX_MSG_CHARS] + " … [truncated for context window]"

        lines.append(f"{role}: {content}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool helpers
# ---------------------------------------------------------------------------

# L2-distance threshold for relevance filtering.
# For normalised MiniLM vectors: L2² = 2*(1 − cosine_sim).
# score < 1.20  ≈ cosine_sim > 0.28  (loosely relevant)
# score < 0.80  ≈ cosine_sim > 0.60  (highly relevant)
_RAG_SCORE_THRESHOLD = 1.20   # L2 distance upper bound (lower = more similar)
_RAG_MIN_RESULTS     = 2      # always return at least this many chunks as fallback


def knowledge_tool(vector_db, question: str, k: int = 6) -> str:
    """
    Retrieve relevant document chunks from FAISS with similarity-score filtering.

    Fetches k=6 candidates, then keeps only those whose L2 distance is below
    _RAG_SCORE_THRESHOLD (≈ cosine similarity > 0.28).  If fewer than
    _RAG_MIN_RESULTS pass the threshold, the top _RAG_MIN_RESULTS are returned
    as a fallback to guarantee non-empty RAG context.

    Returns at most 4 chunks to stay within the prompt token budget.
    """
    try:
        results = vector_db.similarity_search_with_score(question, k=k)
    except Exception:
        # Fallback if similarity_search_with_score is unavailable
        docs = vector_db.similarity_search(question, k=4)
        return "\n\n".join(d.page_content for d in docs)

    # Sort by score ascending (lower L2 = more similar)
    results.sort(key=lambda x: x[1])

    # Filter by relevance threshold, then cap at 4 for prompt budget
    relevant = [(doc, score) for doc, score in results if score < _RAG_SCORE_THRESHOLD]

    if len(relevant) < _RAG_MIN_RESULTS:
        # Fallback: return top _RAG_MIN_RESULTS regardless of score
        relevant = results[:_RAG_MIN_RESULTS]
        logger.debug(
            f"[RAG] Low-similarity fallback — top scores: "
            f"{[f'{s:.3f}' for _, s in results[:_RAG_MIN_RESULTS]]}"
        )
    else:
        relevant = relevant[:4]   # cap at 4 chunks
        logger.debug(
            f"[RAG] {len(relevant)} chunks above threshold — "
            f"scores: {[f'{s:.3f}' for _, s in relevant]}"
        )

    return "\n\n".join(doc.page_content for doc, _ in relevant)
