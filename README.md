# ALZCare — AI-Powered Alzheimer's Care Management Platform

## 📋 Project Overview

ALZCare is a full-stack, AI-augmented care coordination platform built specifically for Alzheimer's patients and their caregiving networks. It connects three user roles — **doctors**, **family caregivers**, and **patients** — in a single unified system that handles everything from medication tracking and mood monitoring to real-time location safety alerts, cognitive exercise therapy, voice-based daily check-ins, and an Alzheimer's-specialized AI chatbot. The platform solves the fragmentation problem in dementia care: today's caregivers must manually coordinate information across providers, family members, and patients who cannot reliably self-report. ALZCare automates that coordination loop with a hybrid rule + LLM decision engine, a custom audio-emotion model, and a clinically grounded RAG knowledge base — turning fragmented care into a closed-loop, observable system.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENTS                                    │
│                                                                                 │
│  ┌─────────────────┐   ┌──────────────────┐   ┌────────────────────────────┐   │
│  │  Doctor SPA     │   │  Family SPA      │   │  Patient SPA               │   │
│  │  /doctor/*      │   │  /family/*       │   │  /patient                  │   │
│  │  React 18 +     │   │  React 18 +      │   │  Face Recognition +        │   │
│  │  Vite + TW      │   │  Vite + TW       │   │  Cognitive Exercises +     │   │
│  │                 │   │  Leaflet Maps    │   │  Mood Check-in             │   │
│  └────────┬────────┘   └────────┬─────────┘   └────────────┬───────────────┘   │
│           │                     │                           │                   │
│           └─────────────────────┼───────────────────────────┘                   │
│                                 │ HTTP REST + WebSocket (Socket.IO)             │
└─────────────────────────────────┼─────────────────────────────────────────────-─┘
                                  │
                   ┌──────────────▼───────────────────┐
                   │      Node.js / Express API        │
                   │      backend/  · Port 5001        │
                   │                                   │
                   │  • JWT Auth (3 separate secrets)  │
                   │  • REST routes (/api/*)            │
                   │  • Socket.IO server               │
                   │  • node-cron schedulers           │
                   │  • Multer file uploads            │
                   │  • geolib geofencing              │
                   └──────┬──────────────┬─────────────┘
                          │              │
              ┌───────────▼──┐     ┌─────▼────────────────────────────┐
              │   MongoDB    │     │         Python Microservices      │
              │  Atlas Cloud │     │                                   │
              │              │     │  ┌────────────────────────────┐  │
              │  All data    │     │  │  Chatbot Service · :8000   │  │
              │  persisted   │     │  │  FastAPI + LangChain       │  │
              │  here        │     │  │  Groq LLaMA-3.3-70b        │  │
              └──────────────┘     │  │  FAISS RAG (Alzheimer PDFs)│  │
                                   │  └────────────────────────────┘  │
                                   │                                   │
                                   │  ┌────────────────────────────┐  │
                                   │  │  Emotion Service · :8001   │  │
                                   │  │  FastAPI + PyTorch         │  │
                                   │  │  Wav2Vec2 + MFCC fusion    │  │
                                   │  │  8-class audio emotion     │  │
                                   │  └────────────────────────────┘  │
                                   └───────────────────────────────────┘
```

**Architecture type:** Monorepo with a Node.js API backend, a React SPA frontend, and two Python FastAPI microservices. The three tiers communicate over HTTP; the backend and frontend additionally communicate over WebSocket via Socket.IO. MongoDB Atlas is the single authoritative database.

**Real-time bus:** All live updates (daily plan events, location pings, mood results, notifications) travel through Socket.IO using a patient-room convention: `patient:{patientId}`. Both the patient device and the family dashboard join the same room so updates are instantly shared without polling.

---

## 🛠️ Tech Stack

| Technology | Version | Purpose | Where Used |
|---|---|---|---|
| **Node.js** | ≥18.0.0 | Runtime for backend | `backend/` |
| **Express.js** | 4.18.2 | HTTP API framework | `backend/server.js`, all routes |
| **MongoDB** | Atlas cloud | Primary database | All backend models |
| **Mongoose** | 8.0.3 | ODM for MongoDB | `backend/models/`, `backend/modules/*/models/` |
| **Socket.IO** | 4.8.3 | Real-time WebSocket | `backend/modules/socket/`, frontend socket client |
| **jsonwebtoken** | 9.0.2 | JWT auth (3 separate secrets) | auth middleware files |
| **bcryptjs** | 2.4.3 | Password hashing (salt rounds=12) | Patient, Doctor, Family models |
| **multer** | 1.4.5-lts | Multipart file uploads | upload middlewares |
| **node-cron** | 4.2.1 | Server-side scheduling | dailyPlan, mood check-in, cognitive schedulers |
| **axios** | 1.13.2 | Node→Python HTTP calls | chatbot service, daily plan AI |
| **geolib** | 3.3.14 | Haversine geofencing math | location service |
| **express-validator** | 7.0.1 | Request validation | auth controllers |
| **React** | 18.2.0 | Frontend UI framework | `frontend/src/` |
| **Vite** | 5.0.8 | Build tool + dev server | `frontend/vite.config.js` |
| **React Router DOM** | 6.20.0 | Client-side routing | `frontend/src/App.jsx`, module index files |
| **TailwindCSS** | 3.3.6 | Utility-first CSS | all JSX components |
| **Socket.IO Client** | 4.8.3 | Frontend WebSocket | `frontend/src/modules/shared/socket/socketClient.js` |
| **Leaflet.js** | 1.9.4 | Interactive maps | `frontend/src/features/location/components/LiveMap.jsx` |
| **React-Leaflet** | 4.2.1 | React wrapper for Leaflet | location components |
| **Three.js** | 0.182.0 | 3D rendering | landing page 3D scenes |
| **@react-three/fiber** | 9.5.0 | React renderer for Three.js | landing/features pages |
| **@react-three/drei** | 10.7.7 | Three.js helpers | 3D scenes |
| **GSAP** | 3.14.2 | Animation library | UI animations |
| **AOS** | 2.3.4 | Scroll-reveal animations | navbar, landing page |
| **Motion** | 12.27.5 | Framer Motion fork | component transitions |
| **FontAwesome** | 7.2.0 | Icon library | shared icons |
| **FastAPI** | 0.111.0 | Python async API framework | chatbot service, emotion service |
| **Uvicorn** | 0.29.0 | ASGI server | both Python services |
| **LangChain** | 0.1.17 | LLM orchestration framework | chatbot RAG pipeline |
| **langchain-groq** | latest | Groq LLM adapter | chatbot + voice intent |
| **Groq LLaMA-3.3-70b** | cloud API | Primary chat LLM | chatbot `chatbot.py` |
| **Groq LLaMA-3 8B** | cloud API | Voice intent classification | `app.py` `/analyze` endpoint |
| **FAISS** | faiss-cpu | Vector similarity search | chatbot RAG index |
| **sentence-transformers** | latest | Text embeddings (MiniLM-L6-v2) | FAISS indexing + semantic router |
| **HuggingFace Transformers** | ≥4.35.0 | Wav2Vec2 model | emotion project |
| **PyTorch** | ≥2.0.0 | Deep learning framework | emotion project model |
| **librosa** | ≥0.10.0 | Audio feature extraction (MFCC) | emotion project |
| **scikit-learn** | latest | Cosine similarity for routing | chatbot semantic router |
| **pymongo** | latest | Python MongoDB client | chatbot mongo_handler |
| **pypdf / pymupdf** | latest | PDF loading for RAG | `pdf_loader.py` |
| **sounddevice** | ≥0.4.6 | Microphone recording | emotion project |
| **Pydantic** | ≥2.0 | Request/response validation | both Python services |

---

## 📁 Project Structure

```
Graduation_1_Update/
│
├── backend/                        # Node.js/Express API server
│   ├── server.js                   # Entry point: mounts all routes, Socket.IO, schedulers
│   ├── package.json                # Dependencies + node ≥18 engine requirement
│   ├── .env                        # Secrets (JWT keys, MongoDB URI, Python service URLs)
│   │
│   ├── constants/
│   │   └── models.js               # Face-recognition model names + config (dims, thresholds)
│   │
│   ├── controllers/                # HTTP handlers for core domain
│   │   ├── auth.controller.js      # Patient login/verify
│   │   ├── doctorAuth.controller.js
│   │   ├── familyAuth.controller.js
│   │   ├── faceRecognition.controller.js
│   │   ├── medication.controller.js
│   │   ├── mood.controller.js
│   │   ├── notification.controller.js
│   │   ├── patient.controller.js   # Doctor CRUD + notes + appointments
│   │   └── index.js
│   │
│   ├── middlewares/
│   │   ├── doctorAuth.middleware.js   # Verifies DOCTOR_JWT_SECRET
│   │   ├── familyAuth.middleware.js   # Verifies FAMILY_JWT_SECRET
│   │   ├── patientAuth.middleware.js  # Verifies PATIENT_JWT_SECRET
│   │   ├── upload.middleware.js       # Profile image upload (multer)
│   │   ├── uploadMedia.middleware.js  # Memory media upload (multer, 50 MB limit)
│   │   └── validation.middleware.js   # express-validator error formatter
│   │
│   ├── models/                     # Core Mongoose schemas
│   │   ├── Doctor.model.js         # Doctor accounts + patient list
│   │   ├── Family.model.js         # Family accounts + permissions + linked patient
│   │   ├── Patient.model.js        # Full patient profile, auto ALZ-XXXXXX numbering
│   │   ├── Medication.model.js     # Prescriptions + schedule + medication logs
│   │   ├── Mood.model.js           # Manual mood entries with abnormal detection
│   │   ├── Notification.model.js   # In-app alerts (all types)
│   │   ├── Person.model.js         # Face embeddings for face-recognition
│   │   ├── User.model.js           # Base user schema (unused directly)
│   │   └── Counter.model.js        # Atomic sequence counter for patient numbers
│   │
│   ├── routes/                     # Express route definitions
│   │   ├── auth.routes.js          # POST /api/auth/login, GET /api/auth/verify
│   │   ├── doctorAuth.routes.js    # /api/doctor/auth/*
│   │   ├── familyAuth.routes.js    # /api/family/auth/*
│   │   ├── patient.routes.js       # /api/doctor/patients/*
│   │   ├── medication.routes.js    # /api/medications/*
│   │   ├── familyMedication.routes.js  # /api/family/medications/*
│   │   ├── mood.routes.js          # /api/moods/*
│   │   ├── notification.routes.js  # /api/notifications/*
│   │   └── faceRecognition.routes.js   # /api/family/face-recognition/* + public routes
│   │
│   ├── services/                   # Business logic layer
│   │   ├── auth.service.js         # Patient login logic
│   │   ├── doctorAuth.service.js
│   │   ├── familyAuth.service.js
│   │   ├── faceRecognition.service.js  # ANN search, person register/recognize
│   │   ├── medication.service.js   # Medication adherence calculations
│   │   ├── mood.service.js         # Mood history + stats
│   │   ├── notification.service.js
│   │   └── patient.service.js      # Patient CRUD + stats
│   │
│   ├── utils/
│   │   ├── ann.js                  # Brute-force ANN index (cosine) for face recognition
│   │   ├── mlClient.js             # HTTP client to Python emotion service for embeddings
│   │   └── similarity.js          # Cosine similarity helper
│   │
│   ├── modules/                    # Feature modules (self-contained)
│   │   │
│   │   ├── chatbot/
│   │   │   ├── node_client/
│   │   │   │   ├── chatbot.controller.js   # Express handler — proxies to Python
│   │   │   │   ├── chatbot.routes.js       # POST /api/chatbot/ask
│   │   │   │   └── chatbot.service.js      # axios client to :8000/chat/ask
│   │   │   └── python_service/
│   │   │       ├── app.py                  # FastAPI app — /chat/ask + /analyze endpoints
│   │   │       ├── chatbot.py              # Dual-mode RAG engine (patient/family/general)
│   │   │       ├── memory.py               # Per-session conversation memory
│   │   │       ├── mongo_handler.py        # Fetches patient data from MongoDB
│   │   │       ├── build_vector_store.py   # One-time FAISS index builder from PDFs
│   │   │       ├── pdf_loader.py           # Loads Alzheimer PDF knowledge base
│   │   │       ├── web_loader.py           # Scrapes web sources for RAG
│   │   │       ├── requirements.txt        # Python dependencies
│   │   │       ├── .env                    # GROQ_API_KEY, MONGODB_URI, FAISS_INDEX_PATH
│   │   │       ├── faiss_index/            # Pre-built vector index (index.faiss + index.pkl)
│   │   │       └── data/                   # Alzheimer's PDF knowledge base (~50 PDFs)
│   │   │           ├── About Alzheimer's.../
│   │   │           ├── Caregiving/
│   │   │           ├── Financial and Legal/
│   │   │           ├── Living with Dementia/
│   │   │           ├── Safety/
│   │   │           ├── Treatments.../
│   │   │           └── choosing a Doctor/
│   │   │
│   │   ├── aiMood/
│   │   │   ├── AIMood.model.js             # AI-detected emotion results
│   │   │   ├── MoodSchedule.model.js       # Per-patient scheduled check-in times
│   │   │   ├── aiMood.controller.js        # POST /analyze, GET /history|latest|stats
│   │   │   ├── aiMood.routes.js            # /api/mood-checkin/*
│   │   │   ├── emotion.service.js          # HTTP client to emotion service :8001
│   │   │   └── moodCheckin.scheduler.js    # node-cron: triggers audio check-ins at scheduled times
│   │   │
│   │   ├── cognitive/
│   │   │   ├── index.js                    # Exports router + seedExerciseTemplates + startCognitiveScheduler
│   │   │   ├── cognitive.scheduler.js      # Cron: creates scheduled sessions for patients
│   │   │   ├── cognitive.seed.js           # Seeds 5 exercise templates on startup (idempotent)
│   │   │   ├── controllers/
│   │   │   │   ├── exercise.controller.js        # Template CRUD
│   │   │   │   ├── memoryAlbum.controller.js      # Album + MemoryItem CRUD
│   │   │   │   ├── cognitiveSession.controller.js # Start/interact/complete/abandon sessions
│   │   │   │   ├── cognitiveSchedule.controller.js
│   │   │   │   └── cognitiveAnalytics.controller.js
│   │   │   ├── models/
│   │   │   │   ├── ExerciseTemplate.model.js  # 5 exercise type definitions
│   │   │   │   ├── CognitiveAssignment.model.js # Doctor/family assigns exercise to patient
│   │   │   │   ├── CognitiveSchedule.model.js   # Recurring schedule for assignments
│   │   │   │   ├── CognitiveSession.model.js    # One exercise/album play instance
│   │   │   │   ├── CognitiveAnalyticsEvent.model.js
│   │   │   │   ├── MemoryAlbum.model.js
│   │   │   │   └── MemoryItem.model.js
│   │   │   ├── services/
│   │   │   │   ├── exercise.service.js
│   │   │   │   ├── memoryAlbum.service.js
│   │   │   │   ├── cognitiveSession.service.js
│   │   │   │   ├── cognitiveSchedule.service.js
│   │   │   │   └── cognitiveAnalytics.service.js
│   │   │   ├── routes/index.js
│   │   │   └── utils/
│   │   │       ├── exerciseEngine.js   # Pure data generators for all 5 exercise types + scoring
│   │   │       ├── ctx.js              # Auth context helpers (doctor/family/patient)
│   │   │       └── ownership.js        # Access control checks
│   │   │
│   │   ├── dailyPlan/
│   │   │   ├── dailyPlan.model.js      # Plan + embedded events with voice response audit trail
│   │   │   ├── dailyPlan.controller.js
│   │   │   ├── dailyPlan.routes.js     # Family + patient + shared event routes
│   │   │   ├── dailyPlan.scheduler.js  # node-cron: fires event:trigger at scheduled times
│   │   │   └── dailyPlan.service.js    # Full hybrid AI decision pipeline (rules + Groq + guarantee layer)
│   │   │
│   │   ├── location/
│   │   │   ├── location.model.js       # PatientLocation (one doc per patient + rolling 50-entry history)
│   │   │   ├── location.controller.js
│   │   │   ├── location.routes.js      # Patient POST + family GET routes
│   │   │   └── location.service.js     # Throttled writes + geofence check + zone-exit alert
│   │   │
│   │   ├── safetyZone/
│   │   │   ├── safetyZone.model.js     # One zone per patient (center + radius 50–5000m)
│   │   │   ├── safetyZone.controller.js
│   │   │   ├── safetyZone.routes.js
│   │   │   └── safetyZone.service.js
│   │   │
│   │   └── socket/
│   │       └── socketManager.js        # Socket.IO server init + emitToPatientRoom helper
│   │
│   └── uploads/                        # Static file storage (served at /uploads)
│       ├── patients/                   # Patient profile images
│       ├── doctors/                    # Doctor profile images
│       ├── families/                   # Family profile images
│       └── memory/                     # Memory album media (images, audio)
│
├── frontend/                           # React + Vite SPA
│   ├── index.html                      # Vite entry point
│   ├── package.json
│   ├── postcss.config.js
│   ├── .npmrc
│   ├── SETUP.md
│   │
│   └── src/
│       ├── main.jsx                    # ReactDOM.render entry
│       ├── App.jsx                     # Router + AuthProvider + role guards + lazy loading
│       ├── index.css                   # Global styles
│       │
│       ├── styles/
│       │   └── animations.css          # Custom keyframe animations
│       │
│       ├── pages/                      # Public/marketing pages
│       │   ├── LandingPage.jsx         # Homepage with 3D scenes + AOS animations
│       │   ├── FeaturesPage.jsx        # Feature showcase
│       │   ├── AboutPage.jsx
│       │   ├── DashboardShowcase.jsx   # Marketing dashboard preview
│       │   └── AuthPages.jsx           # Login/signup for all 3 roles
│       │
│       ├── components/                 # Shared layout components
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── DomeGallery.jsx
│       │   ├── StaggeredMenu.jsx
│       │   └── ui/                     # Reusable UI primitives
│       │       ├── AnimatedCounter.jsx
│       │       ├── BarChart.jsx
│       │       ├── DonutChart.jsx
│       │       ├── SparklineChart.jsx
│       │       ├── DataTable.jsx
│       │       ├── Timeline.jsx
│       │       ├── TrueFocus.jsx       # Loading animation (blur word reveal)
│       │       └── Icons.jsx
│       │
│       ├── hooks/
│       │   └── useScrollReveal.js
│       │
│       ├── services/
│       │   └── api.js                  # (legacy) re-exported from modules/shared/api/api.js
│       │
│       ├── modules/                    # Role-based routing + layout shells
│       │   ├── shared/
│       │   │   ├── api/api.js          # ALL API call definitions + tokenManager
│       │   │   ├── auth/AuthContext.jsx # React context: login/logout/verify for all 3 roles
│       │   │   └── socket/socketClient.js  # Socket.IO client singleton
│       │   │
│       │   ├── doctor/
│       │   │   ├── index.jsx           # DoctorDashboardRouter (protected routes)
│       │   │   ├── DoctorLayout.jsx    # Sidebar + header shell
│       │   │   └── pages/             # (re-export legacy wrappers)
│       │   │
│       │   ├── family/
│       │   │   ├── index.jsx           # FamilyDashboardRouter (protected routes)
│       │   │   ├── FamilyLayout.jsx    # Sidebar + header shell
│       │   │   └── pages/
│       │   │
│       │   ├── patient/
│       │   │   └── pages/PatientPage.jsx   # (re-export)
│       │   │
│       │   └── chatbot/
│       │       └── services/chatbotService.js  # Frontend chatbot API wrapper
│       │
│       └── features/                   # Feature slices (the real logic)
│           │
│           ├── doctor/
│           │   ├── dashboard/
│           │   │   ├── pages/DoctorDashboard.jsx     # Stats + patient list + notifications
│           │   │   ├── pages/DoctorAssistantPage.jsx # AI chatbot interface for doctors
│           │   │   └── components/DoctorChatbotWidget.jsx
│           │   └── patients/
│           │       ├── pages/PatientDetails.jsx       # Full patient profile (tabs)
│           │       ├── pages/AddPatient.jsx            # Patient creation form
│           │       ├── components/PatientOverview.jsx
│           │       ├── components/PatientMedications.jsx
│           │       ├── components/PatientMood.jsx
│           │       ├── components/PatientNotes.jsx
│           │       ├── components/DoctorCognitiveInsights.jsx
│           │       ├── hooks/usePatientData.js
│           │       └── services/patientService.js
│           │
│           ├── family/
│           │   ├── dashboard/
│           │   │   ├── pages/FamilyDashboard.jsx       # Overview of patient
│           │   │   └── pages/FamilyAssistantPage.jsx   # AI chatbot for family (simplified tone)
│           │   ├── patients/
│           │   │   ├── pages/FamilyPatientDetails.jsx  # Patient info + location + daily plan
│           │   │   ├── components/PatientMood.jsx
│           │   │   ├── components/PatientMedications.jsx
│           │   │   ├── components/PatientOverview.jsx
│           │   │   ├── components/DailyPlan.jsx        # Daily plan view + event management
│           │   │   ├── hooks/useFamilyPatientData.js
│           │   │   └── services/familyPatientService.js
│           │   ├── register/
│           │   │   └── pages/RegisterPerson.jsx        # Face registration form
│           │   └── cognitive/
│           │       └── pages/MemoryHub.jsx             # Album browser + exercise assignment
│           │
│           ├── patient/
│           │   ├── pages/PatientPage.jsx               # Live face recognition camera interface
│           │   ├── cognitive/
│           │   │   ├── components/CognitiveSessions.jsx    # Available exercises list
│           │   │   ├── components/SessionPlayer.jsx         # Routes to correct player
│           │   │   ├── components/AlbumViewer.jsx
│           │   │   └── components/players/
│           │   │       ├── ChoicePlayer.jsx            # Face recognition + memory recall
│           │   │       ├── SequencePlayer.jsx          # Simon-style sequence game
│           │   │       ├── RoutinePlayer.jsx           # Drag-to-order daily routine
│           │   │       └── VoicePlayer.jsx             # Voice prompt recording
│           │   ├── components/
│           │   │   ├── LocationTracker.jsx             # Background GPS sender
│           │   │   ├── MoodCheckinModal.jsx            # Audio recording modal for AI mood
│           │   │   └── VoiceInteractionModal.jsx       # Voice response for daily plan events
│           │   ├── hooks/
│           │   │   ├── useMoodCheckin.js
│           │   │   └── useVoiceEngine.js              # Web Speech API / MediaRecorder
│           │   └── utils/voiceUtils.js
│           │
│           ├── cognitive/
│           │   ├── components/
│           │   │   ├── AlbumEditor.jsx
│           │   │   ├── AlbumsManager.jsx
│           │   │   ├── CognitiveInsights.jsx          # Analytics charts
│           │   │   ├── ExercisesManager.jsx           # Exercise assignment UI
│           │   │   └── ScheduleManager.jsx
│           │   ├── constants.jsx
│           │   └── hooks/useCognitiveData.js
│           │
│           ├── location/
│           │   ├── api/locationApi.js
│           │   ├── components/
│           │   │   ├── LiveMap.jsx                    # Leaflet map with patient + zone overlay
│           │   │   ├── LocationTab.jsx                # Tab wrapper
│           │   │   └── StatusBadge.jsx                # inside/outside/unknown badge
│           │   └── hooks/usePatientLocation.js
│           │
│           └── shared/
│               ├── Service-ai-models/face-recognition/
│               │   ├── api/faceRecognitionClient.js   # HTTP to /api/face-recognition/*
│               │   ├── inference/patientRecognition.js  # Patient-facing recognition wrapper
│               │   ├── inference/registerPerson.js
│               │   ├── models/modelConfig.js
│               │   ├── runtime/main.py               # Python face embedding service (ArcFace)
│               │   └── utils/imageBase64.js
│               ├── components/AIAssistantPanel.jsx    # Shared chatbot panel (doctor + family)
│               ├── icons/index.jsx
│               └── layouts/RoleDashboardLayout.jsx
│
└── emotion_project/                   # Audio emotion analysis microservice
    ├── app.py                         # Real-time mic loop (standalone CLI)
    ├── main.py                        # FastAPI server for HTTP integration (:8001)
    ├── model.py                       # Wav2Vec2 + MFCC + CrossAttention architecture
    ├── inference.py                   # Inference utilities
    ├── train.py                       # Training script (SUPERB-ER dataset)
    ├── requirements.txt
    └── models/
        ├── best.pt                    # Best checkpoint (saved at lowest epoch loss)
        └── last.pt                    # Last epoch checkpoint
