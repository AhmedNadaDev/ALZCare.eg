# RAG Chatbot System — Complete Architectural Audit

**Project:** ALZCare (Graduation_1_Update) — Alzheimer's patient monitoring platform
**Scope:** The dual-mode RAG chatbot used by the **Doctor Portal** and the **Family Portal**
**Audit type:** Read-only reverse-engineering & documentation. **No code was modified.**
**Date:** 2026-06-08

> This document is intended to be self-sufficient: a new senior engineer should be able to
> understand the entire RAG chatbot without reading the source. File paths are linked where useful.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Folder & File Structure](#3-folder--file-structure)
4. [File-by-File Analysis](#4-file-by-file-analysis)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [RAG Pipeline Deep Dive](#6-rag-pipeline-deep-dive)
7. [Doctor Chatbot Analysis](#7-doctor-chatbot-analysis)
8. [Family Chatbot Analysis](#8-family-chatbot-analysis)
9. [Database Analysis](#9-database-analysis)
10. [External Services](#10-external-services)
11. [Environment Variables](#11-environment-variables)
12. [Risks & Weaknesses](#12-risks--weaknesses)
13. [Complete Dependency Mapping](#13-complete-dependency-mapping)

---

## 1. Executive Summary

The ALZCare chatbot is a **dual-mode, clinically-safe AI assistant** built on a **Retrieval-Augmented
Generation (RAG)** architecture. It serves **two portals from a single shared codepath**:

- **Doctor Portal Chatbot** — clinical tone, full access to any patient under the doctor's care.
- **Family Portal Chatbot** — compassionate/layperson tone, access restricted to the single linked patient.

Both portals call the **same backend endpoint** (`POST /api/chatbot/ask`) and the **same Python AI
engine**. The only behavioral differences are driven by a `user_role` flag (`doctor` vs `family`) and by
the access-control checks in the Node controller. **There is no separate "doctor RAG" and "family RAG"** —
it is one engine with role-conditional prompt styling and authorization.

### Three operating modes

| Mode | Trigger | Knowledge source | Tone |
|------|---------|------------------|------|
| **PATIENT** | `patient_id` supplied + role `doctor` + patient found | MongoDB patient record (source of truth) **+** RAG knowledge base | Clinical |
| **FAMILY** | `patient_id` supplied + role `family` + patient found | Same as PATIENT | Compassionate / plain English |
| **GENERAL** | No `patient_id` (or patient not found) | RAG knowledge base only | Knowledgeable assistant |

### Technology stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite), fetch API |
| API gateway | Node.js / Express (port **5001**) |
| AI engine | Python / FastAPI (port **8000**) via `uvicorn` |
| LLM | **Groq** — `llama-3.3-70b-versatile` (chat), `llama3-8b-8192` (voice intent) |
| Embeddings | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` (local, 384-dim) |
| Vector store | **FAISS** (local, file-based, prebuilt) |
| Semantic router | `SentenceTransformer` + scikit-learn cosine similarity |
| Conversation memory | MongoDB collection `chat_histories` |
| Patient data | MongoDB (`patients`, `medications`, `moods` collections) |

### Key architectural characteristics

- **Anti-hallucination by design**: MongoDB is the only source of truth for patient facts; the prompt
  contains a rigid `[DB FACT]` block and explicit rules forbidding the LLM from inferring or altering data.
- **Offline-built vector index**: FAISS is built once via `build_vector_store.py` and only *loaded* at
  runtime — never rebuilt on request.
- **Semantic routing**: each patient-mode question is classified `patient` / `knowledge` / `hybrid` to tune
  how the prompt balances DB facts vs general knowledge.
- **Graceful degradation**: if the FAISS index is missing, the engine still answers (with a caveat); if the
  Python service is down, the Node layer returns `503`.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND (React / Vite)                          │
│                                                                                   │
│  Doctor Portal                              Family Portal                         │
│  ─────────────                              ─────────────                         │
│  /doctor/.../assistant                      /family/.../assistant                 │
│    DoctorAssistantPage.jsx                    FamilyAssistantPage.jsx              │
│      (patient dropdown, optional)               (patient fixed = linked patient)   │
│         │                                          │                              │
│         └──────────► AIAssistantPanel.jsx ◄────────┘   (shared chat UI)           │
│                            │                                                      │
│  DoctorChatbotWidget.jsx (dashboard embedded variant, doctor-only)                │
│                            │                                                      │
│                            ▼                                                      │
│                  chatbotService.js  →  askChatbot(question, patientId)             │
│                            │  fetch POST http://localhost:5001/api/chatbot/ask     │
└────────────────────────────┼──────────────────────────────────────────────────────┘
                              │  Authorization: Bearer <JWT>
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          NODE / EXPRESS BACKEND  (port 5001)                      │
│                                                                                   │
│  server.js  →  app.use('/api/chatbot', chatbotRoutes)                             │
│                            │                                                      │
│  chatbot.routes.js  →  POST /ask  [protectDoctorOrFamily] → askQuestion           │
│                            │                                                      │
│  familyAuth.middleware.js (protectDoctorOrFamily)                                 │
│     • verifies JWT, resolves role (doctor | family | patient)                     │
│     • sets req.userRole, req.doctor / req.family, req.patientId                    │
│                            │                                                      │
│  chatbot.controller.js (askQuestion)                                              │
│     • validates question / patient_id                                             │
│     • ACCESS CONTROL:                                                             │
│         family → patient_id MUST equal req.patientId                              │
│         doctor → Patient.findOne({_id, doctor: req.doctor._id})                   │
│     • sessionId = req.user._id                                                    │
│     • maps role → 'doctor' | 'family'                                             │
│                            │                                                      │
│  chatbot.service.js (askChatbot)  →  axios POST http://localhost:8000/chat/ask    │
└────────────────────────────┼──────────────────────────────────────────────────────┘
                              │  { question, patient_id, session_id, user_role }
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PYTHON / FastAPI AI SERVICE  (port 8000)                    │
│                                                                                   │
│  app.py  →  POST /chat/ask  →  chatbot.answer(...)                                │
│                            │                                                      │
│  chatbot.py (answer)                                                              │
│     1. truncate question (>2000 chars)                                            │
│     2. memory_key = session_id (+ "_" + patient_id)                               │
│     3. history  = format_memory(memory_key)        ◄── MongoDB chat_histories     │
│     4. rag_ctx  = _rag_context(question)           ◄── FAISS via knowledge_tool   │
│     5. if patient_id: get_patient + format_patient ◄── MongoDB patients/meds/moods│
│            route = _classify_question(question)    ◄── SentenceTransformer router │
│            prompt = _build_patient_prompt(role)                                   │
│        else: prompt = _build_general_prompt                                       │
│     6. response = llm.invoke(prompt)               ◄── Groq llama-3.3-70b         │
│     7. append safety disclaimer                                                   │
│     8. add_to_memory(...)                          ──► MongoDB chat_histories     │
│                            │                                                      │
│        returns { answer, mode }                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
       │                                  │                          │
       ▼                                  ▼                          ▼
┌─────────────┐                  ┌──────────────────┐       ┌─────────────────┐
│   Groq API  │                  │   FAISS index    │       │     MongoDB     │
│ (LLM cloud) │                  │  (local files)   │       │ patients/meds/  │
│             │                  │  index.faiss/.pkl│       │ moods/chat_hist │
└─────────────┘                  └──────────────────┘       └─────────────────┘
                                  built offline by
                                  build_vector_store.py
                                  ◄── PDFs (data/) + web scrape (alz.org, nih.gov, wikipedia)
```

### Process topology

There are **three independent processes**:

1. **React dev/build server** (Vite) — serves the SPA (origins `5173`–`5176`, `3000`).
2. **Node/Express API** — `backend/server.js`, port **5001**, single gateway for all app APIs.
3. **Python FastAPI AI service** — `backend/modules/chatbot/python_service/app.py`, port **8000**,
   launched separately with `uvicorn app:app --host 0.0.0.0 --port 8000`.

The Node service is the **only** caller of the Python service (the frontend never talks to port 8000
directly). MongoDB is shared by **both** Node (Mongoose) and Python (PyMongo) against the **same database**.

---

## 3. Folder & File Structure

```
backend/
├── server.js                                  # Express bootstrap; mounts /api/chatbot
├── .env                                        # PORT, MONGODB_URI, PYTHON_SERVICE_URL, JWT_SECRET …
├── middlewares/
│   └── familyAuth.middleware.js                # protectDoctorOrFamily (auth + role resolution)
├── models/
│   ├── Patient.model.js                        # patients collection (source of truth for patient facts)
│   ├── Medication.model.js                     # medications collection
│   ├── Mood.model.js                           # moods collection
│   ├── Family.model.js                         # family collection (linked patient + permissions)
│   └── Doctor.model.js                          # doctors collection
└── modules/
    └── chatbot/
        ├── node_client/                         # NODE side (gateway → python)
        │   ├── chatbot.routes.js                # POST /ask
        │   ├── chatbot.controller.js            # access control + mode resolution
        │   └── chatbot.service.js               # axios client → python service
        └── python_service/                      # PYTHON side (the actual RAG engine)
            ├── app.py                           # FastAPI app: /health /analyze /chat/ask
            ├── chatbot.py                        # RAG engine: routing, prompts, LLM, modes
            ├── memory.py                         # conversation memory + FAISS retrieval tool
            ├── mongo_handler.py                  # patient/med/mood fetch + record formatting
            ├── build_vector_store.py            # OFFLINE: build FAISS index (run once)
            ├── pdf_loader.py                     # OFFLINE: load PDFs recursively
            ├── web_loader.py                     # OFFLINE: scrape trusted web sources
            ├── requirements.txt                 # python deps
            ├── .env                             # MONGODB_URI, GROQ_API_KEY, FAISS_INDEX_PATH, DATA_PATH
            ├── faiss_index/
            │   ├── index.faiss                  # ~5.4 MB vector index (prebuilt)
            │   └── index.pkl                    # ~1.9 MB docstore + metadata (prebuilt)
            └── data/                            # ~90 Alzheimer's PDFs in 8 topical folders
                ├── About Alzheimer's, Other Dementia and Related Conditions/
                ├── Caregiving/
                ├── Financial and Legal/
                ├── Living with Dementia/
                ├── Safety/
                ├── Treatments, Clinical Trials and Prevention/
                └── choosing a Doctor/

frontend/
└── src/
    ├── modules/
    │   ├── chatbot/services/chatbotService.js       # askChatbot() fetch wrapper + token selection
    │   ├── doctor/index.jsx                         # route: /doctor/.../assistant → DoctorAssistantPage
    │   ├── family/index.jsx                         # route: /family/.../assistant → FamilyAssistantPage
    │   └── shared/api/api.js                        # tokenManager, patientsAPI
    └── features/
        ├── shared/components/AIAssistantPanel.jsx   # shared chat UI (both portals)
        ├── doctor/dashboard/
        │   ├── pages/DoctorAssistantPage.jsx        # wraps panel + patient dropdown
        │   └── components/DoctorChatbotWidget.jsx   # self-contained dashboard widget (doctor-only)
        └── family/dashboard/
            └── pages/FamilyAssistantPage.jsx        # wraps panel, patient fixed to linked patient
```

**Importance legend used below:** 🔴 critical (core path) · 🟠 important · 🟡 supporting · ⚪ offline/build-only

---

## 4. File-by-File Analysis

### Frontend

#### 🟠 `frontend/src/modules/chatbot/services/chatbotService.js`
- **Purpose:** The single frontend gateway to the chatbot API.
- **Responsibilities:** Selects the correct JWT for the active role via `tokenManager.getUserType()`
  (`doctor` / `family` / `patient`, with fallbacks), builds the request body
  (`{ question, patient_id? }`), POSTs to `http://localhost:5001/api/chatbot/ask`, throws on non-2xx.
- **Called by:** `AIAssistantPanel.jsx`, `DoctorChatbotWidget.jsx`.
- **Calls:** `tokenManager` (from `modules/shared/api/api.js`), Node `/api/chatbot/ask`.
- **Notes:** `patient_id` is only attached when truthy — its absence is what selects GENERAL mode.
  `API_BASE_URL` is **hardcoded** to `http://localhost:5001/api`.

#### 🔴 `frontend/src/features/shared/components/AIAssistantPanel.jsx`
- **Purpose:** The shared chat UI used by **both** Doctor and Family assistant pages.
- **Responsibilities:** Local message state, welcome message generation, send handling, loading
  indicator, mode badge (`patient`/`family`/`general`/`idle`), resets the conversation when `patientId`
  changes. Renders the `result.mode` returned by the backend as a per-message badge.
- **Props:** `roleLabel` (`'Doctor'`/`'Family'`), `patientId`, `patientName`.
- **Calls:** `askChatbot(text, patientId || null)`.
- **Notes:** Conversation state is **purely client-side / ephemeral** (lives in React state). The
  *server-side* history is keyed independently in MongoDB (see memory.py). The UI does **not** display
  `sources`/`metadata`, even though the API can return them.

#### 🟠 `frontend/src/features/doctor/dashboard/pages/DoctorAssistantPage.jsx`
- **Purpose:** Doctor's full-page assistant.
- **Responsibilities:** Loads active patients via `patientsAPI.getAll({status:'active'})`, renders an
  **optional** patient dropdown, passes the chosen `patientId`/name into `AIAssistantPanel` with
  `roleLabel="Doctor"`.
- **Doctor-specific:** Patient selection is optional and free (any of the doctor's patients) → enables
  PATIENT mode; no selection → GENERAL mode.

#### 🟠 `frontend/src/features/family/dashboard/pages/FamilyAssistantPage.jsx`
- **Purpose:** Family member's assistant.
- **Responsibilities:** Reads the linked patient from `useAuth().user.patient` (id + name), passes it
  into `AIAssistantPanel` with `roleLabel="Family"`.
- **Family-specific:** **No patient dropdown.** `patientId` is fixed to the family's single linked
  patient → FAMILY mode is effectively always on (unless the user is unlinked).

#### 🟡 `frontend/src/features/doctor/dashboard/components/DoctorChatbotWidget.jsx`
- **Purpose:** A **self-contained** embeddable widget (doctor dashboard) that duplicates the panel's chat
  logic and includes its own patient dropdown and mode badge (`patient`/`general` only).
- **Calls:** `askChatbot`, `patientsAPI.getAll`.
- **Notes:** Functionally redundant with `AIAssistantPanel` (code duplication / tech debt). Only used in
  the doctor portal.

#### 🟡 `frontend/src/modules/doctor/index.jsx` & `frontend/src/modules/family/index.jsx`
- Define the `assistant` sub-routes that mount `DoctorAssistantPage` / `FamilyAssistantPage`.

### Node backend

#### 🔴 `backend/modules/chatbot/node_client/chatbot.routes.js`
- Declares `POST /ask` guarded by `protectDoctorOrFamily`, handled by `askQuestion`. Mounted at
  `/api/chatbot` in `server.js` → effective route `POST /api/chatbot/ask`.

#### 🔴 `backend/modules/chatbot/node_client/chatbot.controller.js` — `askQuestion`
- **Purpose:** The security/authorization boundary and mode resolver.
- **Logic:**
  1. Validates `question` is non-empty.
  2. If `patient_id` present: validates ObjectId format; **enforces access control**:
     - `family`: `patient_id` must equal `req.patientId` (their linked patient) else **403**.
     - `doctor`: `Patient.findOne({_id: patient_id, doctor: req.doctor._id})` else **403**.
  3. `sessionId = req.user._id` (per-user memory key; `'general'` fallback).
  4. Maps `req.userRole` → `'family'` or `'doctor'` (anything not family ⇒ doctor).
  5. Calls `askChatbot(question, resolvedPatientId, sessionId, userRole)`.
  6. Returns `{ success, answer, mode, sources, metadata }`.
- **Error handling:** `ECONNREFUSED`/`ECONNRESET` → **503**; upstream `error.response` → mirrors status;
  else `next(error)`.
- **Called by:** route. **Calls:** `chatbot.service.askChatbot`, `Patient` model.

#### 🔴 `backend/modules/chatbot/node_client/chatbot.service.js` — `askChatbot`
- **Purpose:** Thin axios client to the Python service.
- **Config:** `baseURL = PYTHON_SERVICE_URL || http://localhost:8000`, **timeout 60s**.
- **Calls:** `POST /chat/ask` with `{question, patient_id, session_id, user_role}`. Also exports
  `checkPythonHealth()` (`GET /health`) — not currently wired into any route.

#### 🔴 `backend/middlewares/familyAuth.middleware.js` — `protectDoctorOrFamily`
- **Purpose:** Auth for the chatbot route (also exports `protectFamily`, `generateFamilyToken`,
  `checkFamilyPermission`).
- **Logic:** Extracts Bearer token, verifies against `JWT_SECRET`, then tries roles in order
  **doctor → family → patient**. On success sets `req.user`, `req.userRole`, and for family/patient also
  `req.patientId`. For family it **populates** `patient` (firstName, lastName, patientNumber,
  alzheimerLevel, status). Returns 401 if no role matches.
- **Important:** Uses a single shared `JWT_SECRET` for all roles (the file comments claim a "family-specific
  secret," but the code uses one secret).

### Python AI service

#### 🔴 `python_service/app.py` — FastAPI entry point
- **Endpoints:**
  - `GET /health` — liveness.
  - `POST /chat/ask` — the RAG chat endpoint. Validates question (non-empty, ≤4000 chars), defaults
    `session_id`/`user_role`, calls `chatbot.answer(...)`, returns `ChatResponse{answer, mode, metadata}`.
    **Note:** `sources` is never populated by this route (always `None`).
  - `POST /analyze` — **separate feature, not chat RAG**: classifies a patient's *spoken* reply to a
    scheduled check-in into an intent (`confirm_taken`/`deny_taken`/`forgot`/`feeling_bad`/`confused`)
    using Groq `llama3-8b-8192`, with a Python rule-based fallback. Consumed by the Node daily-plan
    service, **not** by the chatbot UI. Documented here because it shares the process/file.
- **CORS:** allows `NODE_SERVICE_ORIGIN` (default `:5001`) plus Vite/React dev origins.

#### 🔴 `python_service/chatbot.py` — the RAG engine
- **Module-load (once at startup):**
  - `llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)` — deterministic.
  - `_embeddings = HuggingFaceEmbeddings("all-MiniLM-L6-v2")`.
  - `vector_db = FAISS.load_local(FAISS_INDEX_PATH, ...)` (with `allow_dangerous_deserialization=True`);
    if missing → `vector_db = None` and a warning is logged.
  - `_embedder = SentenceTransformer("all-MiniLM-L6-v2")` for routing, plus precomputed embeddings of the
    three route descriptions (`patient`/`knowledge`/`hybrid`).
- **`_classify_question(question) → 'patient'|'knowledge'|'hybrid'`:** cosine similarity of the question vs
  the 3 route label embeddings. If top-2 within 0.05 → `hybrid`; if best confidence < 0.65 → ask the LLM to
  classify; else the best label.
- **`_rag_context(question)`:** returns `knowledge_tool(vector_db, question)` or a fallback string if no
  index.
- **Prompt builders:**
  - `_build_patient_prompt(...)` — strict DB-grounded prompt with the `_ANTI_HALLUCINATION_RULES` block, a
    role-conditional `audience` (doctor=clinical / family=compassionate), a route-conditional `focus_hint`,
    and a required `## Patient Facts / ## Medical Context / ## Summary` output structure.
  - `_build_general_prompt(...)` — knowledge-only prompt forbidding any patient invention.
- **`answer(question, patient_id, session_id, user_role)`** — orchestrates the whole flow (see
  [§5](#5-data-flow-diagrams)). Returns `{answer, mode}`. Appends `_SAFETY_DISCLAIMER` if not already present.
- **`_SAFETY_DISCLAIMER`** is appended to **all** responses.

#### 🔴 `python_service/memory.py` — conversation memory + retrieval tool
- **Mongo:** connects via PyMongo to the DB parsed from `MONGODB_URI`; collection `chat_histories` with an
  index on `session_key`.
- **`get_memory / add_to_memory / format_memory`:** stores exchanges as `{role, content, timestamp}` arrays;
  keeps the last `HISTORY_WINDOW=10` exchanges (×2 messages); each message capped at `MAX_MSG_CHARS=600`
  when formatted into the prompt.
- **`knowledge_tool(vector_db, question, k=6)`:** the RAG retriever.
  - `similarity_search_with_score(question, k=6)` (L2 distance).
  - Keeps chunks with `score < 1.20` (≈ cosine > 0.28); if fewer than `_RAG_MIN_RESULTS=2` pass, returns
    the top 2 regardless (guarantees non-empty context); otherwise caps at **4 chunks**.
  - Returns the chunks' `page_content` joined by blank lines. **Source metadata is discarded** here.

#### 🔴 `python_service/mongo_handler.py` — patient data access & formatting
- **Mongo collections:** `patients`, `medications`, `moods`.
- **`get_patient(patient_id)`:** look up by `ObjectId` then by `patientNumber`; stringifies ObjectIds.
- **`get_patient_medications(patient_id)`:** active meds (`isActive:true`), limited to 20, projected fields.
- **`get_patient_recent_moods(patient_id, limit=3)`:** newest 3 mood entries.
- **`format_patient(patient)`:** renders the **authoritative `[DB FACT]` record** (demographics, Alzheimer
  level, diagnosis date, medical history, allergies, formatted medications, last 3 moods, appointments,
  emergency contact, last 5 doctor notes). Missing fields → `"Not recorded in patient file"` via `_val`.
- This formatted block is the **anti-hallucination anchor** injected into the patient prompt.

#### ⚪ `python_service/build_vector_store.py` — offline index builder
- Loads PDFs (`load_pdfs`) + web docs (`load_web_data`), splits with
  `RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)`, tags metadata
  (`source_type`, `reliability`), embeds with MiniLM, `FAISS.from_documents`, saves to `FAISS_INDEX_PATH`.
- **Run manually once.** Not invoked at request time.

#### ⚪ `python_service/pdf_loader.py`
- `load_pdfs(folder)` — recursive `os.walk`, loads every `.pdf` via `PyPDFLoader` (one Document per page).

#### ⚪ `python_service/web_loader.py`
- `load_web_data()` — scrapes 4 hardcoded URLs (alz.org ×2, nia.nih.gov, en.wikipedia), strips nav/script,
  attaches a `reliability` weight (alz.org 1.0, nih 0.9, wikipedia 0.6), skips pages < 800 chars.

---

## 5. Data Flow Diagrams

### 5.1 Request flow (message → response), step by step

```
USER types in chat box (AIAssistantPanel / DoctorChatbotWidget)
  │  handleSend()
  ▼
chatbotService.askChatbot(question, patientId)
  │  picks JWT for active role (tokenManager)
  │  body = { question, patient_id? }
  │  POST http://localhost:5001/api/chatbot/ask   (Bearer JWT)
  ▼
[NODE] protectDoctorOrFamily
  │  verify JWT → set req.userRole, req.user, (req.patientId / req.doctor)
  ▼
[NODE] askQuestion (controller)
  │  validate question
  │  if patient_id:
  │     family → must == req.patientId, else 403
  │     doctor → Patient.findOne({_id, doctor}), else 403
  │  sessionId = req.user._id
  │  userRole  = 'family' | 'doctor'
  ▼
[NODE] askChatbot (service) → axios POST http://localhost:8000/chat/ask
  │  { question, patient_id, session_id, user_role }
  ▼
[PY] /chat/ask (app.py) → answer(...) (chatbot.py)
  │  (1) truncate question >2000 chars
  │  (2) memory_key = patient_id ? f"{session_id}_{patient_id}" : session_id
  │  (3) history = format_memory(memory_key)           ← MongoDB chat_histories
  │  (4) rag_ctx = knowledge_tool(vector_db, question)  ← FAISS top-k (≤4 chunks)
  │  (5) if patient_id:
  │         patient = get_patient(id)                   ← MongoDB patients
  │         record  = format_patient(patient)           ← + medications + moods
  │         if found:
  │            route  = _classify_question(question)     ← SentenceTransformer
  │            prompt = _build_patient_prompt(role, route)
  │            mode   = 'patient' (doctor) | 'family'
  │         else: fall through to GENERAL
  │      if no patient_id:
  │            prompt = _build_general_prompt(); mode='general'
  │  (6) response_text = llm.invoke(prompt)              ← Groq llama-3.3-70b
  │  (7) append _SAFETY_DISCLAIMER if missing
  │  (8) add_to_memory(memory_key, question, response)  → MongoDB chat_histories
  │  returns { answer, mode }
  ▼
[PY] ChatResponse { answer, mode, metadata }  (sources = None)
  ▼
[NODE] 200 { success, answer, mode, sources:null, metadata }
  ▼
[FRONTEND] AIAssistantPanel renders answer + mode badge
```

### 5.2 Response flow / error paths

- Python raises → `app.py` returns **500** `{detail}` → Node mirrors status → frontend throws → red error
  bubble.
- Python unreachable → axios `ECONNREFUSED/RESET` → Node **503** → frontend shows "AI service unavailable".
- Patient not found in DB → Python silently downgrades to **GENERAL** mode (no error), `mode:"general"`.

### 5.3 Mode-selection decision tree

```
patient_id present?
├── NO  ──────────────────────────────► GENERAL mode (RAG only)
└── YES
      patient found in MongoDB?
      ├── NO ─────────────────────────► GENERAL mode (silent downgrade)
      └── YES
            user_role == 'doctor'? ──► PATIENT mode (clinical tone)
            user_role == 'family'? ──► FAMILY  mode (compassionate tone)
            (both run _classify_question → route hint: patient/knowledge/hybrid)
```

---

## 6. RAG Pipeline Deep Dive

### 6.1 Knowledge Source Layer
- **PDFs:** ~90 Alzheimer's/dementia documents under `python_service/data/`, organized in 8 topical folders
  (About the disease, Caregiving, Financial & Legal, Living with Dementia, Safety, Treatments/Trials,
  Choosing a Doctor). Predominantly Alzheimer's Association ("ts" tip-sheets).
- **Web:** 4 hardcoded trusted URLs scraped offline (alz.org, nia.nih.gov, Wikipedia).
- **Patient data (PATIENT/FAMILY mode only):** MongoDB `patients` + `medications` + `moods` — treated as
  the **source of truth**, separate from the RAG corpus.

### 6.2 Ingestion Layer (offline, `build_vector_store.py`)
- **Load:** `PyPDFLoader` per-page Documents; BeautifulSoup-cleaned web text.
- **Clean:** web loader strips `script/style/nav/footer/header/aside`, collapses whitespace, drops pages
  < 800 chars.
- **Chunk:** `RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)` characters.
- **Metadata:** PDFs → `source_type="pdf", reliability=1.0`; web → `source_type="web"` + per-domain
  reliability (1.0 / 0.9 / 0.6).
- **Embed:** `sentence-transformers/all-MiniLM-L6-v2` (384-dim, runs locally on CPU).

### 6.3 Storage Layer
- **Vector DB:** FAISS, persisted to `faiss_index/index.faiss` (vectors, ~5.4 MB) and `index.pkl`
  (docstore + index-to-id map + metadata, ~1.9 MB).
- **No external/managed vector DB.** No schema/indexes beyond FAISS's flat index.
- **Loaded once** at Python startup with `allow_dangerous_deserialization=True` (pickle).

### 6.4 Retrieval Layer (`knowledge_tool`)
- **Search:** `similarity_search_with_score(question, k=6)` → L2 distance.
- **Filter:** keep `score < 1.20` (≈ cosine > 0.28); cap at **4** chunks. Fallback to top-2 if too few pass.
- **No reranking, no MMR, no cross-encoder.** Single-vector dense retrieval only.
- **Reliability metadata is stored but never used** at retrieval/ranking time.

### 6.5 Context Layer (prompt construction)
- **Token management is character-based, not token-based:** question ≤ 2000 chars (engine) / 4000 (API);
  history window = last 10 exchanges, each capped at 600 chars; RAG = ≤4 chunks × ~500 chars.
- **Assembly:** ASCII-banner header → audience/role styling → anti-hallucination rules → route focus hint →
  required output structure → conversation history → patient record → RAG context → question.

### 6.6 Generation Layer
- **Model:** Groq `llama-3.3-70b-versatile`, `temperature=0` (deterministic).
- **System behavior** is embedded in the single composed prompt (no separate system message in the chat
  call — the whole prompt is passed to `llm.invoke`).
- **Post-processing:** appends `_SAFETY_DISCLAIMER` unless already present.

### 6.7 Conversation Layer
- **Store:** MongoDB `chat_histories`, one document per `session_key`, `messages[]` of
  `{role, content, timestamp}`.
- **Memory key composition (critical):**
  - GENERAL: `session_key = session_id` (= the user's `_id`).
  - PATIENT/FAMILY: `session_key = f"{session_id}_{patient_id}"` — isolates each (user, patient) thread.
- **Window:** last 10 exchanges injected into the prompt. **No summarization, no semantic memory, no TTL.**

---

## 7. Doctor Chatbot Analysis

| Aspect | Detail |
|--------|--------|
| **Entry (UI)** | `DoctorAssistantPage.jsx` (full page) and `DoctorChatbotWidget.jsx` (dashboard widget) |
| **Patient selection** | **Optional dropdown** of the doctor's `active` patients (`patientsAPI.getAll`) |
| **API** | Same `POST /api/chatbot/ask` |
| **Role mapping** | `req.userRole === 'doctor'` → `user_role = 'doctor'` |
| **Access control** | Per request: `Patient.findOne({_id: patient_id, doctor: req.doctor._id})` — a doctor may query **any patient assigned to them**; 403 otherwise |
| **Modes available** | GENERAL (no patient) and PATIENT (clinical tone) |
| **Prompt style** | "You are assisting a DOCTOR. Use precise clinical language…" |
| **Knowledge sources** | RAG knowledge base + (in PATIENT mode) the full `[DB FACT]` patient record incl. meds/moods/notes |
| **Retrieval logic** | Identical `knowledge_tool` + semantic router as family |
| **Memory key** | `"{doctorUserId}_{patientId}"` in PATIENT mode; `"{doctorUserId}"` in GENERAL |
| **Doctor-only features** | Optional/arbitrary patient switching; clinical-structured output (`## Patient Facts / ## Medical Context / ## Summary`) with field-level citation; the embedded dashboard widget |

**Doctor flow distinctive point:** the doctor can fluidly switch between General and any of their patients
in one session; each (doctor, patient) pair has its own isolated conversation thread server-side.

---

## 8. Family Chatbot Analysis

| Aspect | Detail |
|--------|--------|
| **Entry (UI)** | `FamilyAssistantPage.jsx` → shared `AIAssistantPanel` |
| **Patient selection** | **None.** `patientId` is fixed to `user.patient` (the single linked patient) |
| **API** | Same `POST /api/chatbot/ask` |
| **Role mapping** | `req.userRole === 'family'` → `user_role = 'family'` |
| **Access control** | `patient_id` **must equal `req.patientId`** (their linked patient); any other id → 403 |
| **Modes available** | FAMILY (compassionate tone) when linked patient is passed; GENERAL if no patient passed |
| **Prompt style** | "You are assisting a FAMILY MEMBER… clear, compassionate, non-technical language… acknowledge fear/worry warmly… never alarming language without reassurance." |
| **Knowledge sources** | Same RAG base + same `[DB FACT]` record (note: family sees the same clinical record content, just explained in plain language) |
| **Retrieval logic** | Identical to doctor |
| **Memory key** | `"{familyUserId}_{patientId}"` |
| **Family-only features** | Emotional-tone prompt; locked-down single-patient scope |

**Important nuance:** FAMILY mode uses the **same `format_patient` output** as doctor mode — i.e. the family
member's prompt contains the full clinical record (medications, mood scores, doctor notes). The difference
is purely in *how the LLM is told to phrase the answer*, not in *what data is exposed to the model*. The
backend does **not** check `Family.permissions` for the chatbot route (see Risks).

---

## 9. Database Analysis

Single MongoDB database (name parsed from `MONGODB_URI`), shared by Node (Mongoose) and Python (PyMongo).

### 9.1 `chat_histories` — conversation memory (chatbot-owned)
- **Owner:** Python `memory.py` (PyMongo). **No Mongoose model exists** for this collection.
- **Schema (implicit):**
  ```
  { session_key: string (indexed),
    messages: [ { role: "user"|"assistant", content: string, timestamp: Date } ],
    created_at: Date, updated_at: Date }
  ```
- **CRUD:** upsert/`$push` in `add_to_memory`; read in `get_memory`. **No deletes, no TTL.**
- **`session_key` values:** `"<userId>"` (general) or `"<userId>_<patientId>"` (patient/family).

### 9.2 `patients` — source of truth (read by chatbot)
- **Model:** `Patient.model.js`. **Key chatbot fields:** `firstName/lastName`, `dateOfBirth`, `age`,
  `gender`, `patientNumber`, `status`, `description`, `alzheimerLevel` (`early|middle|late`),
  `diagnosisDate`, `medicalHistory`, `allergies[]`, `emergencyContact{}`, `notes[]`, `lastCheckup`,
  `nextAppointment`, `doctor` (ref), `family` (ref).
- **Chatbot usage:** read-only via `get_patient` / `format_patient`. Access scoped by `doctor` (doctor mode)
  or by `req.patientId` (family mode). The controller also reads it for the doctor authorization check.

### 9.3 `medications` (read by chatbot)
- **Model:** `Medication.model.js`. Query: `{patient, isActive:true}` limit 20. Fields used: `name`,
  `genericName`, `type`, `strength`, `instructions`, `purpose`, `sideEffects`, dates, `notes`.

### 9.4 `moods` (read by chatbot)
- **Model:** `Mood.model.js`. Query: newest 3 by `recordedAt`. Fields used: `mood`, `moodScore`, `energy`,
  `behaviors`, `physicalSymptoms`, `cognitiveState`, `sleep`, `appetite`, `notes`, `isAbnormal`.

### 9.5 `family` (read by auth, not by Python)
- **Model:** `Family.model.js`. Provides `patient` link (populated in middleware) and a `permissions`
  object. **Not** consulted by the chatbot's authorization logic.

### 9.6 Collections NOT used for chatbot
There is **no** `embeddings`, `documents`, `knowledge_bases`, or `sessions` collection. Embeddings/documents
live exclusively in the **FAISS files**, not in MongoDB. "Sessions" are implicit via `chat_histories.session_key`.

---

## 10. External Services

### 10.1 Groq (LLM cloud) — **critical**
- **Why:** generation + (in `/analyze`) intent classification + routing fallback.
- **Models:** `llama-3.3-70b-versatile` (chat, temp 0) in `chatbot.py`; `llama3-8b-8192` (voice intent,
  temp 0.05) in `app.py`.
- **Where:** `chatbot.py` (`llm.invoke(prompt)`, `_classify_question` fallback); `app.py` `_analyze_with_llm`.
- **Auth:** `GROQ_API_KEY` (python `.env`).
- **Failure handling:** chat path — exceptions bubble to `app.py` → HTTP 500 (no LLM fallback for chat);
  routing fallback failure → defaults to `hybrid`; voice-intent path → rule-based fallback (`_rule_based_fallback`).

> **Note on provider context:** This system uses **Groq-hosted Llama**, not Anthropic Claude / OpenAI /
> Gemini. No OpenAI, Gemini, or Claude integration exists anywhere in the chatbot code. If this were ever
> migrated to Claude, the relevant SDK is `@anthropic-ai/sdk` / `anthropic` with models such as
> `claude-opus-4-8` / `claude-sonnet-4-6` — but that is **not** present today.

### 10.2 HuggingFace sentence-transformers (local) — **critical**
- **Why:** embeddings for both the FAISS corpus and the semantic router.
- **Model:** `all-MiniLM-L6-v2` (downloaded/cached locally; runs on CPU). No API key, no network at request
  time after first download.

### 10.3 FAISS (local library) — **critical**
- **Why:** the vector store. File-based, loaded once. `faiss-cpu`.

### 10.4 MongoDB — **critical**
- **Why:** patient/med/mood data + conversation memory. Accessed by both Node and Python against the same DB.

### 10.5 Web sources (offline only)
- alz.org, nia.nih.gov, en.wikipedia — scraped **only** during `build_vector_store.py`. Not contacted at
  request time.

### 10.6 The Python service itself (internal microservice)
- **Why:** isolates the heavy ML/LangChain stack from the Node API.
- **Failure handling:** Node maps connection errors → 503; 60s axios timeout.

---

## 11. Environment Variables

### Node backend (`backend/.env`)
| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Express port | `5001` |
| `MONGODB_URI` | Mongo connection (Mongoose) | — |
| `PYTHON_SERVICE_URL` | Base URL of the FastAPI service | `http://localhost:8000` |
| `JWT_SECRET` | JWT verification for all roles | — |
| `NODE_ENV` | dev/prod (controls error stack exposure) | — |

### Python service (`backend/modules/chatbot/python_service/.env`)
| Variable | Purpose | Default |
|----------|---------|---------|
| `MONGODB_URI` | Mongo connection (PyMongo); DB name parsed from URI | `mongodb://localhost:27017/alzcare_doctor_dashboard` |
| `GROQ_API_KEY` | Groq LLM auth | `""` |
| `FAISS_INDEX_PATH` | Path to prebuilt FAISS index | `faiss_index` |
| `DATA_PATH` | PDF corpus folder (build-time) | `data` |
| `NODE_SERVICE_ORIGIN` | CORS allow-origin | `http://localhost:5001` |

### Frontend
- **No env var** for the API base — `http://localhost:5001/api` is **hardcoded** in `chatbotService.js`.

---

## 12. Risks & Weaknesses

> Documentation only — nothing below was changed.

### Security
1. **Family members' prompts contain the full clinical record.** `format_patient` produces the same
   `[DB FACT]` block (medications, mood scores, doctor notes) for family as for doctors; only the *phrasing*
   differs. `Family.permissions` is **never checked** on the chatbot route — a linked family member can ask
   about any field. (`familyAuth.middleware.js`, `chatbot.controller.js`, `mongo_handler.py`.)
2. **`allow_dangerous_deserialization=True`** on `FAISS.load_local` (pickle). Safe only if the index file is
   trusted; a tampered `index.pkl` could execute arbitrary code at load.
3. **Single `JWT_SECRET` for all roles** despite the comment claiming a "family-specific secret." A token's
   `role` claim is the only role boundary.
4. **`patient` role can reach the chatbot** via `protectDoctorOrFamily` (it accepts patient tokens), but the
   controller only special-cases `family`/`doctor`; a patient token falls into the `doctor` branch of the
   role map (`userRole === 'family' ? 'family' : 'doctor'`) and would skip the doctor ownership check
   because `req.doctor` is undefined → potential authorization gap if a `patient_id` is supplied. Worth a
   focused review.
5. **CORS allows a broad set of localhost origins**; fine for dev, must be tightened for prod.
6. **No rate limiting** on `/api/chatbot/ask` → cost/DoS exposure on the paid Groq API.

### Architecture / scalability
7. **FAISS loaded into a single process's memory**; no horizontal scaling story. Multiple Python workers
   each load their own copy of the index + models. The router/embedder/index are global singletons.
8. **Index is immutable at runtime** — adding knowledge requires a manual `build_vector_store.py` re-run and
   a service restart. No incremental ingestion.
9. **No managed vector DB** — persistence/versioning/backup of the index is manual (two binary files).
10. **`chat_histories` grows unbounded** — no TTL, archival, or pruning; `messages` array grows forever per
    session (Mongo 16 MB document limit risk for very long-lived sessions).

### Retrieval / context quality
11. **Character-based truncation, not token-based** — risks cutting mid-token/mid-sentence and is an
    imprecise proxy for the model's context budget.
12. **No reranking / MMR / cross-encoder** — pure top-k dense retrieval; the stored `reliability` metadata
    is never used to weight or rank.
13. **Fixed L2 threshold (1.20) and fallback-to-top-2** can inject irrelevant chunks for off-topic
    questions (the engine always supplies *some* context).
14. **RAG sources are dropped** — `knowledge_tool` returns only `page_content`; the API's `sources` field is
    always `None`, and the UI shows no citations. No traceability of which document grounded an answer.
15. **Router is two-model heavy** — both a `SentenceTransformer` (router) and `HuggingFaceEmbeddings` load
    the *same* MiniLM weights twice in memory.

### Correctness / reliability
16. **Silent downgrade to GENERAL** when a patient isn't found — the user gets a generic answer with no
    signal that their patient context was dropped.
17. **No LLM fallback on the chat path** — any Groq error → HTTP 500 (contrast with `/analyze`, which has a
    rule fallback).
18. **Anti-hallucination relies entirely on prompt instructions**, not on programmatic verification; a
    sufficiently adversarial question could still elicit ungrounded content.
19. **Two question-length caps disagree** (API 4000 chars vs engine 2000 chars) — the engine silently
    truncates anything 2000–4000.

### Maintainability / tech debt
20. **UI duplication** — `DoctorChatbotWidget.jsx` reimplements `AIAssistantPanel.jsx`'s chat logic.
21. **`chat_histories` has no Mongoose model** — schema lives implicitly in Python only; easy to drift.
22. **Hardcoded frontend API base URL** — not environment-driven; breaks non-localhost deployment.
23. **`checkPythonHealth()` is exported but unused** — no health gating before calls.
24. **`/analyze` lives in the chatbot service** but belongs to the daily-plan feature — mixed concerns in
    one process.

---

## 13. Complete Dependency Mapping

### 13.1 Call/dependency tree (runtime chat path)

```
AIAssistantPanel.jsx ─┐
DoctorChatbotWidget.jsx ─┼─► chatbotService.askChatbot()
DoctorAssistantPage.jsx ─┤        │ uses tokenManager (modules/shared/api/api.js)
FamilyAssistantPage.jsx ─┘        │ uses patientsAPI (doctor page/widget only)
                                  ▼  HTTP POST /api/chatbot/ask
                       server.js (mount /api/chatbot)
                                  ▼
                       chatbot.routes.js
                                  ├─► protectDoctorOrFamily (familyAuth.middleware.js)
                                  │        └─► Doctor / Family / Patient models, jsonwebtoken
                                  ▼
                       chatbot.controller.js (askQuestion)
                                  ├─► Patient.model.js (doctor ownership check)
                                  └─► chatbot.service.js (askChatbot)
                                           ▼  HTTP POST /chat/ask (axios)
                                  app.py (/chat/ask)
                                           ▼
                                  chatbot.py answer()
                                  ├─► memory.py
                                  │     ├─ format_memory / add_to_memory ─► MongoDB chat_histories
                                  │     └─ knowledge_tool ─► FAISS (vector_db)
                                  ├─► mongo_handler.py
                                  │     ├─ get_patient ─► MongoDB patients
                                  │     ├─ get_patient_medications ─► MongoDB medications
                                  │     ├─ get_patient_recent_moods ─► MongoDB moods
                                  │     └─ format_patient
                                  ├─► _classify_question ─► SentenceTransformer + sklearn
                                  ├─► _build_patient_prompt / _build_general_prompt
                                  └─► llm.invoke ─► Groq (langchain_groq.ChatGroq)
```

### 13.2 Offline build dependency tree

```
build_vector_store.py
  ├─► pdf_loader.load_pdfs  ─► PyPDFLoader ─► data/**.pdf
  ├─► web_loader.load_web_data ─► requests + BeautifulSoup ─► alz.org / nih.gov / wikipedia
  ├─► RecursiveCharacterTextSplitter (chunk 500 / overlap 100)
  ├─► HuggingFaceEmbeddings (all-MiniLM-L6-v2)
  └─► FAISS.from_documents → save_local → faiss_index/{index.faiss, index.pkl}
```

### 13.3 "Called by / calls" quick matrix

| File | Called by | Calls |
|------|-----------|-------|
| `chatbotService.js` | Panel, Widget, pages | Node `/api/chatbot/ask`, `tokenManager` |
| `AIAssistantPanel.jsx` | Doctor/Family pages | `chatbotService.askChatbot` |
| `DoctorChatbotWidget.jsx` | doctor dashboard | `askChatbot`, `patientsAPI` |
| `chatbot.routes.js` | `server.js` | `protectDoctorOrFamily`, `askQuestion` |
| `chatbot.controller.js` | route | `askChatbot` (service), `Patient` model |
| `chatbot.service.js` | controller | Python `/chat/ask` (axios) |
| `familyAuth.middleware.js` | route | `jsonwebtoken`, Doctor/Family/Patient models |
| `app.py` | Node service / daily-plan | `chatbot.answer`, Groq (analyze) |
| `chatbot.py` | `app.py` | `memory.py`, `mongo_handler.py`, Groq, FAISS, SentenceTransformer |
| `memory.py` | `chatbot.py` | MongoDB `chat_histories`, FAISS |
| `mongo_handler.py` | `chatbot.py` | MongoDB `patients`/`medications`/`moods` |
| `build_vector_store.py` | manual | `pdf_loader`, `web_loader`, FAISS, HF embeddings |
| `pdf_loader.py` / `web_loader.py` | `build_vector_store.py` | PyPDFLoader / requests+bs4 |

---

## Appendix A — Key Constants Reference

| Constant | Value | File | Meaning |
|----------|-------|------|---------|
| Chat LLM | `llama-3.3-70b-versatile` | chatbot.py | generation model (temp 0) |
| Intent LLM | `llama3-8b-8192` | app.py | voice-intent model (temp 0.05) |
| Embedding model | `all-MiniLM-L6-v2` | chatbot.py / build | 384-dim local embeddings |
| `MAX_QUESTION_CHARS` | 2000 | chatbot.py | engine question cap |
| API question cap | 4000 | app.py | API question cap |
| `HISTORY_WINDOW` | 10 | memory.py | exchanges kept in prompt |
| `MAX_MSG_CHARS` | 600 | memory.py | per-message char cap |
| `_RAG_SCORE_THRESHOLD` | 1.20 (L2) | memory.py | relevance cutoff (~cosine 0.28) |
| `_RAG_MIN_RESULTS` | 2 | memory.py | fallback floor |
| RAG `k` / cap | 6 fetched / ≤4 returned | memory.py | retrieval breadth |
| chunk_size / overlap | 500 / 100 chars | build_vector_store.py | chunking |
| axios timeout | 60000 ms | chatbot.service.js | Node→Python timeout |
| Router thresholds | 0.05 gap / 0.65 conf | chatbot.py | hybrid / LLM-fallback triggers |

---

*End of audit. No source files were modified during this analysis.*
