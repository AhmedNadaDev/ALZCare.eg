import os
import logging
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/alzcare_doctor_dashboard")
_db_name = MONGODB_URI.rstrip("/").split("/")[-1].split("?")[0]

client = MongoClient(MONGODB_URI)
db = client[_db_name]
patients_collection    = db["patients"]
medications_collection = db["medications"]
moods_collection       = db["moods"]


def get_patient(patient_id: str):
    """Fetch patient by MongoDB ObjectId or patientNumber."""
    patient = None

    if ObjectId.is_valid(patient_id):
        patient = patients_collection.find_one({"_id": ObjectId(patient_id)})

    if not patient:
        patient = patients_collection.find_one({"patientNumber": patient_id})

    if not patient:
        logger.warning(f"Patient not found: {patient_id}")
        return None

    # Stringify all ObjectId fields
    patient["_id"] = str(patient["_id"])
    if patient.get("doctor"):
        patient["doctor"] = str(patient["doctor"])
    if patient.get("family"):
        patient["family"] = (
            [str(f) for f in patient["family"]]
            if isinstance(patient["family"], list)
            else str(patient["family"])
        )

    return patient


def get_patient_medications(patient_id: str) -> list:
    """Fetch active medications for a patient from the medications collection."""
    try:
        obj_id = ObjectId(patient_id) if ObjectId.is_valid(patient_id) else None
        if not obj_id:
            return []
        meds = list(
            medications_collection.find(
                {"patient": obj_id, "isActive": True},
                {"name": 1, "genericName": 1, "type": 1, "strength": 1,
                 "instructions": 1, "purpose": 1, "sideEffects": 1,
                 "startDate": 1, "endDate": 1, "notes": 1, "_id": 0},
            ).limit(20)
        )
        return meds
    except Exception as exc:
        logger.warning(f"Could not fetch medications for patient {patient_id}: {exc}")
        return []


def get_patient_recent_moods(patient_id: str, limit: int = 3) -> list:
    """Fetch the most recent mood entries for a patient."""
    try:
        obj_id = ObjectId(patient_id) if ObjectId.is_valid(patient_id) else None
        if not obj_id:
            return []
        moods = list(
            moods_collection.find(
                {"patient": obj_id},
                {"mood": 1, "moodScore": 1, "energy": 1, "behaviors": 1,
                 "physicalSymptoms": 1, "cognitiveState": 1, "sleep": 1,
                 "appetite": 1, "notes": 1, "recordedAt": 1, "isAbnormal": 1, "_id": 0},
            )
            .sort("recordedAt", -1)
            .limit(limit)
        )
        return moods
    except Exception as exc:
        logger.warning(f"Could not fetch moods for patient {patient_id}: {exc}")
        return []


def _val(patient: dict, *keys, default: str = "Not recorded in patient file") -> str:
    """Safe nested getter that returns a clear 'not recorded' string instead of None."""
    for key in keys:
        if isinstance(patient, dict):
            patient = patient.get(key)
        else:
            return default
    if patient is None or patient == "" or patient == []:
        return default
    if isinstance(patient, list):
        return ", ".join(str(x) for x in patient)
    return str(patient)


def _format_medications(meds: list) -> str:
    """Render active medications as a structured text block."""
    if not meds:
        return "  No active medications recorded."
    lines = []
    for m in meds:
        name     = m.get("name", "Unknown")
        generic  = m.get("genericName", "")
        strength = m.get("strength", "")
        med_type = m.get("type", "")
        purpose  = m.get("purpose", "")
        instruct = m.get("instructions", "")
        side_fx  = ", ".join(m.get("sideEffects", [])) or "None recorded"

        label = name
        if generic and generic != name:
            label += f" ({generic})"
        if strength:
            label += f" {strength}"
        if med_type:
            label += f" [{med_type}]"

        line = f"  • {label}"
        if purpose:
            line += f"\n    Purpose: {purpose}"
        if instruct:
            line += f"\n    Instructions: {instruct}"
        line += f"\n    Side effects on file: {side_fx}"
        lines.append(line)
    return "\n".join(lines)