```

---

## ✨ Features & Modules

### 1. Multi-Role Authentication System
**What it does:** Three completely independent JWT authentication flows for doctors, family members, and patients. Each role has its own secret key, token storage key (`alzcare_doctor_token`, `alzcare_family_token`, `alzcare_patient_token`), and middleware. Tokens coexist in localStorage without cross-contamination so a family dashboard and doctor dashboard can be open in separate tabs sharing the same browser.

**Files:** `backend/middlewares/doctorAuth.middleware.js`, `familyAuth.middleware.js`, `patientAuth.middleware.js`, `backend/routes/doctorAuth.routes.js`, `familyAuth.routes.js`, `auth.routes.js`, `frontend/src/modules/shared/auth/AuthContext.jsx`, `frontend/src/modules/shared/api/api.js` (tokenManager)

**Dependencies:** jsonwebtoken, bcryptjs, express-validator

**Connects to:** Every protected API endpoint; AuthContext feeds role-based routing guards in App.jsx

---

### 2. Patient Management
**What it does:** Doctors create and manage full patient profiles including demographics, Alzheimer's stage (early/middle/late), medical history, allergies, emergency contacts, and clinical notes. Patients receive an auto-generated, unique identifier in the format `ALZ-000001` (atomically incremented via the Counter collection, seeded on startup to never collide with pre-existing patients).

**Files:** `backend/models/Patient.model.js`, `backend/controllers/patient.controller.js`, `backend/services/patient.service.js`, `backend/routes/patient.routes.js`, `backend/models/Counter.model.js`, `frontend/src/features/doctor/patients/pages/`

**Dependencies:** Mongoose, Counter model for atomic sequence generation

**Connects to:** Medications, Mood, Notifications, DailyPlan, FaceRecognition (all reference patient `_id`)

---

### 3. Family Account Management
**What it does:** Doctors create family accounts that are pre-linked to a specific patient. Family members can log in to a dedicated dashboard with configurable permissions (view medications, confirm medication taken, add mood entries, view history, contact doctor). Relationship types: spouse, child, parent, sibling, grandchild, caregiver, other.

**Files:** `backend/models/Family.model.js`, `backend/controllers/familyAuth.controller.js`, `backend/services/familyAuth.service.js`

**Connects to:** Patient (each family is permanently linked to one patient), Medications, Mood, DailyPlan, Location, SafetyZone

---

### 4. Medication Management
**What it does:** Doctors prescribe medications with full detail: type (tablet/capsule/liquid/injection/topical/inhaler/drops), strength, instructions, side effects, purpose, and flexible schedules (specific days of week + times). Family members confirm medications taken. Each confirmation is logged with a `medicationLog` entry including who confirmed (doctor or family), timestamp, and optional location. Adherence statistics are calculated over configurable time windows.

**Files:** `backend/models/Medication.model.js`, `backend/controllers/medication.controller.js`, `backend/services/medication.service.js`, `backend/routes/medication.routes.js`, `backend/routes/familyMedication.routes.js`, `frontend/src/features/doctor/patients/components/PatientMedications.jsx`, `frontend/src/features/family/patients/components/PatientMedications.jsx`

**Dependencies:** Medication model's `getDueMedications` static method, `todaySchedule` virtual

**Connects to:** DailyPlan (medication events auto-injected), Notifications (missed medication alerts)

---

### 5. Mood Tracking (Manual)
**What it does:** Doctors and family members log structured mood entries for patients. Each entry captures: mood label (10 options: very_happy through agitated), numeric score 1–10, energy level, sleep quality/hours/disturbances, appetite, cognitive state (clarity/recognition/communication), physical symptoms, and behavioral flags (wandering, sundowning, aggression, etc.). Entries scoring ≤3 or containing abnormal moods/behaviors are automatically flagged `isAbnormal=true` and trigger notifications.

**Files:** `backend/models/Mood.model.js`, `backend/controllers/mood.controller.js`, `backend/services/mood.service.js`, `backend/routes/mood.routes.js`, `frontend/src/features/doctor/patients/components/PatientMood.jsx`, `frontend/src/features/family/patients/components/PatientMood.jsx`

**Connects to:** Notifications (abnormal mood alerts), Doctor/Family dashboards

---

### 6. AI Chatbot (Alzheimer's RAG Assistant)
**What it does:** A clinically-safe dual-mode conversational AI. In **Patient/Family Mode** (when a `patient_id` is provided), all answers are strictly grounded in the patient's MongoDB record — it cannot invent diagnoses, medications, or stage information. In **General Mode** (no patient selected), it answers from a ~50-document Alzheimer's PDF knowledge base via FAISS vector search. A semantic router (MiniLM-L6-v2 + cosine similarity) classifies each question as `patient`, `knowledge`, or `hybrid` to calibrate the LLM's focus. Seven hard anti-hallucination rules are enforced in every prompt. Doctor role receives clinical language; family role receives compassionate, simplified language. Conversation memory is per-session to prevent cross-user bleed.

**Files:** `backend/modules/chatbot/python_service/app.py` (FastAPI), `chatbot.py` (dual-mode engine), `memory.py` (session memory), `mongo_handler.py` (patient data fetcher), `build_vector_store.py` (one-time indexer), `pdf_loader.py`, `faiss_index/`, `data/` (PDF corpus), `backend/modules/chatbot/node_client/chatbot.service.js` (Node→Python proxy), `frontend/src/features/shared/components/AIAssistantPanel.jsx`

**Dependencies:** LangChain, Groq API (LLaMA-3.3-70b for chat, LLaMA-3 8B for intent), FAISS, sentence-transformers, scikit-learn, pymongo, pypdf

**Connects to:** Patient records (MongoDB), Doctor/Family assistant pages

---

### 7. Daily Plan & Voice Check-ins
**What it does:** Family members create structured daily plans for patients with typed events (wake_up, medication, appointment, custom). Each event has a scheduled time and a voice prompt. The node-cron scheduler fires at each event's time and emits `event:trigger` via Socket.IO to the patient's device. The patient speaks a response; the text goes through a **5-stage hybrid pipeline**: (1) rule-based multi-signal scoring with context-specific patterns and negation detection, (2) Groq LLaMA-3 8B AI analysis if confidence < 65%, (3) result combining (agreement bonus + disagreement penalty), (4) decision guarantee layer (never allows `ask_again` to exit), (5) medical risk classification (low/medium/high). The outcome is persisted with a full audit trail and synced to medication logs if the event is linked to a medication.

**Files:** `backend/modules/dailyPlan/dailyPlan.model.js`, `dailyPlan.service.js` (full pipeline), `dailyPlan.scheduler.js`, `dailyPlan.controller.js`, `dailyPlan.routes.js`, `frontend/src/features/family/patients/components/DailyPlan.jsx`, `frontend/src/features/patient/components/VoiceInteractionModal.jsx`

**Dependencies:** node-cron, Socket.IO, axios (→ Python /analyze), Groq LLaMA-3 8B

**Connects to:** Medications (log sync), Notifications (missed medication + health alerts), Socket.IO (real-time event trigger + plan sync)

---

### 8. AI Mood Check-ins (Audio Emotion Analysis)
**What it does:** Family members set a schedule of daily times for automated voice-based mood check-ins. At each scheduled time, the patient's device is prompted to record audio. The audio blob is sent to the backend, forwarded to the Python emotion service (`emotion_project` at port 8001), analyzed by a custom PyTorch model (Wav2Vec2-base + MFCC + CrossAttention), and the resulting emotion (8 classes: neutral, happy, sad, angry, fear, disgust, surprise, bored) with confidence is persisted in `AIMood` and emitted via Socket.IO.

**Files:** `backend/modules/aiMood/aiMood.controller.js`, `aiMood.routes.js`, `AIMood.model.js`, `MoodSchedule.model.js`, `emotion.service.js`, `moodCheckin.scheduler.js`, `emotion_project/main.py`, `model.py`, `app.py`, `frontend/src/features/patient/components/MoodCheckinModal.jsx`

**Dependencies:** node-cron, multer (audio upload), axios, PyTorch, Wav2Vec2, librosa, sounddevice (for mic mode)

**Connects to:** Socket.IO (mood:updated event), Family/Doctor dashboards (history + stats)

---

### 9. Face Recognition
**What it does:** Family members register known people (name, age, relationship, up to 20 photos) using the family dashboard. Face embeddings are extracted via the Python face embedding service (ArcFace / buffalo_l model) and stored per-person with multi-model support. The patient's device runs a live camera loop at ~1200ms intervals, sending frames to `/api/ml/predict-person` which performs ANN-based cosine similarity search against registered embeddings. Bounding boxes and identity labels are drawn on the video feed in real time. Matches above a configurable similarity threshold (default 0.45) are considered recognized.

**Files:** `backend/services/faceRecognition.service.js`, `backend/controllers/faceRecognition.controller.js`, `backend/models/Person.model.js`, `backend/utils/ann.js`, `backend/utils/similarity.js`, `backend/constants/models.js`, `frontend/src/features/shared/Service-ai-models/face-recognition/`, `frontend/src/features/patient/pages/PatientPage.jsx` (camera + overlay rendering)

**Dependencies:** ArcFace python service (external, port configurable), geolib-like cosine math, Mongoose Person model

**Connects to:** Cognitive exercises (face_recognition type uses the same Person pool as distractor pool)

---

### 10. GPS Location Tracking & Safety Zones
**What it does:** The patient's device continuously sends GPS coordinates to the backend. Location writes are throttled to one per 10 seconds to prevent database flooding. A rolling history of the last 50 positions is maintained. Family members define a circular safety zone (center + radius 50–5000m) via an interactive Leaflet map. On every location update, the system uses geolib's Haversine formula to check if the patient is inside/outside the zone. A transition from non-outside → outside creates an urgent `zone_alert` notification sent to the family in real time.

**Files:** `backend/modules/location/location.model.js`, `location.service.js`, `location.controller.js`, `location.routes.js`, `backend/modules/safetyZone/safetyZone.model.js`, `safetyZone.service.js`, `frontend/src/features/location/components/LiveMap.jsx`, `LocationTab.jsx`, `StatusBadge.jsx`, `frontend/src/features/patient/components/LocationTracker.jsx`

**Dependencies:** geolib (Haversine distance), Leaflet.js + React-Leaflet, Socket.IO (zone_alert), Notification model

**Connects to:** Notifications (zone_alert type), Family patient details page (location tab)

---

### 11. Cognitive Exercise System
**What it does:** A full cognitive therapy engine with 5 exercise types:
- `face_recognition` — look at a photo from the patient's memory album and choose who it is
- `memory_recall` — view a memory photo and answer a question about the name/relationship/location
- `sequence_memory` — Simon-style colored tile sequence game
- `daily_routine` — drag-to-order the correct steps of a daily routine
- `voice_recognition` — speak aloud in response to prompts

Doctors/family assign specific exercises to patients with difficulty (easy/medium/hard) and optionally schedule recurring sessions via node-cron. The exercise engine generates per-session playable content with shuffled options and an authoritative server-side answer key. Scoring is performed server-side from the stored content + reported interactions. Analytics track score, completion rate, and mistakes over time.

**Files:** `backend/modules/cognitive/utils/exerciseEngine.js` (generators + scoring), `backend/modules/cognitive/models/`, all cognitive controllers/services/routes, `frontend/src/features/cognitive/`, `frontend/src/features/patient/cognitive/components/players/`

**Dependencies:** node-cron (scheduler), MemoryItem (photo pool for recognition/recall), Mongoose

**Connects to:** Memory Albums (provides photo content), CognitiveSession (tracks play history), Socket.IO (session events)

---

### 12. Memory Albums
**What it does:** Family members create themed photo/audio/video albums (categories: family/friends/places/events/pets/achievements/other) with emotional tags. Each album item (MemoryItem) can be an image, video, or audio file with metadata: name, relationship, story, location, emotion label. Albums are uploaded with cover images. Items are used as the content pool for face_recognition and memory_recall cognitive exercises.

**Files:** `backend/modules/cognitive/models/MemoryAlbum.model.js`, `MemoryItem.model.js`, `backend/modules/cognitive/controllers/memoryAlbum.controller.js`, `backend/modules/cognitive/services/memoryAlbum.service.js`, `backend/middlewares/uploadMedia.middleware.js`, `frontend/src/features/cognitive/components/AlbumEditor.jsx`, `AlbumsManager.jsx`, `frontend/src/features/family/cognitive/pages/MemoryHub.jsx`

**Dependencies:** multer (file upload, 50 MB limit), `/uploads/memory/` static folder

**Connects to:** Cognitive exercises (exerciseEngine queries MemoryItem for named photos)

---

### 13. Notifications System
**What it does:** In-app notification system with 11 types: medication_reminder, medication_missed, medication_taken, mood_abnormal, mood_entry, appointment_reminder, patient_update, system_alert, new_patient, family_activity, zone_alert. Notifications are persisted to MongoDB and pushed to clients in real time via Socket.IO. Priority levels: low/medium/high/urgent. Recipients can be Doctor or Family (polymorphic `recipientModel`).

**Files:** `backend/models/Notification.model.js`, `backend/controllers/notification.controller.js`, `backend/services/notification.service.js`, `backend/routes/notification.routes.js`, `backend/modules/socket/socketManager.js` (emitNotification)

**Dependencies:** Socket.IO (notification:new event), Mongoose

**Connects to:** Mood (abnormal alerts), DailyPlan (missed medication + health alerts), Location (zone_alert), Patient management (new patient)

---

### 14. Real-Time Communication (Socket.IO)
**What it does:** A single Socket.IO server handles all real-time updates. Room convention: `patient:{patientId}`. Both the patient's device and the family dashboard join the same room, so daily plan updates, location pings, mood results, and notifications appear instantly on both. Emits: `dailyPlan:updated`, `event:trigger`, `event:completed`, `event:missed`, `mood:updated`, `notification:new`, `room:joined`.

**Files:** `backend/modules/socket/socketManager.js`, `frontend/src/modules/shared/socket/socketClient.js`

**Dependencies:** socket.io (server), socket.io-client (frontend)

**Connects to:** DailyPlan, AIMood, Location, Notifications

---

## 🔄 Data Flow & Core Logic

### Critical User Journey: Patient Voice Check-in for Medication

```
1. SCHEDULE SETUP
   Family sets medication event in daily plan with time "09:00"
   → DailyPlan.events[] saved to MongoDB
   → scheduleForPlan() registers a node-cron job for 09:00

