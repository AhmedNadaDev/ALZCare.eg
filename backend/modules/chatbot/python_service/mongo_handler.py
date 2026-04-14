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
patients_collection = db["patients"]


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


def format_patient(patient: dict) -> str:
    """
    Render the patient document as a structured, clearly labeled record
    for the LLM prompt.

    CRITICAL: Fields marked [DB FACT] are authoritative database values.
    The LLM MUST NOT reinterpret or modify them.
    """
    if not patient:
        return "No patient data found."

    p = patient  # shorthand

    # ── Demographics ────────────────────────────────────────────────────────
    full_name = f"{_val(p, 'firstName')} {_val(p, 'lastName')}"
    dob       = _val(p, "dateOfBirth")
    age       = _val(p, "age")
    gender    = _val(p, "gender")
    pat_num   = _val(p, "patientNumber")
    status    = _val(p, "status")

    # ── CRITICAL medical facts ────────────────────────────────────────────
    alz_level      = _val(p, "alzheimerLevel")
    diagnosis_date = _val(p, "diagnosisDate")
    med_history    = _val(p, "medicalHistory")
    allergies      = _val(p, "allergies")

    # ── Contact / emergency ──────────────────────────────────────────────
    ec = p.get("emergencyContact") or {}
    emergency = (
        f"{_val(ec, 'name')} ({_val(ec, 'relationship')}) — {_val(ec, 'phone')}"
        if isinstance(ec, dict) and ec
        else _val(p, "emergencyContact")
    )

    # ── Notes ────────────────────────────────────────────────────────────
    notes = p.get("notes") or []
    notes_text = (
        "\n  ".join(
            f"[{n.get('createdAt', '')}] {n.get('content', '')}"
            for n in notes[-5:]  # last 5 notes only
        )
        if notes
        else "No notes recorded."
    )

    # ── Appointments ────────────────────────────────────────────────────
    appts = p.get("appointments") or {}
    last_checkup     = _val(appts if isinstance(appts, dict) else {}, "lastCheckup")
    next_appointment = _val(appts if isinstance(appts, dict) else {}, "nextAppointment")

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

── DIAGNOSIS (CRITICAL — DO NOT CHANGE) ──
[DB FACT] Alzheimer Level  : {alz_level}
          ↑ THIS IS THE EXACT STAGE. Report it as "{alz_level}". NEVER change it.
[DB FACT] Diagnosis Date   : {diagnosis_date}

── MEDICAL HISTORY ──
[DB FACT] Medical History  : {med_history}
[DB FACT] Allergies        : {allergies}

── APPOINTMENTS ──
[DB FACT] Last Checkup     : {last_checkup}
[DB FACT] Next Appointment : {next_appointment}

── EMERGENCY CONTACT ──
[DB FACT] Emergency Contact: {emergency}

── RECENT DOCTOR NOTES ──
  {notes_text}
"""
    return record