def _format_moods(moods: list) -> str:
    """Render recent mood entries as a structured text block."""
    if not moods:
        return "  No mood records found."
    lines = []
    for m in moods:
        date     = str(m.get("recordedAt", "Unknown date"))[:10]
        mood     = m.get("mood", "unknown").replace("_", " ")
        score    = m.get("moodScore", "N/A")
        energy   = m.get("energy", "unknown").replace("_", " ")
        appetite = m.get("appetite", "unknown")
        behaviors = [b.replace("_", " ") for b in m.get("behaviors", []) if b != "none"]
        symptoms  = [s.replace("_", " ") for s in m.get("physicalSymptoms", []) if s != "none"]
        cog       = m.get("cognitiveState", {})
        clarity   = cog.get("clarity", "").replace("_", " ") if isinstance(cog, dict) else ""
        abnormal  = " ⚠️ ABNORMAL" if m.get("isAbnormal") else ""
        notes     = m.get("notes", "")

        line = f"  [{date}] Mood: {mood} (score {score}/10), Energy: {energy}{abnormal}"
        if clarity:
            line += f", Cognitive clarity: {clarity}"
        if behaviors:
            line += f"\n    Behaviors observed: {', '.join(behaviors)}"
        if symptoms:
            line += f"\n    Physical symptoms: {', '.join(symptoms)}"
        if appetite and appetite != "normal":
            line += f"\n    Appetite: {appetite}"
        if notes:
            line += f"\n    Notes: {notes[:200]}"
        lines.append(line)
    return "\n".join(lines)


def format_patient(patient: dict) -> str:
    """
    Render the patient document as a structured, clearly labeled record
    for the LLM prompt.  Medications and recent mood data are fetched from
    their respective collections and included.

    CRITICAL: Fields marked [DB FACT] are authoritative database values.
    The LLM MUST NOT reinterpret or modify them.
    """
    if not patient:
        return "No patient data found."

    p = patient  # shorthand
    patient_obj_id = p.get("_id", "")

    # ── Demographics ────────────────────────────────────────────────────────
    full_name = f"{_val(p, 'firstName')} {_val(p, 'lastName')}"
    dob       = _val(p, "dateOfBirth")
    age       = _val(p, "age")
    gender    = _val(p, "gender")
    pat_num   = _val(p, "patientNumber")
    status    = _val(p, "status")
    desc      = _val(p, "description")

    # ── CRITICAL medical facts ────────────────────────────────────────────
    alz_level      = _val(p, "alzheimerLevel")
    diagnosis_date = _val(p, "diagnosisDate")
    med_history    = _val(p, "medicalHistory")
    allergies      = _val(p, "allergies")

    # ── Appointments — top-level fields in the Patient schema ─────────────
    # FIX: These are top-level Patient fields, NOT nested under 'appointments'
    last_checkup     = _val(p, "lastCheckup")
    next_appointment = _val(p, "nextAppointment")

    # ── Contact / emergency ──────────────────────────────────────────────
    ec = p.get("emergencyContact") or {}
    emergency = (
        f"{_val(ec, 'name')} ({_val(ec, 'relationship')}) — {_val(ec, 'phone')}"
        if isinstance(ec, dict) and ec
        else _val(p, "emergencyContact")
    )

    # ── Notes (from doctor) ───────────────────────────────────────────────
    notes = p.get("notes") or []
    notes_text = (
        "\n  ".join(
            f"[{n.get('createdAt', '')}] {n.get('content', '')}"
            for n in notes[-5:]  # last 5 notes only
        )
        if notes
        else "No notes recorded."
    )

    # ── Active medications (separate collection) ──────────────────────────
    meds = get_patient_medications(patient_obj_id) if patient_obj_id else []
    meds_text = _format_medications(meds)

    # ── Recent mood entries (separate collection) ──────────────────────────
    recent_moods = get_patient_recent_moods(patient_obj_id) if patient_obj_id else []
    moods_text = _format_moods(recent_moods)

    record = f"""╔══════════════════════════════════════════════════════════════╗
║         AUTHORITATIVE PATIENT MEDICAL RECORD               ║
║  All values below come DIRECTLY from the medical database. ║
║  Report them EXACTLY as shown — do NOT modify or infer.    ║
╚══════════════════════════════════════════════════════════════╝

[DB FACT] Patient Number   : {pat_num}
[DB FACT] Full Name        : {full_name}
[DB FACT] Date of Birth    : {dob}
[DB FACT] Age              : {age}
[DB FACT] Gender           : {gender}
[DB FACT] Status           : {status}
[DB FACT] Description      : {desc}

── DIAGNOSIS (CRITICAL — DO NOT CHANGE) ──
[DB FACT] Alzheimer Level  : {alz_level}
          ↑ THIS IS THE EXACT STAGE. Report it as "{alz_level}". NEVER change it.
[DB FACT] Diagnosis Date   : {diagnosis_date}

── MEDICAL HISTORY & ALLERGIES ──
[DB FACT] Medical History  : {med_history}
[DB FACT] Allergies        : {allergies}

── ACTIVE MEDICATIONS (from prescriptions database) ──
{meds_text}

── RECENT MOOD & BEHAVIOR (last 3 recorded entries) ──
{moods_text}

── APPOINTMENTS ──
[DB FACT] Last Checkup     : {last_checkup}
[DB FACT] Next Appointment : {next_appointment}

── EMERGENCY CONTACT ──
[DB FACT] Emergency Contact: {emergency}

── RECENT DOCTOR NOTES ──
  {notes_text}
"""
    return record