2. EVENT TRIGGER (09:00 fires)
   node-cron fires → dailyPlan.scheduler.js
   → emitToPatientRoom(patientId, 'event:trigger', { event })
   → Patient device receives WebSocket message

3. PATIENT RESPONSE
   VoiceInteractionModal opens on patient device
   Patient speaks: "I already took it"
   useVoiceEngine captures audio via Web Speech API / MediaRecorder
   → POST /api/daily-plan/{planId}/event/{eventId}/respond
      body: { responseText: "I already took it", patientId }

4. BACKEND DECISION PIPELINE (dailyPlan.service.js)
   STAGE 1 — Rule engine:
     Scans "I already took it" against RULE_SIGNALS
     "already" → confirm (w:2), "took" → confirm (w:3)
     No negation detected
     Winner: confirm_taken, score=5/5, confidence=0.90
     
   (confidence ≥ 0.65 → AI not needed)
   
   STAGE 4 — Guarantee layer:
     action=mark_completed → valid, passes through
   
   STAGE 5 — Risk assessment:
     mark_completed, confidence=0.90 → riskLevel='low'

5. PERSISTENCE
   event.status = 'completed'
   event.response = { confirmed: true, aiIntent: 'confirm_taken',
                      confidence: 0.90, decisionSource: 'rule_engine',
                      riskLevel: 'low', reasoning: "..." }
   medication.medicationLogs entry updated: status='taken'
   plan.save()

