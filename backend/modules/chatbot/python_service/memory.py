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

HISTORY_WINDOW = 10  # number of exchanges (user + assistant) to keep in prompt


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
                        {"role": "user", "content": user_msg, "timestamp": now},
                        {"role": "assistant", "content": ai_msg, "timestamp": now},
                    ]
                }
            },
            "$set": {"updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    logger.debug(f"Saved exchange for session {session_key!r}")


def format_memory(session_key: str) -> str:
    """Format conversation history as a readable string for the LLM prompt."""
    messages = get_memory(session_key)
    if not messages:
        return "No previous conversation."

    lines = []
    for msg in messages:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool helpers
# ---------------------------------------------------------------------------

def knowledge_tool(vector_db, question: str) -> str:
    docs = vector_db.similarity_search(question, k=4)
    return "\n\n".join(d.page_content for d in docs)
