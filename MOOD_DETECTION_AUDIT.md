# ALZCare — Mood Detection System: Complete Technical Audit & Documentation

> **Document type:** Investigation & documentation only. No code was modified, fixed, or refactored. Every claim below is traced to a specific file, function, and line as they exist on branch `main` at audit time.
>
> **Goal:** Enable a new senior engineer to fully understand the Mood Detection feature end-to-end without reading the codebase.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Architecture Overview](#2-complete-architecture-overview)
3. [End-to-End Flow](#3-end-to-end-flow)
4. [File-by-File Analysis](#4-file-by-file-analysis)
5. [API Documentation](#5-api-documentation)
6. [Database Analysis](#6-database-analysis)
7. [AI Pipeline Analysis](#7-ai-pipeline-analysis)
8. [Emotion Mapping Analysis](#8-emotion-mapping-analysis)
9. [Notification Flow](#9-notification-flow)
10. [Scheduling Flow](#10-scheduling-flow)
11. [Frontend Flow](#11-frontend-flow)
12. [Security Review](#12-security-review)
13. [Reliability Review](#13-reliability-review)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Current Problems & Findings (Confirmed Findings)](#15-current-problems--findings)
16. [Open Questions](#16-open-questions)
17. [Final System Understanding](#17-final-system-understanding)

---

## 1. Executive Summary

### What the Mood Detection feature does

ALZCare contains **two parallel, independent mood subsystems** that share a name and a UI metaphor but do **not** share data, models, APIs, or notification logic:

| | **Part 1 — AI Mood (voice emotion)** | **Part 2 — Manual Mood (structured entry)** |
|---|---|---|
| **Input** | Patient's recorded voice (microphone) | A form filled in by a doctor or family member |
| **Engine** | Python FastAPI service running a PyTorch model (Wav2Vec2 + MFCC + fusion) | Human judgment |
| **Storage** | `AIMood` collection | `Mood` collection |
| **API prefix** | `/api/mood-checkin` | `/api/moods` |
| **Trigger** | A cron scheduler emits a Socket.IO event at scheduled times; the patient device pops a modal, records 12 s, and uploads | Manual HTTP POST whenever a caregiver chooses |
| **Who sees it** | **Family dashboard only** | **Doctor dashboard only** |
| **Creates notifications?** | **No** (none — see Finding C-2) | **Yes** (`mood_abnormal`, `mood_entry`) |

### Purpose in the system

- **AI Mood** is intended to passively monitor a patient's emotional state through scheduled voice check-ins, surfacing trends (e.g., increasing sadness/fear) to caregivers without requiring the patient to fill anything in — appropriate for Alzheimer's patients who cannot reliably self-report.
- **Manual Mood** is a richer clinical record (mood, score 1–10, energy, sleep, appetite, cognitive state, physical symptoms, behaviors, notes) entered by caregivers, with automatic abnormality detection and doctor notifications.

### How it interacts with each actor

- **Patient** — Only interacts with **AI Mood**. Receives a scheduled check-in modal, speaks, and sees the detected emotion. Does **not** see any history.
- **Family** — Manages the AI check-in **schedule** (up to 6 daily slots), sees AI emotion **latest card / stats / timeline** in real time via Socket.IO. Does **not** see manual `Mood` entries in the mood component. Receives manual `mood_entry`/`mood_abnormal` notifications only if those are addressed to them — but they are addressed to the **doctor** (see §9).
- **Doctor** — Sees **only manual `Mood`** history and stats; can delete entries. Has **no UI** for AI Mood at all and receives manual abnormal-mood notifications.
- **Notifications** — Created **only** by the manual path (`mood.service.js`). The AI path never creates one.
- **Schedules** — Only the AI path is scheduled (`MoodSchedule` + `moodCheckin.scheduler.js`). Manual mood is unscheduled.
- **Dashboards** — Two different components named `PatientMood.jsx` (one under `doctor/`, one under `family/`) render two different data sources.

---

## 2. Complete Architecture Overview

```
                          ┌──────────────────────────────────────────────────────────┐
                          │                      ACTORS                                │
                          │   Patient        Family            Doctor                  │
                          └────┬───────────────┬─────────────────┬────────────────────┘
                               │               │                 │
        ┌──────────────────────┼───────────────┼─────────────────┼─────────────────────┐
        │  FRONTEND (React + Vite, http://localhost:5173)                               │
        │                      │               │                 │                       │
        │  PatientPage.jsx     │  family/PatientMood.jsx          │ doctor/PatientMood.jsx│
        │   └ useMoodCheckin   │   └ useFamilyPatientData         │  └ usePatientData     │
        │   └ MoodCheckinModal │   (aiMoodAPI)                    │  (moodsAPI)           │
        │      (records audio) │                                  │                       │
        │            │         │                                  │                       │
        │     api.js (aiMoodAPI / moodsAPI)   socketClient.js (Socket.IO client)         │
        └────────────┼────────────────────────────────┼──────────────────────────────────┘
                     │ HTTP (JWT)                       │ WebSocket
                     ▼                                  ▼
        ┌──────────────────────────────────────────────────────────────────────────────┐
        │  BACKEND (Node/Express, http://localhost:5001)        socketManager.js         │
        │                                                                                │
        │  /api/mood-checkin  → aiMood.routes → aiMood.controller                        │
        │        ├ multer (memory, 25MB)                                                 │
        │        ├ emotion.service.js ──axios──► Python :8001  ◄── AI SERVICE            │
        │        ├ AIMood.model (Mongo)                                                  │
        │        └ emitToPatientRoom('mood:updated')                                     │
        │                                                                                │
        │  /api/moods  → mood.routes → mood.controller → mood.service                    │
        │        ├ Mood.model (Mongo)                                                    │
        │        └ Notification.model  (mood_abnormal / mood_entry)                      │
        │                                                                                │
        │  moodCheckin.scheduler.js (node-cron) ──emitToPatientRoom('mood:checkin')──►   │
        │  reads MoodSchedule.model (Mongo)                                              │
        └───────────────┬───────────────────────────────────────┬────────────────────────┘
                        │                                         │
                        ▼                                         ▼
        ┌────────────────────────────┐          ┌────────────────────────────────────────┐
        │  AI SERVICE (Python)       │          │  DATABASE (MongoDB)                      │
        │  FastAPI :8001             │          │   • AIMood                               │
        │   main.py /emotion/analyze │          │   • MoodSchedule                         │
        │   inference.py (singleton) │          │   • Mood                                 │
        │   model.py (Wav2Vec2+MFCC) │          │   • Notification                         │
        │   models/best.pt           │          │   • Patient / Family / Doctor (refs)     │
        └────────────────────────────┘          └────────────────────────────────────────┘
```

### Every connection explained

| Connection | Protocol | Auth | File(s) |
|---|---|---|---|
| Patient device → backend `/analyze` | HTTP POST (multipart) | Patient JWT (`protectPatient`) | [api.js:331](frontend/src/modules/shared/api/api.js#L331) → [aiMood.routes.js:54](backend/modules/aiMood/aiMood.routes.js#L54) |
| Family/Doctor → backend `/mood-checkin/*` | HTTP | Doctor or Family JWT (`protectDoctorOrFamily`) | [api.js:300-337](frontend/src/modules/shared/api/api.js#L300-L337) |
| Doctor/Family → backend `/moods/*` | HTTP | Doctor or Family JWT | [api.js:214-226](frontend/src/modules/shared/api/api.js#L214-L226) |
| Backend → Python AI service | HTTP POST (axios + form-data) | **None** (localhost, unauthenticated) | [emotion.service.js:55](backend/modules/aiMood/emotion.service.js#L55) |
| Backend → MongoDB | Mongoose | connection string | all `*.model.js` |
| Scheduler → Patient device | Socket.IO `mood:checkin` | room membership only | [moodCheckin.scheduler.js:92](backend/modules/aiMood/moodCheckin.scheduler.js#L92) |
| Backend → Family/Patient device | Socket.IO `mood:updated` | room membership only | [aiMood.controller.js:296](backend/modules/aiMood/aiMood.controller.js#L296) |
| Frontend ↔ backend sockets | WebSocket/polling | room `patient:{id}` | [socketClient.js](frontend/src/modules/shared/socket/socketClient.js), [socketManager.js](backend/modules/socket/socketManager.js) |

---

## 3. End-to-End Flow

### 3A. AI Mood — full lifecycle (scheduled voice check-in)

```
1. SCHEDULE CREATION
   Family opens family/PatientMood.jsx → SchedulePanel
   → aiMoodAPI.setSchedule({patientId, scheduledTimes:["09:00","20:00"], isActive})
   → POST /api/mood-checkin/schedule  (protectDoctorOrFamily)
   → aiMood.controller.setSchedule()
       validates HH:MM, dedupes, MoodSchedule.findOneAndUpdate(upsert)
       calls rescheduleForPatient(patientId)   (clears in-memory locks)

2. CRON FIRES
   moodCheckin.scheduler.js: cron '* * * * *' (UTC) → scanAndSchedule()
   → MoodSchedule.find({isActive:true}).populate('patientId')
   → for each slot, msUntil(slotTime) within [-10s, +60s] window?
   → setTimeout(delay) → emitToPatientRoom(patientId,'mood:checkin',{scheduledTime,prompt})
   → marks triggeredToday[`${patientId}:${HH:MM}`] = true

3. PATIENT DEVICE RECEIVES EVENT
   PatientPage.jsx → useMoodCheckin(patientId) listens 'mood:checkin'
   → dedup via module-level shownSlots Set (key `YYYY-MM-DD:HH:MM`)
   → setActiveCheckin(payload) → renders <MoodCheckinModal>

4. RECORDING (MoodCheckinModal.jsx)
   PHASE.SPEAKING  → speak(prompt) via Web Speech API (TTS)
   PHASE.RECORDING → getUserMedia({audio}) → MediaRecorder (WebM/Opus, 250ms slices, 12s)
                     12s countdown → requestData() → stop()
   onstop → Blob(chunks) → submitAudio()
   PHASE.PROCESSING → convertBlobToWAV() via Web Audio API (decodeAudioData → 16-bit PCM WAV)
                      (on failure: sends original WebM)
   → FormData('audio', wav, 'mood_checkin.wav') (+ scheduledTime)
   → aiMoodAPI.analyzeAudio(formData)  (Patient JWT)

5. BACKEND /analyze
   aiMood.routes.js → multer.single('audio') (memoryStorage, 25MB, audio/* filter)
   → aiMood.controller.analyzeAndSave()
       STEP A: validate req.file & buffer
       STEP B: emotion.service.analyzeEmotion(buffer, mime, name)
               → axios POST http://localhost:8001/emotion/analyze (form-data)

6. PYTHON AI SERVICE (main.py /emotion/analyze)
   STEP1: read upload bytes
   STEP2: _load_audio() → tempfile → librosa.load(sr=16000) (fallback soundfile)
   STEP3: silence gate (RMS<0.001 → neutral@0.0), length gate (<0.5s → neutral@0.0), peak-normalize
   STEP4: inference.predict_from_audio(audio)
          feature_extractor(wav) + extract_mfcc(audio) → EmotionModel(wav, mfcc)
          probs = softmax(logits / 1.7); idx = argmax; confidence = probs[idx]
   STEP5: return {emotion, confidence, all_scores}
   (temp file deleted in finally)

7. BACKEND PERSIST + EMIT
   STEP C: AIMood.create({patientId, emotion, confidence, allScores, scheduledTime, source})
           pre-save hook sets isAbnormal = ALERT_EMOTIONS.has(emotion) || confidence < 0.35
   STEP D: emitToPatientRoom(patientId,'mood:updated',{mood})
   STEP E: 201 { success, data: aiMood }
   *** NO notification is created here ***

8. UI UPDATE
   Patient: MoodCheckinModal PHASE.DONE → shows emoji+label+confidence, speaks result
   Family:  family/PatientMood.jsx 'mood:updated' listener → setLatestMood + prepend timeline
            shows "Alert" chip if mood.isAbnormal (but no notification was sent)
   Doctor:  sees nothing (no AI mood UI)
```

### 3B. Manual Mood — full lifecycle

```
1. Doctor/Family submits a mood form
   → moodsAPI.create(data) → POST /api/moods (protectDoctorOrFamily, validateMoodCreate)
2. mood.controller.createMoodEntry → mood.service.createMoodEntry
   - verifies patient access (doctor owns patient / family owns patient)
   - Mood.create(...) → pre-save sets isAbnormal (score<=3, abnormal mood/behavior, confused)
3. IF isAbnormal:
   Notification.createAbnormalMoodAlert(patient.doctor,'Doctor',patient,moodEntry)  priority:'high'
   mood.alertTriggered = true; save()
4. IF author is family:
   Notification.create({recipient: patient.doctor, type:'mood_entry', priority: high|low})
5. Doctor reads via usePatientData → moodsAPI.getByPatient/getStats → doctor/PatientMood.jsx
```

> **Key observation:** there is **no step in the AI path that mirrors steps 3–4 of the manual path**. The AI abnormality is computed and stored but never escalated.

---

## 4. File-by-File Analysis

### Backend — AI Mood module (`backend/modules/aiMood/`)

#### [aiMood.controller.js](backend/modules/aiMood/aiMood.controller.js)
- **Purpose:** HTTP handlers for AI mood schedules, history, stats, service health, and the audio-analysis pipeline.
- **Functions:**
  - `setSchedule` (L30) — upserts a `MoodSchedule`; accepts `scheduledTimes[]` or legacy `scheduledTime`; validates `HH:MM`; dedupes; family-only ownership check (no doctor check); calls `rescheduleForPatient`.
  - `getSchedule` (L103) — returns the patient's schedule; family ownership check only.
  - `getHistory` (L122) — `AIMood.find` by `patientId` + `recordedAt >= now-days`; family check only.
  - `getLatest` (L146) — most recent `AIMood`; family check only.
  - `getStats` (L163) — calls `AIMood.getStats` aggregation; family check only.
  - `getServiceStatus` (L186) — proxies `checkEmotionService()`.
  - `analyzeAndSave` (L206) — the core pipeline (STEP A–E). Validates the file, calls the Python service, saves `AIMood`, emits `mood:updated`, returns 201. **Never creates a notification.**
- **Connects to:** `AIMood.model`, `MoodSchedule.model`, `emotion.service`, `socketManager` (`emitToPatientRoom`), `moodCheckin.scheduler` (`rescheduleForPatient`).

#### [aiMood.routes.js](backend/modules/aiMood/aiMood.routes.js)
- **Purpose:** Express router mounted at `/api/mood-checkin`.
- **Contains:** multer config (`memoryStorage`, 25MB, `audio/*`|`application/octet-stream`|known extensions); route table; an inline multer-error-to-JSON wrapper for `/analyze`.
- **Routes:** `GET /service-status`, `POST /schedule`, `GET /schedule/:patientId`, `GET /history/:patientId`, `GET /latest/:patientId`, `GET /stats/:patientId` (all `protectDoctorOrFamily`); `POST /analyze` (`protectPatient` + multer).
- **Connects to:** `familyAuth.middleware` (`protectDoctorOrFamily`), `patientAuth.middleware` (`protectPatient`), controller.

#### [AIMood.model.js](backend/modules/aiMood/AIMood.model.js)
- **Purpose:** Mongoose model for one AI voice check-in result.
- **Schema fields:** `patientId` (ref Patient, indexed), `emotion` (enum of 8), `confidence` (0–1), `allScores` (Map<String,Number>), `scheduledTime` (String), `triggeredAt` (Date), `source` (default `voice_ai_checkin`), `isAbnormal` (Boolean). `timestamps: {createdAt:'recordedAt', updatedAt:false}`.
- **Constants:** `EMOTION_LABELS` (8), `ALERT_EMOTIONS = {sad, angry, fear, disgust}`.
- **Hook:** `pre('save')` sets `isAbnormal = ALERT_EMOTIONS.has(emotion) || confidence < 0.35`.
- **Indexes:** `{patientId:1}` (field-level) + compound `{patientId:1, recordedAt:-1}`.
- **Statics:** `getHistory`, `getLatest`, `getStats` (aggregation grouping by emotion with count + avgConfidence).

#### [MoodSchedule.model.js](backend/modules/aiMood/MoodSchedule.model.js)
- **Purpose:** One schedule document per patient.
- **Fields:** `patientId` (ref Patient, **unique**, indexed), `scheduledTimes` ([String], 1–6 `HH:MM`, default `['09:00']`, custom validator), `isActive` (Boolean), `createdBy` (refPath `createdByModel`), `createdByModel` (enum Doctor|Family). `timestamps: true`.

#### [emotion.service.js](backend/modules/aiMood/emotion.service.js)
- **Purpose:** Node→Python HTTP client.
- **Config:** `EMOTION_SERVICE_URL` (env or `http://localhost:8001`), `TIMEOUT_MS = 45000`.
- **Functions:**
  - `analyzeEmotion(buffer, mime, filename)` (L26) — builds `form-data`, POSTs `/emotion/analyze`, returns `{emotion, confidence, allScores, note}`; classifies errors (HTTP vs ECONNREFUSED vs timeout).
  - `checkEmotionService()` (L111) — GET `/health`, returns `{healthy, latencyMs, error}` (never throws).
  - `isEmotionServiceHealthy()` (L132) — backward-compat boolean wrapper.

#### [moodCheckin.scheduler.js](backend/modules/aiMood/moodCheckin.scheduler.js)
- **Purpose:** node-cron driver that emits `mood:checkin` at scheduled times.
- **State (in-memory):** `triggeredToday` Map (key `patientId:HH:MM`), `pendingTimers` Map.
- **Functions:**
  - `msUntil(time)` (L37) — ms until `HH:MM` today via `new Date().setHours` (server-local); returns `null` outside the [-10s, +60s] window.
  - `scanAndSchedule()` (L49) — loads active schedules, schedules `setTimeout` per due slot, emits `mood:checkin`.
  - `resetDailyTriggers()` (L113) — clears both maps at UTC midnight.
  - `startMoodCheckinScheduler()` (L132) — registers cron `* * * * *` and `0 0 * * *` (both `timezone:'UTC'`); runs one immediate scan.
  - `rescheduleForPatient(patientId)` (L148) — clears that patient's timers/locks after a schedule change.
- **Connects to:** `MoodSchedule.model`, `socketManager`.

### Backend — Manual Mood

#### [models/Mood.model.js](backend/models/Mood.model.js)
- **Purpose:** Rich manual mood record.
- **Fields:** `patient` (ref Patient), `recordedBy` (refPath `recordedByModel`), `recordedByModel` (Doctor|Family), `mood` (enum of 10), `moodScore` (1–10), `energy`, nested `sleep{quality,hours,disturbances}`, `appetite`, nested `cognitiveState{clarity,recognition,communication}`, `physicalSymptoms[]`, `behaviors[]`, `activities[]`, `notes` (≤2000), `isAbnormal`, `alertTriggered`, `recordedAt`, nested `location`. `timestamps:true`.
- **Hook:** `pre('save')` sets `isAbnormal` if `moodScore<=3` OR mood ∈ {very_sad, anxious, agitated, confused} OR behavior ∈ {wandering, aggression, sundowning} OR `cognitiveState.clarity==='confused'`.
- **Indexes:** `{patient:1, recordedAt:-1}`, `{patient:1, isAbnormal:1}`, `{recordedBy:1}`.
- **Statics:** `getMoodHistory`, `getMoodStats`.

#### [controllers/mood.controller.js](backend/controllers/mood.controller.js)
- **Purpose:** Thin controller delegating to `mood.service`.
- **Methods:** `createMoodEntry`, `getMoodHistory`, `getMoodEntry`, `updateMoodEntry`, `deleteMoodEntry`, `getMoodStats`, `getAbnormalMoods`. Resolves `userId` from `req.doctor?._id || req.family?._id` and `userRole` from `req.userRole`.

#### [services/mood.service.js](backend/services/mood.service.js)
- **Purpose:** Business logic + access control + notification creation for manual moods.
- **Methods:** `createMoodEntry` (access check → `Mood.create` → abnormal alert + family→doctor notification), `getMoodHistory` (paginated), `getMoodById`, `updateMoodEntry` (recorder-only), `deleteMoodEntry` (doctor any / family own), `getMoodStats` (avg, distribution, daily trend, recent behaviors), `getAbnormalMoods`.
- **Connects to:** `Mood`, `Patient`, `Family`, `Notification`.

#### [routes/mood.routes.js](backend/routes/mood.routes.js)
- **Purpose:** Router at `/api/moods`.
- **Routes:** `POST /` (+`validateMoodCreate`), `GET /patient/:patientId`, `GET /patient/:patientId/stats`, `GET /patient/:patientId/abnormal`, `GET /:id`, `PUT /:id`, `DELETE /:id` — **all `protectDoctorOrFamily`** (note: DELETE is labeled "Doctor-only" in a comment but uses the combined guard).

### Cross-cutting backend

#### [modules/socket/socketManager.js](backend/modules/socket/socketManager.js)
- **Purpose:** Singleton Socket.IO server + room helpers.
- **Functions:** `initIO(httpServer)` (CORS allowlist of localhost origins; `join:patient-room` handler), `getIO()`, `emitToPatientRoom(patientId, event, payload)`, `emitNotification(patientId, notification)`.
- **Room convention:** `patient:{patientId}` joined by both patient and family clients.

#### [models/Notification.model.js](backend/models/Notification.model.js)
- **Purpose:** Generic notification model.
- **Relevant types:** `mood_abnormal`, `mood_entry` (in the `type` enum).
- **Static `createAbnormalMoodAlert(recipientId, recipientModel, patient, moodEntry)`** (L119) — creates a `mood_abnormal` notification (priority `'high'`) referencing the **manual** `Mood` (uses `moodEntry.mood`, `moodEntry.moodScore`, `moodEntry.behaviors`). **Only called from `mood.service`.**

#### [middlewares/patientAuth.middleware.js](backend/middlewares/patientAuth.middleware.js)
- `protectPatient` — verifies JWT, requires `role==='patient'`, loads `Patient`, checks `isActive`, sets `req.patient/req.user/req.userRole`. Does **not** set `req.patientId`.

#### [middlewares/familyAuth.middleware.js](backend/middlewares/familyAuth.middleware.js)
- `protectFamily`, `generateFamilyToken`, `checkFamilyPermission`, and `protectDoctorOrFamily` (L132) — the combined guard that tries doctor → family → patient tokens. For family/patient it sets `req.patientId`; for **doctor it does not**.

#### [middlewares/validation.middleware.js](backend/middlewares/validation.middleware.js)
- `validateMoodCreate` (L249) — express-validator chain for the manual mood form (`patientId` MongoId, `mood` enum, `moodScore` 1–10, optional `energy`, optional `notes` ≤2000). No equivalent validator exists for the AI path.

#### [server.js](backend/server.js)
- Mounts `/api/moods` (L69) and `/api/mood-checkin` (L80); calls `startMoodCheckinScheduler()` (L144) after DB connect.

### AI Service (`emotion_project/`)

#### [main.py](emotion_project/main.py)
- **Purpose:** FastAPI microservice (port 8001). This is the file the backend actually calls.
- **Endpoints:** `GET /health` (reports `model_loaded`), `POST /emotion/analyze` (5-step traced pipeline).
- **Helpers:** `_load_audio(content, suffix)` (librosa → soundfile fallback), startup warm-up (`get_model()`).
- **CORS:** `allow_origins=["*"]` + `allow_credentials=True`.

#### [inference.py](emotion_project/inference.py)
- **Purpose:** Lazy-singleton model loader + `predict_from_audio`.
- **Globals:** `SR=16000`, `LABELS` (8). `_load_model()` builds `EmotionModel`, loads `models/best.pt|last.pt|emotion_model.pt` with `weights_only=True`, `strict=True`. `predict_from_audio(audio)` returns `{emotion, confidence, all_scores}` using `softmax(logits/1.7)`.

#### [model.py](emotion_project/model.py)
- **Purpose:** PyTorch architecture + feature helpers.
- **Module-level:** downloads `facebook/wav2vec2-base` (feature extractor + model) at import.
- **`extract_mfcc(audio, sr)`** — pre-emphasis → 40 MFCCs → mean over time → z-normalize → vector(40).
- **Classes:** `MFCCNet` (40→128→128), `AudioEncoder` (Wav2Vec2 with first 6 encoder layers frozen, mean-pooled → 768), `CrossAttentionFusion` (q/k/v projections, **element-wise** "attention", concat → 1024), `EmotionModel` (classifier 1024→512→256→**8**).

#### [app.py](emotion_project/app.py)
- **Purpose:** Standalone CLI microphone loop (sounddevice). **Not imported by the service.** Loads model at import via `load_model()` (uses `torch.load` **without** `weights_only`), records 3s windows, applies live/temporal smoothing. Divergent, redundant second inference path.

#### [train.py](emotion_project/train.py)
- **Purpose:** Training script. Loads `anton-l/superb_demo` config `"er"` (SUPERB Emotion Recognition / IEMOCAP-derived), AdamW lr 3e-5, CrossEntropyLoss(label_smoothing=0.1), 30 epochs, batch size 1, saves on best **training** loss. No validation split, no metrics.

#### [models/best.pt](emotion_project/models/), [models/last.pt](emotion_project/models/)
- Trained checkpoints. Present on disk in this working tree (git-tracking status not independently verified — see §16).

### Frontend

#### [features/patient/components/MoodCheckinModal.jsx](frontend/src/features/patient/components/MoodCheckinModal.jsx)
- **Purpose:** The patient-facing recording modal (state machine SPEAKING→RECORDING→PROCESSING→DONE|ERROR).
- **Key pieces:** `pickMimeType()` (isTypeSupported fallback chain), `convertBlobToWAV()` (Web Audio decode → 16-bit PCM WAV encoder), `submitAudio()`, `startRecording()` (getUserMedia + MediaRecorder, 12 s), the TTS-then-record `useEffect`, and the render branches. Emotion display config `EMOTION_CFG` (8 emotions).

#### [features/patient/hooks/useMoodCheckin.js](frontend/src/features/patient/hooks/useMoodCheckin.js)
- **Purpose:** Listens for `mood:checkin`, dedupes per `YYYY-MM-DD:HH:MM` via a module-level `Set`, exposes `{activeCheckin, dismissCheckin, checkinDone}`.

#### [modules/patient/pages/PatientPage.jsx](frontend/src/modules/patient/pages/PatientPage.jsx)
- **Purpose:** Patient dashboard; wires `useMoodCheckin` and conditionally renders `<MoodCheckinModal>` (L254).

#### [features/family/patients/components/PatientMood.jsx](frontend/src/features/family/patients/components/PatientMood.jsx)
- **Purpose:** Family AI-emotion dashboard. Sub-components: `SchedulePanel` (multi-slot editor), `LatestMoodCard`, `StatsPanel` (emotion breakdown bars), `TimelineEntry`. Fetches via `aiMoodAPI` (history/latest/stats/schedule) and subscribes to `mood:updated` for live updates. `EMOTION_CONFIG` marks `sad/angry/fear/disgust` with `alert:true`.

#### [features/family/patients/hooks/useFamilyPatientData.js](frontend/src/features/family/patients/hooks/useFamilyPatientData.js)
- **Purpose:** Aggregates family patient data; for mood it calls **only** `aiMoodAPI` (history/stats/latest/schedule).

#### [features/doctor/patients/components/PatientMood.jsx](frontend/src/features/doctor/patients/components/PatientMood.jsx)
- **Purpose:** Doctor manual-mood dashboard. Renders `moodStats` cards (total/average/abnormal/abnormal%) + a list of manual entries with `getMoodEmoji` (10 manual moods) and a delete button (`window.confirm`). Receives `moodHistory`/`moodStats` as props.

#### [features/doctor/patients/hooks/usePatientData.js](frontend/src/features/doctor/patients/hooks/usePatientData.js)
- **Purpose:** Loads doctor patient data; for mood calls **only** `moodsAPI.getByPatient` + `moodsAPI.getStats`.

#### [features/doctor/patients/pages/PatientDetails.jsx](frontend/src/features/doctor/patients/pages/PatientDetails.jsx)
- Renders `<PatientMood moodHistory moodStats onRefresh>` (L122). No AI mood component.

#### [modules/shared/api/api.js](frontend/src/modules/shared/api/api.js)
- **Purpose:** Central API client with role-pinned token helpers. `moodsAPI` (L214, manual) and `aiMoodAPI` (L300, AI). `aiMoodAPI.analyzeAudio` sends FormData with the **patient** token; `getLatest` uses the active-role token; the rest use doctor-or-family.

#### [modules/shared/socket/socketClient.js](frontend/src/modules/shared/socket/socketClient.js)
- **Purpose:** Singleton Socket.IO client (`VITE_SOCKET_URL` or `http://localhost:5001`); `getSocket`, `joinPatientRoom`, `disconnectSocket`.

---

## 5. API Documentation

### AI Mood endpoints — prefix `/api/mood-checkin`

#### `POST /schedule`
- **Controller:** `setSchedule` · **Auth:** `protectDoctorOrFamily` (doctor or family)
- **Body:** `{ patientId, scheduledTimes: ["HH:MM", ...] | scheduledTime: "HH:MM", isActive? }`
- **Validation:** non-empty `patientId` + ≥1 time; each matches `/^\d{2}:\d{2}$/`; 1–6 slots (model validator); dedup + sort.
- **Authorization:** family must own the patient (`req.patientId === patientId`); **doctor: none.**
- **Response:** `200 { success, message, data: <MoodSchedule> }` (200 even on upsert-create).

#### `GET /schedule/:patientId`
- **Controller:** `getSchedule` · **Auth:** `protectDoctorOrFamily` · **Authorization:** family ownership only.
- **Response:** `200 { success, data: <MoodSchedule|null> }`.

#### `GET /history/:patientId?days=30&limit=50`
- **Controller:** `getHistory` · **Auth:** `protectDoctorOrFamily` · **Params:** `days` capped 365, `limit` capped 200. · **Authorization:** family ownership only.
- **Response:** `200 { success, data: [<AIMood>], count }`.

#### `GET /latest/:patientId`
- **Controller:** `getLatest` · **Auth:** `protectDoctorOrFamily` · **Authorization:** family ownership only.
- **Response:** `200 { success, data: <AIMood|null> }`.
- **Frontend caveat:** `aiMoodAPI.getLatest` uses the **active-role token** (`apiRequest`), so it can also be called by a patient session.

#### `GET /stats/:patientId?days=30`
- **Controller:** `getStats` · **Auth:** `protectDoctorOrFamily` · **Authorization:** family ownership only.
- **Response:** `200 { success, data: { breakdown:[{_id:emotion,count,avgConfidence}], totalEntries, days } }`.

#### `GET /service-status`
- **Controller:** `getServiceStatus` · **Auth:** `protectDoctorOrFamily`.
- **Response:** `200|503 { success, data: { healthy, latencyMs, error } }`.

#### `POST /analyze`
- **Controller:** `analyzeAndSave` · **Auth:** `protectPatient` (patient JWT only).
- **Body:** `multipart/form-data`, field **`audio`** (file), optional `scheduledTime`.
- **Validation:** multer `audio/*`|`application/octet-stream`|known extensions, ≤25MB; controller checks non-empty buffer.
- **`patientId`:** taken from `req.user._id` (the token), **not** the body.
- **Responses:** `201 { success, message, data:<AIMood> }`; `400` (no file/empty buffer); `413` (>25MB); `502` (Python error); `503` (Python offline, includes restart hint).

### Manual Mood endpoints — prefix `/api/moods` (all `protectDoctorOrFamily`)

| Route | Method | Controller | Body / Notes |
|---|---|---|---|
| `/` | POST | `createMoodEntry` | `validateMoodCreate`; `{patientId, mood, moodScore, energy?, sleep?, appetite?, cognitiveState?, physicalSymptoms?, behaviors?, activities?, notes?, recordedAt?, location?}` |
| `/patient/:patientId` | GET | `getMoodHistory` | `?days&limit&page`; paginated; access-checked in service |
| `/patient/:patientId/stats` | GET | `getMoodStats` | `?days`; avg/distribution/trend/behaviors |
| `/patient/:patientId/abnormal` | GET | `getAbnormalMoods` | `?days`; `isAbnormal:true` only |
| `/:id` | GET | `getMoodEntry` | populates patient + recorder |
| `/:id` | PUT | `updateMoodEntry` | recorder-only; strips restricted fields |
| `/:id` | DELETE | `deleteMoodEntry` | doctor any-owned / family own-created |

**Manual authorization** (enforced in `mood.service`): doctor must own the patient (`patient.doctor === userId`); family must be linked (`family.patient === patientId`).

---

## 6. Database Analysis

### `AIMood` ([AIMood.model.js](backend/modules/aiMood/AIMood.model.js))

| Field | Type | Notes |
|---|---|---|
| `patientId` | ObjectId→Patient | required, indexed |
| `emotion` | String enum(8) | neutral/happy/sad/angry/fear/disgust/surprise/bored |
| `confidence` | Number 0–1 | required |
| `allScores` | Map<String,Number> | optional raw probabilities |
| `scheduledTime` | String | originating `HH:MM` slot, or null |
| `triggeredAt` | Date | default now |
| `source` | String | default `voice_ai_checkin` |
| `isAbnormal` | Boolean | set by pre-save hook |
| `recordedAt` | Date | `createdAt` alias (timestamps) |

- **Indexes:** `{patientId:1}`, `{patientId:1, recordedAt:-1}`. · **Relationships:** `patientId → Patient`. · **Used by:** `aiMood.controller`, family dashboard (read).

### `MoodSchedule` ([MoodSchedule.model.js](backend/modules/aiMood/MoodSchedule.model.js))

| Field | Type | Notes |
|---|---|---|
| `patientId` | ObjectId→Patient | required, **unique**, indexed (one per patient) |
| `scheduledTimes` | [String] | 1–6 `HH:MM`, default `['09:00']` |
| `isActive` | Boolean | default true |
| `createdBy` | ObjectId (refPath) | Doctor or Family |
| `createdByModel` | String enum | Doctor|Family |

- **Used by:** `setSchedule`/`getSchedule`, `scanAndSchedule` (reads all `isActive:true`).

### `Mood` ([Mood.model.js](backend/models/Mood.model.js))
- Rich schema (see §4). **Indexes:** `{patient:1, recordedAt:-1}`, `{patient:1, isAbnormal:1}`, `{recordedBy:1}`. · **Relationships:** `patient → Patient`, `recordedBy → Doctor|Family`. · **Used by:** `mood.service`, doctor dashboard.

### `Notification` ([Notification.model.js](backend/models/Notification.model.js))
- **Relevant types:** `mood_abnormal`, `mood_entry`. **Fields:** `recipient`(refPath), `recipientModel`(Doctor|Family), `patient`, `type`, `priority`(low/medium/high/urgent), `title`, `message`, `data`(Mixed), `isRead`, `readAt`, `isArchived`, `expiresAt`.
- **Indexes:** `{recipient:1,isRead:1,createdAt:-1}`, `{recipientModel:1,type:1}`, `{patient:1}`. · **Used by (mood):** only `mood.service`.

### Cross-collection data flow
```
MoodSchedule ──(scheduler reads)──► emits socket ──► AIMood (written by /analyze)
                                                          └─(read by family dashboard)
Mood (written by /moods) ──(abnormal/family)──► Notification ──(read by doctor/family notif UI)

AIMood ──✗──► Notification          (NO LINK — the AI path never writes Notification)
AIMood ──✗──► doctor dashboard      (NO LINK — doctor reads only Mood)
Mood   ──✗──► family mood dashboard (NO LINK — family mood UI reads only AIMood)
```

---

## 7. AI Pipeline Analysis

### Step-by-step (how one prediction is produced)
1. **Upload decode** ([main.py `_load_audio`](emotion_project/main.py#L90)) — bytes → tempfile → `librosa.load(sr=16000, mono=True)`; on failure falls back to `soundfile` (+ resample). Requires ffmpeg for WebM/OGG/MP4; WAV decodes without ffmpeg.
2. **Quality gates** ([main.py:207-236](emotion_project/main.py#L207-L236)) — RMS<0.001 → `neutral@0.0` (`silence_detected`); duration<0.5 s → `neutral@0.0` (`audio_too_short`); else **peak-normalize** to [-1,1].
3. **Feature extraction:**
   - **Wav2Vec2 branch** ([model.py:49-61](emotion_project/model.py#L49-L61)) — `feature_extractor(audio)` → `wav2vec2-base` (first 6 of 12 encoder layers frozen) → `last_hidden_state.mean(dim=1)` → 768-d.
   - **MFCC branch** ([model.py:19-25](emotion_project/model.py#L19-L25)) — pre-emphasis → 40 MFCCs → mean over time → z-normalize → 40-d → `MFCCNet` → 128-d.
4. **Fusion** ([model.py:67-85](emotion_project/model.py#L67-L85)) — `CrossAttentionFusion`: `q=Wq(a)∈ℝ²⁵⁶`, `k=Wk(b)`, `v=Wv(b)`; `attn = softmax((q*k)*scale)` (**element-wise** product, not dot-product); `fused = attn*v`; output `concat(a, fused)` → 1024-d.
5. **Classification** ([model.py:99-110](emotion_project/model.py#L99-L110)) — 1024→512→256→**8** logits.
6. **Probabilities & confidence** ([inference.py:85-99](emotion_project/inference.py#L85-L99)) — `probs = softmax(logits / 1.7)`; `idx = argmax`; `confidence = probs[idx]`; `all_scores = {label: prob}`.
7. **Return** — `{emotion: LABELS[idx], confidence, all_scores}`.

### Training approach ([train.py](emotion_project/train.py))
- **Dataset:** `anton-l/superb_demo`, config `"er"` (SUPERB Emotion Recognition, IEMOCAP-derived — **acted adult** speech).
- **Loop:** batch size 1, AdamW lr 3e-5, weight decay 1e-2, `CrossEntropyLoss(label_smoothing=0.1)`, grad clip 1.0, 30 epochs.
- **Checkpointing:** saves on best **training** loss. **No validation split, no eval metrics, no test set.**

### Confidence calculation note
Confidence is the temperature-softened (`/1.7`) softmax probability of the argmax class. The temperature constant is uncalibrated (copied from `app.py`), so reported percentages are not probability-calibrated.

---

## 8. Emotion Mapping Analysis

### AI Mood — runtime labels (index order)

| Index | Label (inference/model/app) | Frontend config | "Alert" in family UI | In `ALERT_EMOTIONS` (backend) |
|---|---|---|---|---|
| 0 | neutral | 😐 Neutral | no | no |
| 1 | happy | 😊 Happy | no | no |
| 2 | sad | 😢 Sad | **yes** | **yes** |
| 3 | angry | 😠 Angry | **yes** | **yes** |
| 4 | fear | 😨 Fear | **yes** | **yes** |
| 5 | disgust | 🤢 Disgust | **yes** | **yes** |
| 6 | surprise | 😲 Surprise | no | no |
| 7 | bored | 😑 Bored | no | no |

- **Defined in:** [inference.py:17](emotion_project/inference.py#L17), [app.py:17](emotion_project/app.py#L17), [AIMood.model.js:13](backend/modules/aiMood/AIMood.model.js#L13), [MoodCheckinModal.jsx:153](frontend/src/features/patient/components/MoodCheckinModal.jsx#L153), [family/PatientMood.jsx:17](frontend/src/features/family/patients/components/PatientMood.jsx#L17). These five lists are **consistent** with each other (same 8 labels, same order).

### Manual Mood — labels (separate vocabulary)
`very_happy, happy, neutral, sad, very_sad, anxious, confused, agitated, calm, sleepy` ([Mood.model.js:21](backend/models/Mood.model.js#L21), [doctor/PatientMood.jsx:6](frontend/src/features/doctor/patients/components/PatientMood.jsx#L6), [validation.middleware.js:255](backend/middlewares/validation.middleware.js#L255)). **No overlap mapping** exists between the AI 8-class set and the manual 10-class set.

### Training-vs-runtime label verification (critical inconsistency)
- **Runtime classifier:** 8 classes ([model.py:109](emotion_project/model.py#L109) `Linear(256, 8)`).
- **Training dataset:** SUPERB `"er"` is a **4-class** problem (typically neutral, happy, sad, angry). `train.py` feeds `sample["label"]` directly into the 8-logit head.
- **Consequence:** indices 4–7 (`fear, disgust, surprise, bored`) receive no training signal — untrained weights. The dataset's label index order is never asserted against the hardcoded `LABELS`, so even the four trained classes may be mapped to the wrong names.
- **Severity:** directly affects the labels the family UI flags as alerts (`fear`, `disgust` are in the untrained range). See Finding **C-1** (§15).

---

## 9. Notification Flow

### When notifications ARE created (manual path only)
```
mood.service.createMoodEntry()
  ├─ Mood.create() → pre-save sets isAbnormal
  ├─ IF isAbnormal:
  │     Notification.createAbnormalMoodAlert(patient.doctor,'Doctor',patient,moodEntry)
  │        → type:'mood_abnormal', priority:'high', recipient: the DOCTOR
  │     moodEntry.alertTriggered = true
  └─ IF author is family:
        Notification.create({recipient: patient.doctor, type:'mood_entry',
                             priority: isAbnormal ? 'high' : 'low'})
```
- **Recipient:** always the **doctor** (`patient.doctor`). The family is never a notification recipient for mood events.
- **Code:** [mood.service.js:46-75](backend/services/mood.service.js#L46-L75), [Notification.model.js:119-136](backend/models/Notification.model.js#L119-L136).

### When notifications are NOT created
- **AI Mood — never.** `analyzeAndSave` ([aiMood.controller.js:206](backend/modules/aiMood/aiMood.controller.js#L206)) creates no notification regardless of `isAbnormal`. It emits a `mood:updated` **socket event** (real-time UI refresh) but writes no `Notification` document and triggers no `emitNotification`.
- **Result:** abnormal AI emotions are invisible unless a family member happens to have the family `PatientMood.jsx` page open at that moment.

### Notification flow diagram
```
MANUAL MOOD
  caregiver form ─► /api/moods ─► mood.service
                                   │ isAbnormal? ──► Notification(mood_abnormal, →Doctor, high)
                                   │ family author? ► Notification(mood_entry,  →Doctor, low|high)
                                   ▼
                         Doctor notification UI (notificationsAPI)

AI MOOD
  patient voice ─► /analyze ─► AIMood.create (isAbnormal computed)
                                   │
                                   ├─► socket 'mood:updated' ─► family dashboard live refresh
                                   └─► (NO Notification document, NO emitNotification)  ✗
```

---

## 10. Scheduling Flow

### Lifecycle
```
1. Family sets schedule → MoodSchedule upserted → rescheduleForPatient() clears in-memory locks.
2. startMoodCheckinScheduler() (server boot) registers:
      cron '* * * * *'  (UTC) → scanAndSchedule()
      cron '0 0 * * *'  (UTC) → resetDailyTriggers()
   and runs one immediate scanAndSchedule().
3. Each minute, scanAndSchedule():
      - loads MoodSchedule.find({isActive:true}).populate('patientId')
      - skips orphan docs (deleted patient)
      - for each scheduledTimes[] slot:
          key = `${patientId}:${HH:MM}`
          skip if triggeredToday.has(key) or pendingTimers.has(key)
          delay = msUntil(slot)  (null unless within [-10s,+60s])
          setTimeout(delay): emit 'mood:checkin'; mark triggeredToday[key]=true
4. Patient device: useMoodCheckin dedups (YYYY-MM-DD:HH:MM) → MoodCheckinModal.
5. Midnight (UTC): resetDailyTriggers() clears triggeredToday + cancels pending timers.
```

### Reminder generation / session creation
- A "reminder" is purely the transient Socket.IO `mood:checkin` event ([scheduler.js:92](backend/modules/aiMood/moodCheckin.scheduler.js#L92)). **No persistent "check-in session" record is created** when a slot fires. The only durable artifact is the `AIMood` row produced **after** the patient completes recording.

### Missed sessions / retry behavior
- **None.** If the patient device is offline/disconnected when `mood:checkin` is emitted, the event is delivered to an empty room and lost. No pending-state, no retry, no "missed check-in" record, no missed-check-in notification. See Finding **H-3** (§15).

### Restart behavior
- **Schedules survive** (persisted in `MoodSchedule`, re-read each cron tick). **The "fired today" memory does not** (`triggeredToday` is in-process), so a restart can re-fire a slot whose time is still within the `msUntil` window. See Finding **H-2**.

---

## 11. Frontend Flow

### Patient view
- **Page:** [PatientPage.jsx](frontend/src/modules/patient/pages/PatientPage.jsx). **Hook:** `useMoodCheckin(patientId)`. **Component:** `MoodCheckinModal`.
- **State machine:** SPEAKING (TTS prompt) → RECORDING (12 s countdown + waveform) → PROCESSING (spinner) → DONE (emoji, label, confidence %, spoken result, "shared with care team" copy) or ERROR (message + dismiss).
- **APIs used:** `aiMoodAPI.analyzeAudio` (patient token).
- **What the patient sees:** the live check-in and its result. **No history, no stats, no schedule.**

### Family view
- **Component:** [family/PatientMood.jsx](frontend/src/features/family/patients/components/PatientMood.jsx). **Hook:** `useFamilyPatientData` (component also fetches directly via `fetchAll`).
- **Sections:** `SchedulePanel` (1–6 slot editor, active/paused toggle, save), `LatestMoodCard` (emoji + label + confidence bar + Alert chip), `StatsPanel` (per-emotion breakdown bars over 30 days), `TimelineEntry` list.
- **State management:** local `useState`; real-time `mood:updated` listener prepends new entries and flashes a "Live update!" badge.
- **APIs used:** `aiMoodAPI.getHistory/getLatest/getStats/getSchedule/setSchedule`.
- **What the family sees:** AI emotion data only. **No manual `Mood` entries.** No chart library — bars are CSS width %.

### Doctor view
- **Page:** [PatientDetails.jsx](frontend/src/features/doctor/patients/pages/PatientDetails.jsx). **Hook:** `usePatientData`. **Component:** [doctor/PatientMood.jsx](frontend/src/features/doctor/patients/components/PatientMood.jsx).
- **Sections:** stats cards (total, average score, abnormal count, abnormal %), entry list (manual mood emoji, score, date/time, notes, delete with `window.confirm`).
- **APIs used:** `moodsAPI.getByPatient/getStats/delete`.
- **What the doctor sees:** manual `Mood` data only. **No AI emotion data, no AI schedule control.**

### Role visibility matrix

| Data | Patient | Family | Doctor |
|---|---|---|---|
| AI check-in modal | ✅ | — | — |
| AI latest/timeline/stats | ❌ | ✅ | ❌ |
| AI schedule editor | ❌ | ✅ | ❌ (allowed by API, no UI) |
| Manual mood history/stats | ❌ | ❌ (not in mood UI) | ✅ |
| Mood notifications | ❌ | ❌ (recipient is doctor) | ✅ (manual only) |

---

## 12. Security Review

> Findings only — no fixes.

- **Authentication:** all mood endpoints require a valid JWT. `/analyze` uses `protectPatient` ([aiMood.routes.js:56](backend/modules/aiMood/aiMood.routes.js#L56)); management/read use `protectDoctorOrFamily`; `/api/moods/*` all use `protectDoctorOrFamily`. Anonymous audio upload is **not** possible.
- **Authorization — AI path:** `setSchedule/getSchedule/getHistory/getLatest/getStats` only verify ownership for the **family** branch (`req.userRole==='family' && req.patientId !== patientId`). For a **doctor**, there is **no check** that the patient belongs to that doctor; `protectDoctorOrFamily` sets no `req.patientId` for doctors. → **Potential IDOR:** any authenticated doctor can read/modify any patient's AI mood records and schedules by supplying an arbitrary `patientId`. (Finding **C-3**.)
- **Authorization — manual path:** `mood.service` enforces `patient.doctor === userId` (doctor) and `family.patient === patientId` (family) on every operation — correctly guarded.
- **`patientId` source on `/analyze`:** taken from the token (`req.user._id`), not the body — good.
- **Service-to-service trust:** Node→Python is **unauthenticated** plain HTTP on `localhost:8001` ([emotion.service.js:14](backend/modules/aiMood/emotion.service.js#L14)). If the Python port is reachable beyond localhost, anyone could submit audio or read `/health`. (Finding **M-3**.)
- **CORS on Python:** `allow_origins=["*"]` with `allow_credentials=True` ([main.py:52-58](emotion_project/main.py#L52-L58)) — spec-invalid combination; currently inert because browsers never call Python directly, but signals unintended exposure.
- **Data exposure / PHI:** emotion records (sensitive mental-health data) stored in plaintext Mongo; no field-level encryption. Raw audio is **not** persisted (multer memoryStorage; Python deletes its tempfile), limiting at-rest audio exposure but removing the ability to verify/relabel.
- **Token handling (frontend):** role-pinned tokens in `localStorage` prevent cross-role contamination ([api.js:108-128](frontend/src/modules/shared/api/api.js#L108-L128)); `getLatest` uses the active-role token so a patient session can call it.

---

## 13. Reliability Review

> Findings only — no fixes.

- **Restart loses dedup state:** `triggeredToday`/`pendingTimers` are in-memory ([scheduler.js:24-28](backend/modules/aiMood/moodCheckin.scheduler.js#L24-L28)); a restart within a slot's `msUntil` window can re-fire it → duplicate prompt. (Finding **H-2**.)
- **Timezone mismatch:** cron registered as UTC, but `msUntil` computes targets with `new Date().setHours` (**server-local**) ([scheduler.js:39-41](backend/modules/aiMood/moodCheckin.scheduler.js#L39-L41)); the daily reset runs at **UTC** midnight. On a non-UTC server, boundary slots can double-fire or be skipped, and the **patient's own timezone is never modeled**. (Finding **H-4**.)
- **Offline patient:** `mood:checkin` is fire-and-forget; no delivery guarantee, no retry, no missed-state. (Finding **H-3**.)
- **Inverted abnormal rule / non-readings stored:** `isAbnormal = ... || confidence < 0.35` ([AIMood.model.js:79](backend/modules/aiMood/AIMood.model.js#L79)) flags low-confidence and **silence** (`neutral@0.0`) as abnormal; silence/too-short results are still `AIMood.create`'d (the `note` is dropped before persistence at [aiMood.controller.js:267](backend/modules/aiMood/aiMood.controller.js#L267)), polluting timeline and stats. (Findings **C-4**, **H-5**.)
- **No upper audio-length bound:** Python rejects <0.5 s but not long clips ([main.py:224](emotion_project/main.py#L224)); a multi-minute upload (≤25 MB) runs full Wav2Vec2 on CPU → latency/OOM risk. (Finding **M-1**.)
- **WebM decode dependency:** client converts to WAV but falls back to raw WebM on failure ([MoodCheckinModal.jsx:286](frontend/src/features/patient/components/MoodCheckinModal.jsx#L286)); server needs ffmpeg for WebM → potential 422 on hosts without ffmpeg. (Finding **M-2**.)
- **No alert dedup/batching:** manual path creates one notification per abnormal entry ([mood.service.js:47](backend/services/mood.service.js#L47)); repeated abnormal moods → notification storm. (Finding **H-6**.)
- **Single concurrent check-in:** `useMoodCheckin` does not queue overlapping slots ([useMoodCheckin.js:77-79](frontend/src/features/patient/hooks/useMoodCheckin.js#L77-L79)); if two slots coincide, the second is effectively skipped that minute.
- **Silent model-load failure at startup:** `main.py` keeps the server up with `/health` `degraded` on load error ([main.py:70-72](emotion_project/main.py#L70-L72)); `/analyze` then fails per-request (Node returns 503 with a restart hint).
- **Unexpected label → 500:** if Python returns a label outside the enum, `AIMood.create` throws → 500 ([aiMood.controller.js:285](backend/modules/aiMood/aiMood.controller.js#L285)). Today the lists match, so this is latent.

---

## 14. Data Flow Diagrams

### Audio flow
```
Mic ─getUserMedia→ MediaRecorder(WebM/Opus,12s) ─chunks→ Blob
   ─decodeAudioData→ Float32 PCM ─encodePCMtoWAV→ WAV(16-bit,mono)
   ─FormData('audio')→ POST /analyze ─multer(memory)→ Buffer
   ─form-data axios→ Python /emotion/analyze ─tempfile→ librosa/soundfile→ np.float32@16kHz
   ─(silence/length gate, normalize)→ model input  ─(tempfile deleted)
```

### Prediction flow
```
audio ┬─ feature_extractor → Wav2Vec2(6 frozen) → mean → 768
      └─ extract_mfcc(40) → MFCCNet → 128
   → CrossAttentionFusion(concat) → 1024 → classifier → 8 logits
   → softmax(/1.7) → argmax → {emotion, confidence, all_scores}
```

### Notification flow
```
MANUAL: Mood.isAbnormal ─► Notification(mood_abnormal→Doctor,high)
        family author    ─► Notification(mood_entry→Doctor)
AI:     AIMood.isAbnormal ─► (nothing)   ✗   only socket 'mood:updated'
```

### Dashboard flow
```
AIMood ──aiMoodAPI──► family/PatientMood.jsx  (+ socket mood:updated live)
Mood   ──moodsAPI───► doctor/PatientMood.jsx
(no component reads both; patient reads neither as history)
```

### Database flow
```
MoodSchedule ─(scheduler)→ socket mood:checkin → patient records → /analyze → AIMood
Mood ─(service)→ Notification
Patient ◄─ref── AIMood, MoodSchedule, Mood, Notification
Doctor/Family ◄─refPath── Mood.recordedBy, MoodSchedule.createdBy, Notification.recipient
```

---

## 15. Current Problems & Findings

> **Confirmed Findings.** Severity, description, location, snippet, why it's a problem, impact. **No fixes implemented.**

### 🔴 Critical

**C-1 — Classifier head (8 classes) trained on a 4-class dataset; index→label mapping unverified**
- **File/function:** [train.py](emotion_project/train.py) (dataset `superb_demo/er`) vs [model.py `EmotionModel`](emotion_project/model.py#L109) (`Linear(256, 8)`), [inference.py `LABELS`](emotion_project/inference.py#L17).
- **Snippet:** `nn.Linear(256, 8)` fed by `loss_fn(out, label)` where `label` comes from a 4-class SUPERB ER dataset.
- **Why a problem:** indices 4–7 (`fear, disgust, surprise, bored`) get no gradient; the dataset label order is never asserted against `LABELS`.
- **Impact:** `fear`/`disgust` (untrained) are exactly the classes the family UI flags as alerts; predictions for them are meaningless and the four trained classes may be mislabeled.

**C-2 — AI abnormal moods never generate a notification**
- **File/function:** [aiMood.controller.js `analyzeAndSave`](backend/modules/aiMood/aiMood.controller.js#L206).
- **Snippet:** STEP C `AIMood.create(...)` → STEP D `emitToPatientRoom('mood:updated')` → STEP E `201`. No `Notification` write.
- **Why a problem:** abnormality is computed (`isAbnormal`) and shown as an "Alert" chip but nobody is actively notified.
- **Impact:** distress detected by the AI is silent unless a family member is watching the page; the doctor never learns of it.

**C-3 — Broken access control (IDOR) on AI mood endpoints for doctors**
- **File/function:** [aiMood.controller.js](backend/modules/aiMood/aiMood.controller.js) `setSchedule`/`getSchedule`/`getHistory`/`getLatest`/`getStats`.
- **Snippet:** `if (req.userRole === 'family' && req.patientId?.toString() !== patientId) {...403...}` — no doctor branch; `protectDoctorOrFamily` sets no `req.patientId` for doctors.
- **Why a problem:** doctors are trusted with any `patientId` from the URL/body.
- **Impact:** any authenticated doctor can read/modify any patient's AI emotion records and schedules (PHI exposure across clinics).

**C-4 — Abnormal rule flags low-confidence and silence as abnormal (inverted logic)**
- **File/function:** [AIMood.model.js pre('save')](backend/modules/aiMood/AIMood.model.js#L78).
- **Snippet:** `this.isAbnormal = ALERT_EMOTIONS.has(this.emotion) || this.confidence < 0.35;`
- **Why a problem:** Python returns `neutral@0.0` for silence/too-short; `< 0.35` marks those abnormal. Low confidence means "unknown," not "distress."
- **Impact:** every silent/uncertain check-in becomes "abnormal," and (once C-2 is addressed) would drive false alerts.

### 🟠 High

**H-1 — AI and manual moods are completely siloed; no unified, source-labeled view**
- **Files:** [usePatientData.js:17](frontend/src/features/doctor/patients/hooks/usePatientData.js#L17) (doctor: `moodsAPI` only), [family/PatientMood.jsx:323](frontend/src/features/family/patients/components/PatientMood.jsx#L323) (family: `aiMoodAPI` only).
- **Impact:** the treating doctor cannot see AI emotion data at all; no screen merges the two; no `source` label distinguishes AI vs manual anywhere.

**H-2 — Duplicate check-ins after server restart (volatile dedup)**
- **File:** [moodCheckin.scheduler.js:24](backend/modules/aiMood/moodCheckin.scheduler.js#L24) (`triggeredToday = new Map()`).
- **Impact:** a restart within a slot's `msUntil` window re-fires the prompt; frequent PM2 reloads multiply it.

**H-3 — Offline/missed check-ins are silently lost; no retry/missed-state**
- **File:** [moodCheckin.scheduler.js:92](backend/modules/aiMood/moodCheckin.scheduler.js#L92) (fire-and-forget socket).
- **Impact:** clinicians can't distinguish "patient fine" from "patient never prompted/never answered."

**H-4 — Timezone mismatch (UTC cron vs server-local math; no patient timezone)**
- **File:** [moodCheckin.scheduler.js:39-41](backend/modules/aiMood/moodCheckin.scheduler.js#L39-L41) + cron `timezone:'UTC'` ([L133-134](backend/modules/aiMood/moodCheckin.scheduler.js#L133-L134)).
- **Impact:** boundary slots can double-fire/skip on non-UTC servers; patients in other zones are checked at the wrong local time.

**H-5 — Non-readings (silence/too-short) persisted as real records**
- **Files:** [main.py:215-231](emotion_project/main.py#L215-L231) returns `note`; [aiMood.controller.js:267-283](backend/modules/aiMood/aiMood.controller.js#L267-L283) ignores `note` and stores anyway.
- **Impact:** zero-confidence "neutral" rows inflate the timeline and skew `getStats` averages; combined with C-4 they all flag abnormal.

**H-6 — No alert deduplication/batching**
- **File:** [mood.service.js:47-75](backend/services/mood.service.js#L47-L75).
- **Impact:** repeated abnormal entries create repeated notifications → alarm fatigue (and the same would occur for AI once C-2 is addressed).

### 🟡 Medium

**M-1 — No maximum audio length on the Python side** — [main.py:224](emotion_project/main.py#L224). Long uploads (≤25 MB) run full Wav2Vec2 on CPU → latency/OOM.

**M-2 — WebM decode depends on ffmpeg; client fallback can send undecodable WebM** — [MoodCheckinModal.jsx:286](frontend/src/features/patient/components/MoodCheckinModal.jsx#L286) + [main.py:111-151](emotion_project/main.py#L111-L151). Hosts without ffmpeg 422 on WebM.

**M-3 — Unauthenticated, plaintext Node→Python channel** — [emotion.service.js:14](backend/modules/aiMood/emotion.service.js#L14). Safe only while `:8001` is localhost-bound; PHI audio in transit is unencrypted.

**M-4 — `CrossAttentionFusion` is element-wise, not real attention** — [model.py:77-85](emotion_project/model.py#L77-L85). Misnamed; the `1/√256` scale is meaningless without a dot product; weakens fusion and misleads maintainers.

**M-5 — No emotion-label whitelist before DB insert** — [aiMood.controller.js:275](backend/modules/aiMood/aiMood.controller.js#L275). An unexpected Python label throws an enum error → 500 to the patient.

**M-6 — Confidence not factored into alert priority; thresholds hardcoded** — [Mood.model.js:117](backend/models/Mood.model.js#L117), [AIMood.model.js:18](backend/modules/aiMood/AIMood.model.js#L18). No per-patient configuration; a 0.51 "sad" and a 0.95 "sad" are treated identically.

### 🟢 Low

- **L-1 — Uncalibrated softmax temperature `1.7`** ([inference.py:88](emotion_project/inference.py#L88)) — confidence % is not probability-calibrated.
- **L-2 — `getStats` includes zero-confidence non-readings** ([AIMood.model.js:97](backend/modules/aiMood/AIMood.model.js#L97)) — skews averages.
- **L-3 — No minimum spacing between schedule slots** ([MoodSchedule.model.js:42](backend/modules/aiMood/MoodSchedule.model.js#L42)) — `["09:00","09:01"]` allowed.
- **L-4 — `window.confirm`/`alert` in doctor delete** ([doctor/PatientMood.jsx:23](frontend/src/features/doctor/patients/components/PatientMood.jsx#L23)) — inconsistent with app modal UX.
- **L-5 — Fixed 12 s recording, no early stop** ([MoodCheckinModal.jsx:44](frontend/src/features/patient/components/MoodCheckinModal.jsx#L44)) — forced silence is stressful for this population.
- **L-6 — DELETE `/moods/:id` comment says "Doctor-only" but uses `protectDoctorOrFamily`** ([mood.routes.js:17-18](backend/routes/mood.routes.js#L17-L18)) — comment/behavior mismatch (service still enforces ownership).

---

## 16. Open Questions

1. **Are `models/best.pt` / `last.pt` tracked in git?** They exist on disk here, but if `.gitignore` excludes them a fresh clone cannot start the AI service (`inference.py` raises `FileNotFoundError`). *Needs:* `git ls-files emotion_project/models` and `git check-ignore -v emotion_project/models/best.pt`.
2. **What is the exact label index order of `superb_demo/er`?** Required to confirm whether even the four trained classes are correctly named. *Needs:* `dataset.features["label"].names`.
3. **Is `app.py` intended to remain?** It is dead relative to the service, diverges from `inference.py` (no `weights_only`, different silence threshold, temporal smoothing), and is a maintenance hazard. Keep as example or remove?
4. **Why does the family manage the AI schedule but the doctor (clinician) has no AI UI at all?** Intentional product decision or unfinished doctor integration?
5. **Is the manual `Mood` feature still in active use, or superseded by AI Mood?** They share no data and target different roles; the intent for keeping both is unclear.
6. **Should families receive mood notifications?** Currently every mood notification is addressed to the doctor only; families rely on opening the dashboard.
7. **Is `req.patientId` ever set for doctors anywhere?** If not, the AI controller's family-only guard cannot be trivially extended without a patient-ownership lookup.
8. **Retention policy for `AIMood`/`Mood`?** No TTL or cleanup exists; emotion records grow unbounded.
9. **Is the Python service ever exposed beyond localhost in deployment?** Determines whether M-3/CORS become exploitable.
10. **`getServiceStatus` is doctor/family-only but no UI appears to call it** — is the ops/health surface wired anywhere?

---

## 17. Final System Understanding

### How Mood Detection works today

ALZCare ships **two unrelated mood systems under one name.**

**The AI Mood system** is the headline feature. A family member opens the family patient page and configures up to six daily `HH:MM` check-in times, stored as a single `MoodSchedule` document per patient. A node-cron job runs every minute on the backend; when a slot's time arrives (within a ~60-second window, computed in **server-local** time despite the cron being registered as UTC), it emits a transient `mood:checkin` Socket.IO event into the patient's room. If the patient's device is connected, a React hook pops a modal that speaks a prompt (TTS), records ~12 seconds of microphone audio via `MediaRecorder` (WebM/Opus), converts it client-side to 16-bit PCM WAV, and uploads it to `POST /api/mood-checkin/analyze` using the patient's JWT. The backend buffers the file in memory (multer, 25 MB cap) and forwards it over unauthenticated localhost HTTP to a Python FastAPI service. That service decodes the audio (librosa, soundfile fallback), rejects silence/too-short clips by returning a zero-confidence "neutral," peak-normalizes, and runs a PyTorch model that fuses a partially-frozen Wav2Vec2 embedding with MFCC features and a (mislabeled, element-wise) fusion block, producing one of eight emotion labels with a temperature-softened softmax confidence. The Node backend stores the result as an `AIMood` document — computing an `isAbnormal` flag that, by current logic, also fires for low-confidence and silent readings — and emits a `mood:updated` event so the family dashboard updates in real time. The patient sees the detected emotion and hears it spoken.

**Critically, that is where the AI pipeline stops.** No notification is ever created for an abnormal AI result, the doctor has no UI to see AI data at all, and the model's classifier was trained on a four-class dataset while emitting eight labels — so the very emotions the UI flags as alerts (`fear`, `disgust`) come from untrained weights. The AI feature is, in effect, a real-time mood **display** for whichever family member happens to be watching, not an alerting system.

**The Manual Mood system** is a separate, conventional CRUD feature. Doctors and family members POST richly structured entries (mood, 1–10 score, sleep, appetite, cognition, behaviors, notes) to `/api/moods`. This path is properly access-controlled (ownership verified in the service layer), computes its own abnormality flag, and — unlike the AI path — **does** create `Notification` documents: an abnormal entry alerts the doctor, and a family-authored entry also notifies the doctor. The doctor patient page reads only this manual data; the family mood page reads only AI data. The two never meet, and no screen labels which system a given reading came from.

In short: **today the system records patient voice emotions on a schedule and shows them to families in real time, but it does not reliably classify the alerting emotions, does not notify anyone when something looks wrong, does not let the treating doctor see the AI data, and leaves the doctor-side AI endpoints open to cross-patient access.** The manual mood feature works as a separate, properly-guarded, notification-producing record that the doctor sees but the family's mood view does not.

---

*End of audit. Documentation only — no code, schema, configuration, or model was modified.*