6. REAL-TIME SYNC
   emitToPatientRoom('event:completed', { plan })
   Family dashboard receives WebSocket update → re-renders DailyPlan component
```

### Patient Safety Alert Journey

```
1. Patient device sends GPS every 10s → POST /api/patient/location
2. LocationService.updateLocation() throttle check passes
3. Upserts PatientLocation (lat/lng + rolling history)
4. _runGeofenceCheck() called async:
   - SafetyZone fetched (center: {lat, lng}, radius: 200m)
   - geolib.getDistance() computes Haversine distance
   - If distance > 200m AND previous status was 'inside':
     * PatientLocation.lastKnownStatus = 'outside'
     * Notification.create({ type: 'zone_alert', priority: 'urgent' })
     * emitToPatientRoom(patientId, 'notification:new', notif)
5. Family dashboard: receives notification:new via Socket.IO
   → Alert badge increments + toast shown
```

---

## 🌐 API Reference

### Authentication

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/doctor/auth/signup` | None | Doctor registration |
| POST | `/api/doctor/auth/login` | None | Doctor login → JWT |
| GET | `/api/doctor/auth/profile` | Doctor | Get doctor profile |
| PUT | `/api/doctor/auth/profile` | Doctor | Update profile |
| PUT | `/api/doctor/auth/change-password` | Doctor | Change password |
| GET | `/api/doctor/auth/stats` | Doctor | Dashboard stats |
| GET | `/api/doctor/auth/verify` | Doctor | Verify token |
| POST | `/api/family/auth/login` | None | Family login → JWT |
| GET | `/api/family/auth/profile` | Family | Get family profile |
| PUT | `/api/family/auth/profile` | Family | Update profile |
| GET | `/api/family/auth/verify` | Family | Verify token |
| POST | `/api/auth/login` | None | Patient login (body: `{email, password, role: 'patient'}`) |
| GET | `/api/auth/verify` | Patient | Verify token |

### Patient Management

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/doctor/patients` | Doctor | List all patients (paginated + filtered) |
| POST | `/api/doctor/patients` | Doctor | Create patient |
| GET | `/api/doctor/patients/:id` | Doctor | Get patient detail |
| PUT | `/api/doctor/patients/:id` | Doctor | Update patient |
| DELETE | `/api/doctor/patients/:id` | Doctor | Delete patient |
| PUT | `/api/doctor/patients/:id/status` | Doctor | Update status (active/inactive/discharged/deceased) |
| POST | `/api/doctor/patients/:id/notes` | Doctor | Add clinical note |
| GET | `/api/doctor/patients/:id/notes` | Doctor | Get notes |
| GET | `/api/doctor/patients/:id/stats` | Doctor | Patient stats |
| POST | `/api/doctor/patients/:id/appointment` | Doctor | Schedule appointment |
| GET | `/api/doctor/patients/:patientId/family` | Doctor | Get linked family |

### Medications

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/medications` | Doctor | Prescribe medication |
| PUT | `/api/medications/:id` | Doctor | Update prescription |
| DELETE | `/api/medications/:id` | Doctor | Delete prescription |
| PUT | `/api/medications/:id/discontinue` | Doctor | Mark inactive |
| GET | `/api/medications/patient/:patientId` | Doctor\|Family | Get patient meds |
| GET | `/api/medications/:id` | Doctor\|Family | Get single med |
| POST | `/api/medications/:id/log` | Doctor\|Family | Log taken/missed |
| GET | `/api/medications/patient/:patientId/today` | Doctor\|Family | Today's schedule |
| GET | `/api/medications/patient/:patientId/adherence` | Doctor\|Family | Adherence stats |
| POST | `/api/family/medications` | Family | Family-added medication |
| DELETE | `/api/family/medications/:id` | Family | Delete family medication |

### Mood

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/moods` | Doctor\|Family | Create mood entry |
| GET | `/api/moods/patient/:patientId` | Doctor\|Family | Mood history |
| GET | `/api/moods/:id` | Doctor\|Family | Single mood entry |
| PUT | `/api/moods/:id` | Doctor\|Family | Update mood entry |
| DELETE | `/api/moods/:id` | Doctor\|Family | Delete mood entry |
| GET | `/api/moods/patient/:patientId/stats` | Doctor\|Family | Mood statistics |
| GET | `/api/moods/patient/:patientId/abnormal` | Doctor\|Family | Abnormal entries |

### Notifications

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/notifications` | Doctor\|Family | All notifications (paginated) |
| GET | `/api/notifications/unread-count` | Doctor\|Family | Unread badge count |
| GET | `/api/notifications/recent` | Doctor\|Family | Recent notifications |
| GET | `/api/notifications/stats` | Doctor\|Family | Notification stats |
| PUT | `/api/notifications/:id/read` | Doctor\|Family | Mark read |
| PUT | `/api/notifications/read-all` | Doctor\|Family | Mark all read |
| PUT | `/api/notifications/:id/archive` | Doctor\|Family | Archive |
| DELETE | `/api/notifications/:id` | Doctor\|Family | Delete |

### Chatbot

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/chatbot/ask` | Doctor\|Family\|Patient | Ask AI assistant. Body: `{question, patient_id?}` |

### Daily Plan

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/family/daily-plan` | Family | Create/replace full day plan |
| POST | `/api/family/daily-plan/events` | Family | Append events to plan |
| GET | `/api/patient/:patientId/daily-plan/today` | Any | Today's plan |
| GET | `/api/patient/:patientId/daily-plan` | Any | Plan for specific date |
| POST | `/api/daily-plan/:planId/event/:eventId/respond` | Patient | Submit voice response |
| PUT | `/api/family/daily-plan/:planId/event/:eventId/manual` | Family | Manual confirm/miss |
| PUT | `/api/family/daily-plan/:planId/event/:eventId` | Family | Update event |
| DELETE | `/api/family/daily-plan/:planId/event/:eventId` | Family | Delete event |

### AI Mood Check-in

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/mood-checkin/analyze` | Patient | Upload audio for emotion analysis (multipart, field: `audio`) |
| POST | `/api/mood-checkin/schedule` | Doctor\|Family | Set check-in schedule |
| GET | `/api/mood-checkin/schedule/:patientId` | Doctor\|Family | Get schedule |
| GET | `/api/mood-checkin/history/:patientId` | Doctor\|Family | Emotion history |
| GET | `/api/mood-checkin/latest/:patientId` | Any | Latest emotion result |
| GET | `/api/mood-checkin/stats/:patientId` | Doctor\|Family | Emotion frequency stats |
| GET | `/api/mood-checkin/service-status` | Doctor\|Family | Emotion service health |

### Location & Safety Zone

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/patient/location` | Patient | Update GPS coordinates. Body: `{lat, lng, accuracy}` |
| GET | `/api/family/location/:patientId` | Family | Get patient location + safety zone |
| POST | `/api/family/safety-zone` | Family | Create/update safety zone. Body: `{patientId, center: {lat,lng}, radius}` |
| GET | `/api/family/safety-zone/:patientId` | Family | Get safety zone |

### Face Recognition

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/family/face-recognition/register` | Family | Register person with photos (multipart) |
| POST | `/api/family/face-recognition/recognize` | Family | Recognize face from base64 image |
| GET | `/api/family/face-recognition/persons` | Family | List registered persons |
| POST | `/api/face-recognition/patient/recognize` | None (public) | Patient-side recognition |
| POST | `/api/ml/predict-person` | None (public) | Alias for patient recognition |

### Cognitive System

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/cognitive/exercise-templates` | Any | List exercise types |
| GET | `/api/cognitive/patients/:patientId/albums` | Doctor\|Family | List memory albums |
| POST | `/api/cognitive/patients/:patientId/albums` | Doctor\|Family | Create album (multipart) |
| GET | `/api/cognitive/albums/:albumId` | Any | Get album with items |
| PUT | `/api/cognitive/albums/:albumId` | Doctor\|Family | Update album |
| DELETE | `/api/cognitive/albums/:albumId` | Doctor\|Family | Delete album |
| POST | `/api/cognitive/albums/:albumId/items` | Doctor\|Family | Add memory item |
| POST | `/api/cognitive/patients/:patientId/assignments/exercise` | Doctor\|Family | Assign exercise |
| POST | `/api/cognitive/patients/:patientId/assignments/album` | Doctor\|Family | Assign album |
| GET | `/api/cognitive/patients/:patientId/assignments` | Any | List assignments |
| POST | `/api/cognitive/sessions/start` | Any | Start session from assignment |
| POST | `/api/cognitive/sessions/:sessionId/interactions` | Any | Record interaction |
| POST | `/api/cognitive/sessions/:sessionId/complete` | Any | Complete session |
| GET | `/api/cognitive/patients/:patientId/sessions/due` | Patient | Due sessions |
| GET | `/api/cognitive/patients/:patientId/analytics` | Doctor\|Family | Analytics |

### Python Services (internal)

| Method | Service | Route | Description |
|--------|---------|-------|-------------|
| POST | :8000 | `/chat/ask` | Chat with Groq LLaMA-3.3-70b. Body: `{question, patient_id?, session_id?, user_role?}` |
| POST | :8000 | `/analyze` | Classify voice intent. Body: `{text, context, event_title?}` |
| GET | :8000 | `/health` | Chatbot service health check |
| POST | :8001 | `/predict` | Analyze audio for emotion (multipart audio file) |
| GET | :8001 | `/health` | Emotion service health check |

---

## 🗄️ Database & Storage

### MongoDB Collections

| Collection | Purpose | Key Fields |
|---|---|---|
| `doctors` | Doctor accounts | firstName, lastName, email, password (bcrypt), licenseNumber, specialization, hospital, patients[] |
| `families` | Family accounts | firstName, lastName, email, password, relationship, patient (ref), createdBy (doctor ref), permissions{}, notificationPreferences{} |
| `patients` | Patient profiles | patientNumber (ALZ-XXXXXX), email, password, alzheimerLevel (early/middle/late), doctor (ref), family (ref), notes[], emergencyContact |
| `medications` | Prescriptions | patient (ref), prescribedBy (doctor ref), name, type, schedule[], medicationLogs[] |
| `moods` | Manual mood entries | patient, recordedBy (polymorphic), mood, moodScore 1–10, cognitiveState, behaviors, isAbnormal |
| `notifications` | In-app alerts | recipient (polymorphic), type (11 types), priority (4 levels), isRead, patient (ref) |
| `persons` | Face embeddings | name, age, relation, familyId (ref), patientId (ref), embeddings{model: [[float]]} |
| `counters` | Atomic sequences | name ('patientNumber'), seq (integer) |
| `dailyplans` | Daily schedules | patientId, date (day boundary), events[] (with embedded voice response audit) |
| `patientlocations` | GPS tracking | patientId (unique), lat, lng, accuracy, lastKnownStatus (inside/outside/unknown), history[50] |
| `safetyzones` | Geofences | patientId (unique), center{lat,lng}, radius (50–5000m), createdBy (family ref) |
| `aimoods` | AI emotion results | patientId, emotion (8 classes), confidence, allScores{}, scheduledTime, source |
| `moodschedules` | Check-in schedules | patientId, scheduledTimes[], isActive |
| `exercisetemplates` | Exercise definitions | key, name, type (5 types), defaultConfig{}, difficultyLevels[], isSystem |
| `cognitiveassignments` | Exercise assignments | patient, exerciseTemplate/album (ref), difficulty, config{}, isEnabled |
| `cognitiveschedules` | Recurring schedules | patient, assignments[], cronExpression, isActive |
| `cognitivesessions` | Play instances | patient, assignment, kind (exercise/album), status (lifecycle), content (generated payload), interactions[], result{} |
| `memoryalbums` | Photo albums | patient, title, category (7 types), coverImage, emotion, itemCount |
| `memoryitems` | Album media | album, patient, type (image/video/audio), mediaUrl, name, relationship, story, location |
| `cognitiveanalyticsevents` | Analytics log | patient, eventType, sessionId, score, exerciseType |

### File Storage

Static files are served from `backend/uploads/` at `/uploads/*`:
- `uploads/patients/` — profile images (format: `patientImage-{timestamp}-{random}.{ext}`)
- `uploads/doctors/` — doctor profile images
- `uploads/families/` — family profile images
- `uploads/memory/` — album cover images + media items + voice notes (up to 50 MB per file)

### Entity Relationship Summary

```
Doctor ──< Patient >── Family
           │
           ├──< Medication ──< MedicationLog
           ├──< Mood
           ├──< Notification (recipient: Doctor or Family)
           ├──< DailyPlan ──< Event (embedded)
           ├──< PatientLocation (1:1)
           ├── SafetyZone (1:1, created by Family)
           ├──< AIMood
           ├── MoodSchedule (1:1)
           ├──< MemoryAlbum ──< MemoryItem
           ├──< CognitiveAssignment
           └──< CognitiveSession

Family ──< Person (face embeddings, scoped to familyId + patientId)
```

---

## ⚙️ Configuration & Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description | Impact if Missing |
|---|---|---|---|---|
| `PORT` | No | `5001` | HTTP server port | Server runs on 5001 |
| `NODE_ENV` | No | `development` | Environment flag | Error stacks hidden in prod |
| `MONGODB_URI` | **Yes** | — | MongoDB Atlas connection string | Server crashes on startup |
| `JWT_SECRET` | **Yes** | — | Patient JWT signing secret | Patient auth broken |
| `DOCTOR_JWT_SECRET` | **Yes** | — | Doctor JWT signing secret | Doctor auth broken |
| `FAMILY_JWT_SECRET` | **Yes** | — | Family JWT signing secret | Family auth broken |
| `PATIENT_JWT_SECRET` | **Yes** | — | Alias for patient JWT (some middleware reads this) | Patient auth broken |
| `PYTHON_SERVICE_URL` | No | `http://localhost:8000` | Base URL for chatbot + daily plan AI service | Chatbot + voice intent analysis broken |
| `EMOTION_SERVICE_URL` | No | `http://localhost:8001` | Base URL for audio emotion analysis | AI mood check-ins broken |
| `SIMILARITY_THRESHOLD` | No | `0.45` | Face recognition match threshold (0–1) | Recognition sensitivity changes |
| `MAX_IMAGE_COUNT` | No | `20` | Max face registration images per person | Hard limit on enrollment |
| `STABILITY_BUFFER_SIZE` | No | `10` | Face recognition stability rolling buffer size | Stability metrics affected |

### Chatbot Python Service (`backend/modules/chatbot/python_service/.env`)

| Variable | Required | Default | Description | Impact if Missing |
|---|---|---|---|---|
| `GROQ_API_KEY` | **Yes** | — | Groq cloud API key (LLaMA-3.3-70b + LLaMA-3 8B) | All AI responses broken; fallback to rule engine for intent |
| `MONGODB_URI` | **Yes** | — | MongoDB connection for patient data lookup | Patient/family mode broken; falls back to general mode |
| `FAISS_INDEX_PATH` | No | `faiss_index` | Path to pre-built FAISS vector index | Knowledge base queries fail; error message returned |
| `DATA_PATH` | No | `data` | PDF source directory for `build_vector_store.py` | Only affects index rebuilding |
| `PYTHON_SERVICE_PORT` | No | `8000` | Chatbot service port | Service starts on 8000 |
| `NODE_SERVICE_ORIGIN` | No | `http://localhost:5001` | CORS allowlist origin for Node backend | Cross-origin requests from Node blocked |

### Frontend

The frontend API base URL is hardcoded in `frontend/src/modules/shared/api/api.js`:
```js
const API_BASE_URL = 'http://localhost:5001/api';
```

For production, this should be an environment variable via Vite's `import.meta.env.VITE_API_URL`.

---

## 🔗 External Integrations

| Service | Purpose | How Connected | Critical? |
|---|---|---|---|
| **MongoDB Atlas** | Primary database for all persistent data | Mongoose via `MONGODB_URI` connection string | **Yes** — system cannot start without it |
| **Groq Cloud API** | LLM inference (LLaMA-3.3-70b for chat, LLaMA-3 8B for voice intent) | HTTPS via `langchain-groq` in Python service | **Yes for AI** — chatbot returns error; voice intent falls back to rule engine |
| **HuggingFace Hub** | Download Wav2Vec2-base model weights on first run, MiniLM-L6-v2 embeddings | Auto-download via `transformers` / `sentence-transformers` | **Yes for AI Mood** — needs internet on first start |
| **Browser Geolocation API** | GPS coordinates from patient's device | `navigator.geolocation.watchPosition()` in LocationTracker.jsx | **Yes for location** — no location data without it |
| **Browser MediaDevices API** | Camera feed for face recognition | `navigator.mediaDevices.getUserMedia()` in PatientPage.jsx | **Yes for face recognition** |
| **Web Speech API / MediaRecorder** | Voice capture for check-ins | `useVoiceEngine.js` hook | **Yes for voice features** |
| **Python Face Embedding Service** | ArcFace face embeddings extraction | HTTP to configurable port via `mlClient.js` | **Yes for face recognition** — registration and recognition both fail |

---

## 🚀 Setup & Running Locally

### Prerequisites

- Node.js ≥ 18.0.0
- Python 3.11
- MongoDB Atlas account (or local MongoDB)
- Groq API key (free tier available at console.groq.com)
- `pip` and `venv`

### 1. Clone and Install Backend

```bash
cd backend
npm install
```

Create `backend/.env` from the template above with your MongoDB URI and JWT secrets.

### 2. Start the Node.js Backend

```bash
cd backend
npm run dev
# or: npm start
# Server runs on http://localhost:5001
```

### 3. Set Up the Chatbot Python Service

```bash
cd backend/modules/chatbot/python_service
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create `.env` in that directory with `GROQ_API_KEY` and `MONGODB_URI`.

**Build the FAISS vector index (one-time):**

```bash
python build_vector_store.py
# This reads all PDFs in data/ and writes faiss_index/
# Skip this step if faiss_index/ already exists
```

**Start the chatbot service:**

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
# Health check: http://localhost:8000/health
```

### 4. Set Up the Emotion Analysis Service

```bash
cd emotion_project
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Ensure `models/best.pt` exists (committed to repo). If not, train:

```bash
python train.py
# Trains for 30 epochs, saves models/best.pt + models/last.pt
```

**Start the emotion service:**

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
# Health check: http://localhost:8001/health
```

### 5. Install and Start the Frontend

```bash
cd frontend
npm install
npm run dev
# Vite dev server on http://localhost:5173
```

### 6. First-Time Setup

1. Navigate to `http://localhost:5173`
2. Go to `/auth/signup?type=doctor` to create a doctor account
3. Log in as doctor → create a patient from the dashboard
4. Create a family account for that patient (from the patient details page)
5. Log in as family → explore the family dashboard
6. Log in as patient at `/auth/login?type=patient`

### Summary of Ports

| Service | Port |
|---------|------|
| Node.js backend | 5001 |
| Python chatbot service | 8000 |
| Python emotion service | 8001 |
| React frontend (dev) | 5173 |
| Python face embedding service | configurable (check `mlClient.js`) |

---

## 🧪 Testing

There is no dedicated test suite in the current codebase (no test files were found in the repository). The project was developed as a graduation project and relies on manual QA.

**To manually test the system:**

```bash
# Backend health check
curl http://localhost:5001/api/health

# Chatbot service health
curl http://localhost:8000/health

# Emotion service health
curl http://localhost:8001/health
```

**Recommended testing approach for contributors:**

- Auth flows: use the frontend signup/login pages for each role
- API endpoints: use a REST client (Postman/Insomnia) against `http://localhost:5001/api/*`
- Daily plan voice: create a plan event, wait for the scheduler to fire, or trigger manually via the API
- Face recognition: register a person via family dashboard, open patient page, allow camera

---

## 📦 Deployment

No CI/CD pipeline, Dockerfile, or deployment configuration is present in the repository. The project is structured for local development. A production deployment would require:

**Backend:**
- Set `NODE_ENV=production`
- Use a process manager (PM2): `pm2 start server.js`
- Secure all JWT secrets (use strong random values, not the placeholder strings)
- Point `MONGODB_URI` to a production Atlas cluster

**Python Services:**
- Run both FastAPI services behind a reverse proxy (nginx/Caddy)
- Use Gunicorn + Uvicorn workers: `gunicorn -w 2 -k uvicorn.workers.UvicornWorker app:app`
- Pre-build the FAISS index before deploying

**Frontend:**
- Update `API_BASE_URL` in `api.js` to production backend URL (or use `import.meta.env.VITE_API_URL`)
- Build: `cd frontend && npm run build` → outputs to `frontend/dist/`
- Serve `dist/` as static files via nginx or CDN

---

## 🗺️ Feature Interaction Map

```
                         ┌─────────────────┐
                         │   Doctor Portal  │
                         └────────┬─────────┘
                                  │ creates
                    ┌─────────────┼──────────────┐
                    ▼             ▼               ▼
              ┌──────────┐  ┌──────────┐  ┌───────────┐
              │ Patients │  │Medications│  │  Family   │
              └────┬─────┘  └────┬──────┘  └─────┬─────┘
                   │             │                │
          ┌────────┼─────────────┼────────────────┼────────┐
          │        │             │                │        │
          ▼        ▼             ▼                ▼        ▼
    ┌──────────┐ ┌────────┐ ┌──────────────┐ ┌────────┐ ┌──────────┐
    │  Mood    │ │  Notes │ │  Daily Plan  │ │Location│ │Cognitive │
    │ Tracking │ │        │ │  + Scheduler │ │Tracking│ │Exercises │
    └────┬─────┘ └────────┘ └──────┬───────┘ └───┬────┘ └────┬─────┘
         │                         │             │            │
         │         ┌───────────────┤             │            │
         ▼         ▼               ▼             ▼            ▼
    ┌──────────────────────────────────────────────────────────────┐
    │                    Notifications System                      │
    │   (medication_missed, mood_abnormal, zone_alert, ...)        │
    └──────────────────────────────────┬───────────────────────────┘
                                       │ Socket.IO
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
           ┌─────────────────┐                  ┌──────────────────┐
           │  Family Portal  │                  │  Patient Device  │
           └─────────────────┘                  └──────────────────┘

    ┌───────────────────────────────────────────────────────────────┐
    │                     AI Layer (Python)                         │
    │                                                               │
    │  Chatbot Service (:8000)          Emotion Service (:8001)     │
    │  ┌─────────────────────┐          ┌────────────────────────┐  │
    │  │ FAISS RAG           │          │ Wav2Vec2 + MFCC model  │  │
    │  │ Groq LLaMA-3.3-70b  │          │ 8 emotion classes      │  │
    │  │ Anti-hallucination  │          │ Audio → emotion label  │  │
    │  │ Patient DB grounding│          └────────────┬───────────┘  │
    │  └──────────┬──────────┘                       │              │
    │             │                                  │              │
    │      Doctor/Family       Patient voice      Patient audio    │
    │       Assistant          intent analysis    mood check-in    │
    │      (AIAssistantPanel)  (Daily Plan svc)   (AIMood ctrl)    │
    └───────────────────────────────────────────────────────────────┘

    Memory Albums ──────feeds──────► Cognitive Exercise Engine
    (MemoryItem photos)              (face_recognition, memory_recall)

    Face Registration ─────used─────► Patient Face Recognition
    (Person + embeddings)            (PatientPage.jsx live camera)
```

---

## ⚠️ Known Limitations & Technical Debt

1. **Hardcoded frontend API URL.** `API_BASE_URL = 'http://localhost:5001/api'` is hardcoded in `frontend/src/modules/shared/api/api.js`. Must be changed to an env variable for any non-local deployment.

2. **No test suite.** No unit, integration, or e2e tests exist. All validation is manual. Refactoring carries significant regression risk.

3. **JWT secrets in .env are insecure placeholders.** The `.env` uses values like `alzcare_jwt_secret_key_2024_very_secure`. These must be replaced with cryptographically random secrets before any production use.

4. **GROQ_API_KEY committed to Python .env.** The file `backend/modules/chatbot/python_service/.env` contained a live Groq API key (already rotated in the cleanup commit). Ensure `.env` files are in `.gitignore`.

5. **No rate limiting.** There is no request rate limiting on any endpoint. The AI endpoints (chatbot, voice analyze) could be abused without rate limiting.

6. **Face embedding service not included.** The Python face embedding service (ArcFace/buffalo_l) that `mlClient.js` and the face recognition service depend on is referenced but not included in this repository. You must have a compatible embedder running at the configured URL.

7. **Emotion service is a standalone app, not HTTP-ready by default.** `emotion_project/app.py` is a CLI real-time mic loop. `emotion_project/main.py` (referenced by the backend) provides the FastAPI interface, but integration details depend on which file the backend actually calls.

8. **Socket.IO only supports localhost origins.** `ALLOWED_ORIGINS` in `socketManager.js` is hardcoded to localhost variants. Production requires updating this list.

9. **No HTTPS.** All services communicate over HTTP. TLS termination (nginx/load balancer) is required for production.

10. **Cognitive scheduler may create duplicate sessions.** If the server restarts mid-day, the cognitive scheduler could create additional scheduled sessions for patients who already have them for that day. An idempotency check should be added.

11. **Daily plan voice pipeline is one-shot.** The `ask_again` action (confused patient) is immediately collapsed to `mark_missed` by the guarantee layer rather than actually re-prompting the patient.

12. **No data migration strategy.** Schema changes require manual MongoDB updates. There is no migration tooling.

---

## 💡 Developer Reference: How to Add New Features

### Adding a new REST endpoint

1. Create/extend a controller in `backend/controllers/` or `backend/modules/<feature>/`
2. Create/extend a service in `backend/services/` or `backend/modules/<feature>/`
3. Register routes in the corresponding `*.routes.js` file
4. Mount the router in `backend/server.js` with `app.use('/api/<path>', yourRouter)`
5. Add the appropriate auth middleware (`protectDoctor`, `protectFamily`, `protectPatient`, or `protectDoctorOrFamily`)
6. Add the corresponding API call to `frontend/src/modules/shared/api/api.js`

### Adding a new Mongoose model

1. Create the schema in `backend/models/` or `backend/modules/<feature>/models/`
2. Export the model
3. If needed, add it to the relevant index.js for batch imports
4. For models with sequential IDs, add a Counter entry in `server.js` startup

### Adding a new notification type

1. Add the new type string to the `type` enum in `backend/models/Notification.model.js`
2. Add a static factory method on the Notification model (follow the existing `createMedicationReminder` pattern)
3. Call it from the relevant service with `emitToPatientRoom` for real-time delivery

### Adding a new cognitive exercise type

1. Add the type string to the `type` enum in `backend/modules/cognitive/models/ExerciseTemplate.model.js`
2. Add a generator function in `backend/modules/cognitive/utils/exerciseEngine.js`
3. Add a case in the `buildExerciseContent` switch and optionally update `scoreExercise`
4. Add the exercise template to the seed array in `backend/modules/cognitive/cognitive.seed.js`
5. Create a frontend player component under `frontend/src/features/patient/cognitive/components/players/`
6. Register it in `SessionPlayer.jsx` based on `content.type`

### Adding a new real-time Socket.IO event

1. Call `emitToPatientRoom(patientId, 'your:event', payload)` from any backend service
2. In the frontend, add a `socket.on('your:event', handler)` listener in the relevant component's `useEffect`
3. Ensure the patient room is joined: the `join:patient-room` event is emitted by `socketClient.js` on connect

### Adding a new user role

1. Create a new Mongoose model (follow Doctor/Family pattern)
2. Create auth middleware verifying the new JWT secret
3. Create auth routes + controller + service
4. Add a new token key in `frontend/src/modules/shared/api/api.js` tokenManager
5. Add a new protected route group in `frontend/src/App.jsx`

### Adding PDF documents to the AI knowledge base

1. Place PDF files in `backend/modules/chatbot/python_service/data/<category>/`
2. Run `python build_vector_store.py` inside the python_service directory
3. The new faiss_index will pick up all documents in the data tree on next startup
