/**
 * ALZCare Comprehensive Data Population Script
 * Creates realistic production-like data for all application features
 *
 * Run: node backend/seed.mjs
 */

import 'dotenv/config';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim();
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Dynamic imports of all models
// ─────────────────────────────────────────────────────────────
const { default: Doctor }   = await import('./models/Doctor.model.js');
const { default: Patient }  = await import('./models/Patient.model.js');
const { default: Family }   = await import('./models/Family.model.js');
const { default: Counter }  = await import('./models/Counter.model.js');
const { default: Medication } = await import('./models/Medication.model.js');
const { default: Mood }     = await import('./models/Mood.model.js');
const { default: Notification } = await import('./models/Notification.model.js');
const { default: PatientLocation } = await import('./modules/location/location.model.js');
const { default: SafetyZone }      = await import('./modules/safetyZone/safetyZone.model.js');
const { default: DailyPlan }       = await import('./modules/dailyPlan/dailyPlan.model.js');
const { default: ExerciseTemplate } = await import('./modules/cognitive/models/ExerciseTemplate.model.js');
const { default: CognitiveAssignment } = await import('./modules/cognitive/models/CognitiveAssignment.model.js');
const { default: CognitiveSchedule }   = await import('./modules/cognitive/models/CognitiveSchedule.model.js');
const { default: CognitiveSession }    = await import('./modules/cognitive/models/CognitiveSession.model.js');
const { default: MemoryAlbum }    = await import('./modules/cognitive/models/MemoryAlbum.model.js');
const { default: MemoryItem }     = await import('./modules/cognitive/models/MemoryItem.model.js');
const { default: CognitiveAnalyticsEvent } = await import('./modules/cognitive/models/CognitiveAnalyticsEvent.model.js');

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;
const hashPw = (pw) => bcrypt.hash(pw, SALT_ROUNDS);

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysBefore = (base, n) => { const d = new Date(base); d.setDate(d.getDate() - n); return d; };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rndFloat(min, max) { return +(Math.random() * (max - min) + min).toFixed(6); }

const log = (msg) => console.log(`[SEED] ${msg}`);
const section = (title) => console.log(`\n${'='.repeat(60)}\n  ${title}\n${'='.repeat(60)}`);

// ─────────────────────────────────────────────────────────────
// Credential storage (printed at the end)
// ─────────────────────────────────────────────────────────────
const CREDENTIALS = { doctors: [], families: [], patients: [] };

// ─────────────────────────────────────────────────────────────
// Connect
// ─────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env');
  log(`Connecting to MongoDB…`);
  await mongoose.connect(uri);
  log('Connected.');
}

// ─────────────────────────────────────────────────────────────
// Seed exercise templates (idempotent — same as server startup)
// ─────────────────────────────────────────────────────────────
async function seedExerciseTemplates() {
  section('Exercise Templates');
  const templates = [
    {
      key: 'face_recognition',
      name: 'Face Recognition',
      description: 'Identify familiar faces from your personal photos',
      type: 'face_recognition',
      defaultConfig: { rounds: 5, optionsPerRound: 3 },
      difficultyLevels: ['easy', 'medium', 'hard'],
      isSystem: true,
      isActive: true,
    },
    {
      key: 'memory_recall',
      name: 'Memory Recall',
      description: 'Remember names and stories from your memory albums',
      type: 'memory_recall',
      defaultConfig: { rounds: 5, optionsPerRound: 3 },
      difficultyLevels: ['easy', 'medium', 'hard'],
      isSystem: true,
      isActive: true,
    },
    {
      key: 'sequence_memory',
      name: 'Sequence Memory',
      description: 'Watch a pattern and repeat it in the correct order',
      type: 'sequence_memory',
      defaultConfig: { sequenceLength: 3 },
      difficultyLevels: ['easy', 'medium', 'hard'],
      isSystem: true,
      isActive: true,
    },
    {
      key: 'daily_routine',
      name: 'Daily Routine',
      description: 'Practice ordering your morning and evening activities',
      type: 'daily_routine',
      defaultConfig: { routineKey: 'morning' },
      difficultyLevels: ['easy', 'medium', 'hard'],
      isSystem: true,
      isActive: true,
    },
    {
      key: 'voice_recognition',
      name: 'Voice Recognition',
      description: 'Listen to a question and answer it verbally',
      type: 'voice_recognition',
      defaultConfig: { rounds: 4 },
      difficultyLevels: ['easy', 'medium', 'hard'],
      isSystem: true,
      isActive: true,
    },
  ];

  for (const t of templates) {
    await ExerciseTemplate.findOneAndUpdate({ key: t.key }, t, { upsert: true, new: true });
    log(`  Template: ${t.name}`);
  }
  return ExerciseTemplate.find({ isSystem: true });
}

// ─────────────────────────────────────────────────────────────
// Doctors
// ─────────────────────────────────────────────────────────────
const DOCTORS_DATA = [
  {
    firstName: 'Ahmed', lastName: 'Hassan',
    email: 'dr.ahmed.hassan@alzcare.eg',
    password: 'Doctor@1234',
    licenseNumber: 'EG-NEURO-001',
    specialization: 'Neurology',
    hospital: 'Cairo University Hospital',
    phone: '+20 100 234 5678',
    isVerified: true,
  },
  {
    firstName: 'Sara', lastName: 'Mahmoud',
    email: 'dr.sara.mahmoud@alzcare.eg',
    password: 'Doctor@5678',
    licenseNumber: 'EG-NEURO-002',
    specialization: 'Geriatric Neurology',
    hospital: 'Ain Shams Medical Center',
    phone: '+20 101 345 6789',
    isVerified: true,
  },
  {
    firstName: 'Karim', lastName: 'Farouk',
    email: 'dr.karim.farouk@alzcare.eg',
    password: 'Doctor@9012',
    licenseNumber: 'EG-NEURO-003',
    specialization: 'Cognitive Disorders',
    hospital: 'Alexandria Medical Complex',
    phone: '+20 102 456 7890',
    isVerified: true,
  },
];

async function seedDoctors() {
  section('Doctors');
  const saved = [];
  for (const d of DOCTORS_DATA) {
    let doc = await Doctor.findOne({ email: d.email });
    if (!doc) {
      doc = new Doctor({ ...d });
      await doc.save();
      log(`  Created doctor: Dr. ${d.firstName} ${d.lastName}`);
    } else {
      log(`  Existing doctor: Dr. ${d.firstName} ${d.lastName}`);
    }
    saved.push(doc);
    CREDENTIALS.doctors.push({
      name: `Dr. ${d.firstName} ${d.lastName}`,
      email: d.email,
      password: d.password,
      hospital: d.hospital,
    });
  }
  return saved;
}

// ─────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────
const PATIENTS_DATA = [
  // Doctor 0 – Ahmed Hassan
  {
    firstName: 'Mohamed', lastName: 'Ali',
    email: 'patient.mohamed.ali@alzcare.eg', password: 'Patient@1234',
    dateOfBirth: new Date('1948-03-12'), age: 78, gender: 'male',
    alzheimerLevel: 'middle',
    diagnosisDate: daysAgo(540),
    description: 'Retired engineer, mild to moderate Alzheimer\'s, responds well to structured routines.',
    medicalHistory: 'Hypertension (controlled), Type 2 diabetes, mild hearing loss',
    allergies: ['Penicillin'],
    address: { street: '14 El-Nasr Road', city: 'Cairo', state: 'Cairo', zipCode: '11511', country: 'Egypt' },
    emergencyContact: { name: 'Fatima Ali', phone: '+20 100 111 2222', relationship: 'Wife' },
  },
  {
    firstName: 'Nadia', lastName: 'Ibrahim',
    email: 'patient.nadia.ibrahim@alzcare.eg', password: 'Patient@2345',
    dateOfBirth: new Date('1952-07-22'), age: 73, gender: 'female',
    alzheimerLevel: 'early',
    diagnosisDate: daysAgo(180),
    description: 'Former teacher, early-stage diagnosis, still independent in most activities.',
    medicalHistory: 'Osteoporosis, mild depression',
    allergies: [],
    address: { street: '7 Tahrir Square Area', city: 'Cairo', state: 'Cairo', zipCode: '11512', country: 'Egypt' },
    emergencyContact: { name: 'Omar Ibrahim', phone: '+20 101 222 3333', relationship: 'Son' },
  },
  {
    firstName: 'Hassan', lastName: 'Youssef',
    email: 'patient.hassan.youssef@alzcare.eg', password: 'Patient@3456',
    dateOfBirth: new Date('1944-11-05'), age: 81, gender: 'male',
    alzheimerLevel: 'late',
    diagnosisDate: daysAgo(900),
    description: 'Advanced stage, requires full-time care, communicates through gestures.',
    medicalHistory: 'Atrial fibrillation, osteoarthritis, previous stroke (2019)',
    allergies: ['Aspirin', 'Sulfa drugs'],
    address: { street: '22 Heliopolis Street', city: 'Cairo', state: 'Cairo', zipCode: '11361', country: 'Egypt' },
    emergencyContact: { name: 'Layla Youssef', phone: '+20 102 333 4444', relationship: 'Daughter' },
  },
  // Doctor 1 – Sara Mahmoud
  {
    firstName: 'Fatima', lastName: 'Khalil',
    email: 'patient.fatima.khalil@alzcare.eg', password: 'Patient@4567',
    dateOfBirth: new Date('1950-05-18'), age: 75, gender: 'female',
    alzheimerLevel: 'early',
    diagnosisDate: daysAgo(365),
    description: 'Retired accountant, very active mentally, engaged with family.',
    medicalHistory: 'Hypothyroidism, mild anxiety',
    allergies: [],
    address: { street: '3 Corniche El-Nil', city: 'Giza', state: 'Giza', zipCode: '12511', country: 'Egypt' },
    emergencyContact: { name: 'Walid Khalil', phone: '+20 100 444 5555', relationship: 'Husband' },
  },
  {
    firstName: 'Ibrahim', lastName: 'Saad',
    email: 'patient.ibrahim.saad@alzcare.eg', password: 'Patient@5678',
    dateOfBirth: new Date('1946-09-30'), age: 79, gender: 'male',
    alzheimerLevel: 'middle',
    diagnosisDate: daysAgo(730),
    description: 'Former government official, moderate stage, benefits from music therapy.',
    medicalHistory: 'Parkinson\'s co-morbidity, hypertension, chronic kidney disease',
    allergies: ['Ibuprofen'],
    address: { street: '15 El-Geish Road', city: 'Mansoura', state: 'Dakahlia', zipCode: '35511', country: 'Egypt' },
    emergencyContact: { name: 'Mona Saad', phone: '+20 101 555 6666', relationship: 'Daughter' },
  },
  // Doctor 2 – Karim Farouk
  {
    firstName: 'Amina', lastName: 'Rashid',
    email: 'patient.amina.rashid@alzcare.eg', password: 'Patient@6789',
    dateOfBirth: new Date('1955-02-14'), age: 71, gender: 'female',
    alzheimerLevel: 'early',
    diagnosisDate: daysAgo(90),
    description: 'Recently diagnosed, managing well with medication and family support.',
    medicalHistory: 'Type 2 diabetes, bilateral cataract surgery (2021)',
    allergies: ['Metformin (intolerance)'],
    address: { street: '8 Mohamed Ali Street', city: 'Alexandria', state: 'Alexandria', zipCode: '21511', country: 'Egypt' },
    emergencyContact: { name: 'Tarek Rashid', phone: '+20 102 666 7777', relationship: 'Son' },
  },
  {
    firstName: 'Mahmoud', lastName: 'Nasser',
    email: 'patient.mahmoud.nasser@alzcare.eg', password: 'Patient@7890',
    dateOfBirth: new Date('1942-12-20'), age: 83, gender: 'male',
    alzheimerLevel: 'late',
    diagnosisDate: daysAgo(1095),
    description: 'Advanced dementia, resides in care facility, family visits weekly.',
    medicalHistory: 'Congestive heart failure, COPD, severe depression',
    allergies: ['Codeine'],
    address: { street: '1 El-Corniche', city: 'Alexandria', state: 'Alexandria', zipCode: '21512', country: 'Egypt' },
    emergencyContact: { name: 'Rania Nasser', phone: '+20 100 777 8888', relationship: 'Daughter' },
  },
];

// Which patients belong to which doctors (by index)
const DOCTOR_PATIENT_MAP = {
  0: [0, 1, 2],  // Dr. Ahmed → Mohamed, Nadia, Hassan
  1: [3, 4],     // Dr. Sara → Fatima, Ibrahim
  2: [5, 6],     // Dr. Karim → Amina, Mahmoud
};

async function seedPatients(doctors) {
  section('Patients');
  const saved = [];
  for (const [doctorIdx, patientIdxList] of Object.entries(DOCTOR_PATIENT_MAP)) {
    const doctor = doctors[doctorIdx];
    for (const pIdx of patientIdxList) {
      const pd = PATIENTS_DATA[pIdx];
      let patient = await Patient.findOne({ email: pd.email });
      if (!patient) {
        patient = new Patient({
          ...pd,
          doctor: doctor._id,
          notes: [
            {
              content: `Initial assessment: ${pd.description}`,
              createdBy: doctor._id,
              createdAt: pd.diagnosisDate,
            },
          ],
          lastCheckup: daysAgo(rnd(7, 30)),
          nextAppointment: new Date(Date.now() + rnd(7, 45) * 86400000),
        });
        await patient.save();
        log(`  Created patient: ${pd.firstName} ${pd.lastName} (${patient.patientNumber})`);
      } else {
        log(`  Existing patient: ${pd.firstName} ${pd.lastName} (${patient.patientNumber})`);
      }

      // Add patient ref to doctor's patients array
      if (!doctor.patients.includes(patient._id)) {
        doctor.patients.push(patient._id);
      }

      saved.push({ patient, doctor, pIdx });
      CREDENTIALS.patients.push({
        name: `${pd.firstName} ${pd.lastName}`,
        patientNumber: patient.patientNumber,
        email: pd.email,
        password: pd.password,
        alzheimerLevel: pd.alzheimerLevel,
        doctor: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      });
    }
    await doctor.save();
  }
  return saved;
}

// ─────────────────────────────────────────────────────────────
// Family Accounts
// ─────────────────────────────────────────────────────────────
const FAMILY_TEMPLATES = {
  // patientEmail → list of family members to create
  'patient.mohamed.ali@alzcare.eg': [
    { firstName: 'Fatima', lastName: 'Ali', email: 'fatima.ali@family.eg', password: 'Family@1234', relationship: 'spouse', phone: '+20 100 111 2222' },
    { firstName: 'Omar', lastName: 'Ali', email: 'omar.ali@family.eg', password: 'Family@2345', relationship: 'child', phone: '+20 101 112 2223' },
  ],
  'patient.nadia.ibrahim@alzcare.eg': [
    { firstName: 'Omar', lastName: 'Ibrahim', email: 'omar.ibrahim@family.eg', password: 'Family@3456', relationship: 'child', phone: '+20 101 222 3333' },
    { firstName: 'Heba', lastName: 'Ibrahim', email: 'heba.ibrahim@family.eg', password: 'Family@4567', relationship: 'child', phone: '+20 102 223 3334' },
  ],
  'patient.hassan.youssef@alzcare.eg': [
    { firstName: 'Layla', lastName: 'Youssef', email: 'layla.youssef@family.eg', password: 'Family@5678', relationship: 'child', phone: '+20 102 333 4444' },
  ],
  'patient.fatima.khalil@alzcare.eg': [
    { firstName: 'Walid', lastName: 'Khalil', email: 'walid.khalil@family.eg', password: 'Family@6789', relationship: 'spouse', phone: '+20 100 444 5555' },
    { firstName: 'Dina', lastName: 'Khalil', email: 'dina.khalil@family.eg', password: 'Family@7890', relationship: 'child', phone: '+20 101 445 5556' },
  ],
  'patient.ibrahim.saad@alzcare.eg': [
    { firstName: 'Mona', lastName: 'Saad', email: 'mona.saad@family.eg', password: 'Family@8901', relationship: 'child', phone: '+20 101 555 6666' },
  ],
  'patient.amina.rashid@alzcare.eg': [
    { firstName: 'Tarek', lastName: 'Rashid', email: 'tarek.rashid@family.eg', password: 'Family@9012', relationship: 'child', phone: '+20 102 666 7777' },
    { firstName: 'Nour', lastName: 'Rashid', email: 'nour.rashid@family.eg', password: 'Family@0123', relationship: 'sibling', phone: '+20 100 667 7778' },
  ],
  'patient.mahmoud.nasser@alzcare.eg': [
    { firstName: 'Rania', lastName: 'Nasser', email: 'rania.nasser@family.eg', password: 'Family@1235', relationship: 'child', phone: '+20 100 777 8888' },
  ],
};

async function seedFamilies(patientRecords) {
  section('Family Accounts');
  const familyMap = {}; // patientId → first family member (for linking patient.family)

  for (const { patient, doctor } of patientRecords) {
    const templates = FAMILY_TEMPLATES[patient.email] || [];
    let firstFamily = null;

    for (const ft of templates) {
      let fam = await Family.findOne({ email: ft.email });
      if (!fam) {
        fam = new Family({
          ...ft,
          patient: patient._id,
          createdBy: doctor._id,
          permissions: {
            canViewMedications: true,
            canConfirmMedication: true,
            canAddMoodEntry: true,
            canViewHistory: true,
            canContactDoctor: true,
          },
          notificationPreferences: {
            email: true,
            push: true,
            medicationReminders: true,
            appointmentReminders: true,
          },
        });
        await fam.save();
        log(`  Created family: ${ft.firstName} ${ft.lastName} (${ft.relationship} of ${patient.firstName})`);
      } else {
        log(`  Existing family: ${ft.firstName} ${ft.lastName}`);
      }
      if (!firstFamily) firstFamily = fam;

      CREDENTIALS.families.push({
        name: `${ft.firstName} ${ft.lastName}`,
        email: ft.email,
        password: ft.password,
        relationship: ft.relationship,
        patientName: `${patient.firstName} ${patient.lastName}`,
      });
    }

    // Link first family member to patient
    if (firstFamily && !patient.family) {
      patient.family = firstFamily._id;
      await patient.save();
    }
    if (firstFamily) familyMap[patient._id.toString()] = firstFamily;
  }
  return familyMap;
}

// ─────────────────────────────────────────────────────────────
// Medications
// ─────────────────────────────────────────────────────────────
const MED_POOL = [
  { name: 'Donepezil', genericName: 'Donepezil HCl', type: 'tablet', strength: '10mg', purpose: 'Alzheimer\'s treatment — cholinesterase inhibitor', instructions: 'Take once daily at bedtime with or without food', sideEffects: ['nausea', 'diarrhea', 'insomnia'] },
  { name: 'Memantine', genericName: 'Memantine HCl', type: 'tablet', strength: '10mg', purpose: 'Moderate-to-severe Alzheimer\'s', instructions: 'Take twice daily with water', sideEffects: ['dizziness', 'headache', 'confusion'] },
  { name: 'Rivastigmine', genericName: 'Rivastigmine tartrate', type: 'capsule', strength: '6mg', purpose: 'Alzheimer\'s and Parkinson\'s dementia', instructions: 'Take with morning and evening meals', sideEffects: ['nausea', 'vomiting', 'anorexia'] },
  { name: 'Aricept', genericName: 'Donepezil', type: 'tablet', strength: '5mg', purpose: 'Memory improvement', instructions: 'Take once daily in the evening', sideEffects: ['muscle cramps', 'fatigue'] },
  { name: 'Metformin', genericName: 'Metformin HCl', type: 'tablet', strength: '500mg', purpose: 'Blood sugar control', instructions: 'Take with meals twice daily', sideEffects: ['stomach upset', 'diarrhea'] },
  { name: 'Atorvastatin', genericName: 'Atorvastatin calcium', type: 'tablet', strength: '20mg', purpose: 'Cholesterol management', instructions: 'Take once daily at the same time', sideEffects: ['muscle pain', 'liver enzyme elevation'] },
  { name: 'Amlodipine', genericName: 'Amlodipine besylate', type: 'tablet', strength: '5mg', purpose: 'Blood pressure control', instructions: 'Take once daily', sideEffects: ['edema', 'flushing'] },
  { name: 'Sertraline', genericName: 'Sertraline HCl', type: 'tablet', strength: '50mg', purpose: 'Depression and anxiety management', instructions: 'Take once daily in the morning', sideEffects: ['nausea', 'dry mouth', 'insomnia'] },
  { name: 'Lorazepam', genericName: 'Lorazepam', type: 'tablet', strength: '0.5mg', purpose: 'Anxiety and agitation', instructions: 'Take as needed, not more than twice daily', sideEffects: ['drowsiness', 'dizziness'] },
  { name: 'Levothyroxine', genericName: 'Levothyroxine sodium', type: 'tablet', strength: '75mcg', purpose: 'Thyroid hormone replacement', instructions: 'Take 30 minutes before breakfast on empty stomach', sideEffects: ['palpitations if overdosed'] },
  { name: 'Omeprazole', genericName: 'Omeprazole', type: 'capsule', strength: '20mg', purpose: 'Stomach acid reduction', instructions: 'Take 30 minutes before meal', sideEffects: ['headache', 'diarrhea'] },
  { name: 'Vitamin D3', genericName: 'Cholecalciferol', type: 'capsule', strength: '1000 IU', purpose: 'Bone health and immune support', instructions: 'Take once daily with main meal', sideEffects: [] },
];

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function buildSchedule() {
  const schedules = [];
  const numTimes = rnd(1, 3);
  const times = ['08:00', '12:00', '14:00', '18:00', '20:00', '22:00'].slice(0, numTimes);
  for (const time of times) {
    const days = rnd(0, 1) === 0 ? ALL_DAYS : ALL_DAYS.filter(() => Math.random() > 0.2);
    schedules.push({ time, days: days.length ? days : ALL_DAYS, dosage: '1 unit' });
  }
  return schedules;
}

function buildMedLogs(schedule, startDate, daysCount) {
  const logs = [];
  for (let d = daysCount; d >= 0; d--) {
    const date = daysAgo(d);
    const dow = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
    for (const s of schedule) {
      if (!s.days.includes(dow)) continue;
      const rand = Math.random();
      let status, takenAt;
      if (rand < 0.75) { status = 'taken'; takenAt = new Date(date); takenAt.setHours(...s.time.split(':'), 0, 0); takenAt.setMinutes(takenAt.getMinutes() + rnd(-5, 20)); }
      else if (rand < 0.90) { status = 'missed'; takenAt = null; }
      else { status = 'skipped'; takenAt = null; }
      logs.push({
        scheduledDate: startOfDay(date),
        scheduledTime: s.time,
        status,
        takenAt,
        confirmedByModel: 'Family',
      });
    }
  }
  return logs;
}

async function seedMedications(patientRecords) {
  section('Medications');
  const medMap = {}; // patientId → [medicationIds]

  for (const { patient, doctor } of patientRecords) {
    const count = rnd(2, 4);
    const meds = [];
    const pool = [...MED_POOL].sort(() => Math.random() - 0.5).slice(0, count);

    for (const mp of pool) {
      let med = await Medication.findOne({ patient: patient._id, name: mp.name });
      if (!med) {
        const schedule = buildSchedule();
        const startDate = daysBefore(new Date(), rnd(60, 180));
        med = new Medication({
          patient: patient._id,
          prescribedBy: doctor._id,
          ...mp,
          schedule,
          startDate,
          medicationLogs: buildMedLogs(schedule, startDate, 90),
          isActive: true,
          refillReminder: { enabled: true, daysBeforeRefill: 7 },
        });
        await med.save();
        meds.push(med);
        log(`  Medication: ${mp.name} for ${patient.firstName}`);
      } else {
        meds.push(med);
      }
    }
    medMap[patient._id.toString()] = meds;
  }
  return medMap;
}

// ─────────────────────────────────────────────────────────────
// Moods
// ─────────────────────────────────────────────────────────────
const MOOD_OPTIONS = ['very_happy', 'happy', 'neutral', 'sad', 'very_sad', 'anxious', 'confused', 'agitated', 'calm', 'sleepy'];
const MOOD_SCORES = { very_happy: [8,10], happy: [7,9], neutral: [5,7], sad: [3,5], very_sad: [1,3], anxious: [2,5], confused: [2,4], agitated: [1,3], calm: [6,9], sleepy: [4,7] };
const ENERGY_LEVELS = ['very_low', 'low', 'moderate', 'high', 'very_high'];
const SLEEP_QUALITY = ['poor', 'fair', 'good', 'excellent'];
const BEHAVIORS = ['wandering', 'repetitive_questions', 'sundowning', 'aggression', 'withdrawal', 'restlessness', 'none'];
const PHYSICAL_SYMPTOMS = ['headache', 'fatigue', 'pain', 'nausea', 'dizziness', 'tremors', 'none'];

function moodScoreForLevel(mood) {
  const [lo, hi] = MOOD_SCORES[mood];
  return rnd(lo, hi);
}

async function seedMoods(patientRecords, familyMap) {
  section('Mood Entries');
  let total = 0;

  for (const { patient, doctor } of patientRecords) {
    const family = familyMap[patient._id.toString()];
    const daysBack = 90;

    for (let d = daysBack; d >= 0; d--) {
      if (Math.random() > 0.65) continue; // ~35% days have mood entry
      const recordedAt = daysAgo(d);
      recordedAt.setHours(rnd(8, 20), rnd(0, 59), 0, 0);

      const mood = pick(MOOD_OPTIONS);
      // Skew mood based on alzheimer level
      const moodOverride = patient.alzheimerLevel === 'late' ? pick(['confused', 'agitated', 'anxious', 'sad', mood]) : mood;
      const moodScore = moodScoreForLevel(moodOverride);
      const useFamily = family && Math.random() > 0.3;
      const recorder = useFamily ? family : doctor;
      const recorderModel = useFamily ? 'Family' : 'Doctor';

      const behaviors = Math.random() > 0.6 ? [pick(BEHAVIORS)] : ['none'];
      const entry = new Mood({
        patient: patient._id,
        recordedBy: recorder._id,
        recordedByModel: recorderModel,
        mood: moodOverride,
        moodScore,
        energy: pick(ENERGY_LEVELS),
        sleep: {
          quality: pick(SLEEP_QUALITY),
          hours: rnd(4, 9),
          disturbances: Math.random() > 0.6,
        },
        appetite: pick(['poor', 'reduced', 'normal', 'increased']),
        cognitiveState: {
          clarity: pick(['confused', 'somewhat_confused', 'mostly_clear', 'clear']),
          recognition: pick(['none', 'some', 'most', 'all']),
          communication: pick(['nonverbal', 'limited', 'moderate', 'good']),
        },
        physicalSymptoms: Math.random() > 0.5 ? [pick(PHYSICAL_SYMPTOMS)] : ['none'],
        behaviors,
        recordedAt,
        notes: Math.random() > 0.7 ? `Patient appeared ${moodOverride} during the observation.` : undefined,
      });
      await entry.save();
      total++;
    }
    log(`  Mood entries for ${patient.firstName}: done`);
  }
  log(`  Total mood entries: ${total}`);
}

// ─────────────────────────────────────────────────────────────
// Daily Plans
// ─────────────────────────────────────────────────────────────
const EVENT_TEMPLATES = [
  { title: 'Wake Up & Morning Hygiene', type: 'wake_up', scheduledTime: '07:00', voicePrompt: { text: 'Good morning! Time to wake up and freshen up. Have you brushed your teeth and washed your face?', requireResponse: true } },
  { title: 'Breakfast', type: 'custom', scheduledTime: '08:00', voicePrompt: { text: 'Breakfast time! Please eat your morning meal. Have you had your breakfast?', requireResponse: true } },
  { title: 'Morning Walk', type: 'custom', scheduledTime: '09:30', voicePrompt: { text: 'Time for your morning walk. Please take a short walk around the garden or living room.', requireResponse: true } },
  { title: 'Lunch', type: 'custom', scheduledTime: '13:00', voicePrompt: { text: 'Lunch time! Please have your midday meal. Did you enjoy your lunch?', requireResponse: true } },
  { title: 'Afternoon Rest', type: 'custom', scheduledTime: '15:00', voicePrompt: { text: 'Afternoon rest time. Would you like to sit and relax for a bit?', requireResponse: true } },
  { title: 'Family Call', type: 'custom', scheduledTime: '17:00', voicePrompt: { text: 'Your family wants to talk with you. Are you ready for a quick call?', requireResponse: true } },
  { title: 'Dinner', type: 'custom', scheduledTime: '19:00', voicePrompt: { text: 'Dinner time! Please have your evening meal. Have you eaten dinner?', requireResponse: true } },
  { title: 'Evening Hygiene', type: 'custom', scheduledTime: '20:30', voicePrompt: { text: 'Time to get ready for bed. Please brush your teeth and put on your night clothes.', requireResponse: true } },
  { title: 'Bedtime', type: 'custom', scheduledTime: '21:30', voicePrompt: { text: 'Goodnight! Time to rest and sleep well. Sweet dreams!', requireResponse: false } },
];

function buildDayEvents(medList, daysAgoN) {
  const date = daysAgo(daysAgoN);
  const isPast = daysAgoN > 0;
  const events = [];

  for (const tpl of EVENT_TEMPLATES) {
    const rand = Math.random();
    let status = 'pending';
    let completedAt = null;
    let responseConfirmed = false;

    if (isPast) {
      if (rand < 0.70) { status = 'completed'; completedAt = new Date(date); completedAt.setHours(...tpl.scheduledTime.split(':'), rnd(0, 15), 0); responseConfirmed = true; }
      else if (rand < 0.90) { status = 'missed'; }
      else { status = 'pending'; }
    }

    events.push({
      title: tpl.title,
      type: tpl.type,
      scheduledTime: tpl.scheduledTime,
      status,
      voicePrompt: tpl.voicePrompt,
      response: isPast && status !== 'pending' ? {
        text: status === 'completed' ? 'Yes' : null,
        confirmed: responseConfirmed,
        respondedAt: completedAt,
        aiIntent: status === 'completed' ? 'confirm_taken' : 'deny_taken',
        aiConfidence: status === 'completed' ? 0.9 : 0.7,
        aiAction: status === 'completed' ? 'mark_completed' : 'mark_missed',
        finalAction: status === 'completed' ? 'mark_completed' : 'mark_missed',
        decisionSource: 'rule_engine',
        riskLevel: status === 'completed' ? 'low' : 'medium',
        reasoning: status === 'completed' ? 'Patient confirmed completion.' : 'No response detected.',
      } : {},
      completedAt,
    });
  }

  // Add medication events
  for (const med of medList.slice(0, 2)) {
    if (!med.schedule || med.schedule.length === 0) continue;
    const s = med.schedule[0];
    const rand = Math.random();
    const status = isPast ? (rand < 0.75 ? 'completed' : 'missed') : 'pending';
    events.push({
      title: `Take ${med.name}`,
      type: 'medication',
      scheduledTime: s.time,
      status,
      voicePrompt: { text: `Time to take your ${med.name} (${s.dosage}). Have you taken your medication?`, requireResponse: true },
      medicationId: med._id,
      completedAt: status === 'completed' ? new Date(date) : null,
    });
  }

  return { date: startOfDay(date), events };
}

async function seedDailyPlans(patientRecords, medMap, familyMap) {
  section('Daily Plans');
  let total = 0;

  for (const { patient, doctor } of patientRecords) {
    const meds = medMap[patient._id.toString()] || [];
    const family = familyMap[patient._id.toString()];
    const creator = family || doctor;
    const creatorModel = family ? 'Family' : 'Doctor';

    for (let d = 60; d >= 0; d--) {
      if (d > 0 && Math.random() > 0.85) continue; // skip some past days

      const existing = await DailyPlan.findOne({ patientId: patient._id, date: startOfDay(daysAgo(d)) });
      if (existing) continue;

      const { date, events } = buildDayEvents(meds, d);
      const plan = new DailyPlan({
        patientId: patient._id,
        date,
        events,
        createdBy: creator._id,
        createdByModel: creatorModel,
      });
      await plan.save();
      total++;
    }
    log(`  Daily plans for ${patient.firstName}: done`);
  }
  log(`  Total daily plans: ${total}`);
}

// ─────────────────────────────────────────────────────────────
// Location & Safety Zones
// ─────────────────────────────────────────────────────────────
const BASE_LOCATIONS = [
  { lat: 30.0444, lng: 31.2357 }, // Cairo
  { lat: 30.0600, lng: 31.2200 }, // Cairo North
  { lat: 29.9797, lng: 31.1336 }, // Giza
  { lat: 31.2001, lng: 29.9187 }, // Alexandria
  { lat: 31.0409, lng: 31.3785 }, // Mansoura
  { lat: 31.0500, lng: 31.3500 }, // Mansoura area
  { lat: 31.1800, lng: 29.9000 }, // Alexandria area
];

async function seedLocations(patientRecords, familyMap) {
  section('Locations & Safety Zones');

  for (let i = 0; i < patientRecords.length; i++) {
    const { patient } = patientRecords[i];
    const base = BASE_LOCATIONS[i % BASE_LOCATIONS.length];
    const family = familyMap[patient._id.toString()];

    // PatientLocation — upsert
    const historyEntries = [];
    for (let h = 50; h >= 0; h--) {
      historyEntries.push({
        lat: base.lat + rndFloat(-0.005, 0.005),
        lng: base.lng + rndFloat(-0.005, 0.005),
        recordedAt: daysAgo(h),
      });
    }

    await PatientLocation.findOneAndUpdate(
      { patientId: patient._id },
      {
        patientId: patient._id,
        lat: base.lat + rndFloat(-0.002, 0.002),
        lng: base.lng + rndFloat(-0.002, 0.002),
        accuracy: rnd(5, 30),
        lastKnownStatus: pick(['inside', 'inside', 'inside', 'outside']),
        history: historyEntries.slice(-50),
      },
      { upsert: true, new: true }
    );

    // SafetyZone — upsert (requires family)
    if (family) {
      await SafetyZone.findOneAndUpdate(
        { patientId: patient._id },
        {
          patientId: patient._id,
          center: { lat: base.lat, lng: base.lng },
          radius: rnd(150, 500),
          createdBy: family._id,
        },
        { upsert: true, new: true }
      );
    }
    log(`  Location + safety zone for ${patient.firstName}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Memory Albums + Items
// ─────────────────────────────────────────────────────────────
const ALBUM_TEMPLATES = [
  {
    title: 'Our Family', category: 'family', emotion: 'love',
    description: 'Precious moments with family',
    items: [
      { name: 'Mohamed', relationship: 'Son', story: 'My eldest son Mohamed on his graduation day. He was so proud.', emotion: 'joy', location: 'Cairo University' },
      { name: 'Fatima', relationship: 'Daughter', story: 'Fatima during Eid celebrations. She always wore the red dress.', emotion: 'love', location: 'Home' },
      { name: 'Ahmed', relationship: 'Grandson', story: 'Little Ahmed, my youngest grandson. He loves playing football.', emotion: 'joy', location: 'Garden' },
      { name: 'Nour', relationship: 'Wife', story: 'My wife on our 40th wedding anniversary dinner.', emotion: 'love', location: 'Cairo Restaurant' },
    ],
  },
  {
    title: 'Special Places', category: 'places', emotion: 'nostalgia',
    description: 'Places that mean a lot to me',
    items: [
      { name: 'Old House', relationship: '', story: 'The house I grew up in on El-Nasr Road. I spent 30 years there.', emotion: 'nostalgia', location: 'Heliopolis, Cairo' },
      { name: 'Family Farm', relationship: '', story: 'Our summer farm where we picked mangoes every July.', emotion: 'joy', location: 'Fayoum' },
      { name: 'Mosque', relationship: '', story: 'The neighborhood mosque where I prayed for 50 years.', emotion: 'calm', location: 'Cairo' },
    ],
  },
  {
    title: 'Friends & Colleagues', category: 'friends', emotion: 'love',
    description: 'Friends I have known for decades',
    items: [
      { name: 'Dr. Tarek', relationship: 'Old friend', story: 'My best friend from university. We studied engineering together.', emotion: 'joy', location: 'Cairo University' },
      { name: 'Abu Hassan', relationship: 'Neighbor', story: 'My neighbor of 25 years. We played backgammon every evening.', emotion: 'nostalgia', location: 'Our street' },
    ],
  },
  {
    title: 'Happy Memories', category: 'events', emotion: 'joy',
    description: 'Events and celebrations',
    items: [
      { name: 'Graduation', relationship: '', story: 'My graduation from engineering school in 1972. The proudest day.', emotion: 'pride', location: 'Cairo University' },
      { name: 'Wedding Day', relationship: '', story: 'Our wedding ceremony. The whole family was there.', emotion: 'love', location: 'Cairo' },
      { name: 'New Year 2000', relationship: '', story: 'Welcoming the millennium with the whole family.', emotion: 'joy', location: 'Home' },
    ],
  },
  {
    title: 'My Achievements', category: 'achievements', emotion: 'pride',
    description: 'Things I am proud of',
    items: [
      { name: 'Engineering Certificate', relationship: '', story: 'My first engineering project certificate from 1974.', emotion: 'pride', location: 'Work' },
      { name: 'Hajj Journey', relationship: '', story: 'My Hajj pilgrimage in 1995 with my wife.', emotion: 'calm', location: 'Mecca' },
    ],
  },
];

async function seedMemoryAlbums(patientRecords, familyMap) {
  section('Memory Albums & Items');
  const albumMap = {}; // patientId → [albums]

  for (const { patient } of patientRecords) {
    const family = familyMap[patient._id.toString()];
    if (!family) continue;

    const count = rnd(2, 4);
    const templates = ALBUM_TEMPLATES.slice(0, count);
    const albums = [];

    for (const tpl of templates) {
      let album = await MemoryAlbum.findOne({ patient: patient._id, title: tpl.title });
      if (!album) {
        album = new MemoryAlbum({
          patient: patient._id,
          title: tpl.title,
          category: tpl.category,
          emotion: tpl.emotion,
          description: tpl.description,
          itemCount: 0,
          createdBy: family._id,
          createdByModel: 'Family',
        });
        await album.save();

        // Add items
        for (let idx = 0; idx < tpl.items.length; idx++) {
          const it = tpl.items[idx];
          const item = new MemoryItem({
            album: album._id,
            patient: patient._id,
            type: 'text',
            name: it.name,
            relationship: it.relationship,
            story: it.story,
            emotion: it.emotion,
            location: it.location,
            order: idx,
            takenAt: daysAgo(rnd(30, 3650)),
          });
          await item.save();
        }

        // Update itemCount
        album.itemCount = tpl.items.length;
        await album.save();
        log(`  Album: "${tpl.title}" (${tpl.items.length} items) for ${patient.firstName}`);
      }
      albums.push(album);
    }
    albumMap[patient._id.toString()] = albums;
  }
  return albumMap;
}

// ─────────────────────────────────────────────────────────────
// Cognitive Assignments, Sessions, Schedules, Analytics
// ─────────────────────────────────────────────────────────────
function buildExerciseContent(type, difficulty) {
  const cfg = {
    easy: { rounds: 4, options: 3, sequenceLen: 3, routineSteps: 4 },
    medium: { rounds: 6, options: 4, sequenceLen: 4, routineSteps: 5 },
    hard: { rounds: 8, options: 5, sequenceLen: 6, routineSteps: 6 },
  }[difficulty] || { rounds: 4, options: 3, sequenceLen: 3, routineSteps: 4 };

  switch (type) {
    case 'face_recognition':
    case 'memory_recall':
      return {
        type,
        rounds: Array.from({ length: cfg.rounds }, (_, i) => ({
          targetId: `item_${i}`,
          targetName: `Person ${i + 1}`,
          options: Array.from({ length: cfg.options }, (_, j) => ({
            id: j === 0 ? `item_${i}` : `item_distractor_${i}_${j}`,
            name: j === 0 ? `Person ${i + 1}` : `Other Person ${j}`,
            isCorrect: j === 0,
          })),
        })),
      };
    case 'sequence_memory':
      return {
        type,
        sequence: Array.from({ length: cfg.sequenceLen }, () => pick(['🔴', '🔵', '🟢', '🟡', '🟠'])),
      };
    case 'daily_routine':
      return {
        type,
        steps: ['Wake Up', 'Brush Teeth', 'Wash Face', 'Get Dressed', 'Have Breakfast'].slice(0, cfg.routineSteps),
        correctOrder: Array.from({ length: cfg.routineSteps }, (_, i) => i),
      };
    case 'voice_recognition':
      return {
        type,
        rounds: Array.from({ length: cfg.rounds }, (_, i) => ({
          prompt: ['What is your name?', 'What year is it?', 'What did you have for breakfast?', 'How are you feeling today?'][i % 4],
          expectedKeywords: ['name', 'year', 'breakfast', 'feeling'],
        })),
      };
    default:
      return { type };
  }
}

function buildInteractions(type, content, status) {
  if (status === 'completed') {
    switch (type) {
      case 'face_recognition':
      case 'memory_recall': {
        return (content.rounds || []).map((r) => ({
          kind: 'answer',
          correct: Math.random() > 0.3,
          meta: { selectedId: r.options[0].id },
          occurredAt: new Date(),
        }));
      }
      case 'sequence_memory':
        return [{ kind: 'answer', correct: Math.random() > 0.35, meta: { sequence: content.sequence || [] }, occurredAt: new Date() }];
      case 'daily_routine':
        return [{ kind: 'answer', correct: Math.random() > 0.4, meta: { order: content.correctOrder || [] }, occurredAt: new Date() }];
      case 'voice_recognition':
        return (content.rounds || []).map((r) => ({ kind: 'answer', correct: true, meta: { transcript: 'I answered.' }, occurredAt: new Date() }));
      default:
        return [];
    }
  }
  return [];
}

function scoreSession(type, interactions) {
  if (!interactions || interactions.length === 0) return { score: 0, completionRate: 0 };
  const total = interactions.length;
  const correct = interactions.filter(i => i.correct).length;
  const score = Math.round((correct / total) * 100);
  return { score, completionRate: Math.round((total / total) * 100) };
}

async function seedCognitive(patientRecords, albumMap, familyMap, templates) {
  section('Cognitive Assignments, Sessions & Schedules');

  const templateMap = {};
  for (const t of templates) templateMap[t.type] = t;

  for (const { patient } of patientRecords) {
    const family = familyMap[patient._id.toString()];
    const albums = albumMap[patient._id.toString()] || [];
    const creator = family;
    if (!creator) continue;

    // Create one assignment per exercise type
    const assignmentMap = {};
    for (const tpl of templates) {
      let assignment = await CognitiveAssignment.findOne({ patient: patient._id, exerciseTemplate: tpl._id });
      if (!assignment) {
        assignment = new CognitiveAssignment({
          patient: patient._id,
          kind: 'exercise',
          exerciseTemplate: tpl._id,
          exerciseType: tpl.type,
          title: tpl.name,
          difficulty: pick(['easy', 'easy', 'medium']),
          enabled: true,
          createdBy: creator._id,
          createdByModel: 'Family',
        });
        await assignment.save();
      }
      assignmentMap[tpl.type] = assignment;
    }

    // Create album assignments for first 2 albums
    const albumAssignments = [];
    for (const album of albums.slice(0, 2)) {
      let asgn = await CognitiveAssignment.findOne({ patient: patient._id, album: album._id });
      if (!asgn) {
        asgn = new CognitiveAssignment({
          patient: patient._id,
          kind: 'album',
          album: album._id,
          title: album.title,
          difficulty: 'easy',
          enabled: true,
          createdBy: creator._id,
          createdByModel: 'Family',
        });
        await asgn.save();
      }
      albumAssignments.push(asgn);
    }

    // Create schedules for a few assignments
    const scheduleableAssignments = Object.values(assignmentMap).slice(0, 3);
    for (const asgn of scheduleableAssignments) {
      const existing = await CognitiveSchedule.findOne({ patient: patient._id, assignment: asgn._id });
      if (!existing) {
        await new CognitiveSchedule({
          patient: patient._id,
          assignment: asgn._id,
          recurrence: pick(['daily', 'daily', 'weekly']),
          daysOfWeek: pick([['monday', 'wednesday', 'friday'], ALL_DAYS]),
          time: pick(['09:00', '15:00', '18:00', '20:00']),
          isActive: true,
        }).save();
      }
    }

    // Create sessions spanning the last 30 days
    for (const [type, asgn] of Object.entries(assignmentMap)) {
      for (let d = 30; d >= 1; d--) {
        if (Math.random() > 0.45) continue;

        const statusRand = Math.random();
        const status = statusRand < 0.65 ? 'completed' : statusRand < 0.80 ? 'abandoned' : 'missed';
        const content = buildExerciseContent(type, asgn.difficulty);
        const interactions = buildInteractions(type, content, status);
        const { score, completionRate } = scoreSession(type, interactions);

        const sessionDate = daysAgo(d);
        sessionDate.setHours(rnd(8, 21), rnd(0, 59), 0, 0);

        const session = new CognitiveSession({
          patient: patient._id,
          assignment: asgn._id,
          kind: 'exercise',
          status,
          source: 'scheduled',
          content,
          interactions,
          score: status === 'completed' ? score : null,
          completionRate: status === 'completed' ? completionRate : null,
          result: status === 'completed' ? { correctCount: interactions.filter(i => i.correct).length, totalCount: interactions.length, passed: score >= 60 } : {},
          startedAt: sessionDate,
          completedAt: status === 'completed' ? new Date(sessionDate.getTime() + rnd(3, 12) * 60000) : null,
        });
        await session.save();

        // Analytics event
        if (status === 'completed') {
          await new CognitiveAnalyticsEvent({
            patient: patient._id,
            session: session._id,
            type: 'session_completed',
            kind: 'exercise',
            exerciseType: type,
            value: score,
            occurredAt: sessionDate,
            hourOfDay: sessionDate.getHours(),
            dayOfWeek: sessionDate.getDay(),
          }).save();
        }
      }
    }

    // Album sessions
    for (const asgn of albumAssignments) {
      for (let d = 20; d >= 1; d--) {
        if (Math.random() > 0.4) continue;
        const status = Math.random() > 0.3 ? 'completed' : 'abandoned';
        const sessionDate = daysAgo(d);
        sessionDate.setHours(rnd(14, 20), 0, 0, 0);

        await new CognitiveSession({
          patient: patient._id,
          assignment: asgn._id,
          kind: 'album',
          status,
          source: 'manual',
          content: { type: 'album' },
          interactions: status === 'completed' ? [{ kind: 'view', correct: null, meta: { viewed: true }, occurredAt: sessionDate }] : [],
          startedAt: sessionDate,
          completedAt: status === 'completed' ? new Date(sessionDate.getTime() + rnd(5, 15) * 60000) : null,
        }).save();
      }
    }
    log(`  Cognitive data for ${patient.firstName}: done`);
  }
}

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────
async function seedNotifications(patientRecords, medMap, familyMap, doctors) {
  section('Notifications');
  let total = 0;

  const notifTemplates = [
    { type: 'medication_reminder', priority: 'high', title: 'Medication Reminder', message: (p, m) => `Time to give ${p.firstName} their ${m.name}`, recipientModel: 'Family' },
    { type: 'medication_missed', priority: 'urgent', title: 'Missed Medication Alert', message: (p, m) => `${p.firstName} missed their ${m.name} dose`, recipientModel: 'Family' },
    { type: 'medication_taken', priority: 'low', title: 'Medication Confirmed', message: (p, m) => `${p.firstName} has taken their ${m.name}`, recipientModel: 'Doctor' },
    { type: 'mood_abnormal', priority: 'high', title: 'Abnormal Mood Detected', message: (p) => `${p.firstName} is showing signs of confusion and agitation today`, recipientModel: 'Family' },
    { type: 'mood_entry', priority: 'low', title: 'Mood Entry Added', message: (p) => `New mood entry added for ${p.firstName}`, recipientModel: 'Doctor' },
    { type: 'patient_update', priority: 'medium', title: 'Patient Status Update', message: (p) => `${p.firstName}'s condition has been updated by the care team`, recipientModel: 'Family' },
    { type: 'system_alert', priority: 'medium', title: 'System Notification', message: (p) => `New appointment scheduled for ${p.firstName}`, recipientModel: 'Family' },
    { type: 'zone_alert', priority: 'urgent', title: 'Safety Zone Alert', message: (p) => `${p.firstName} has left the designated safety zone!`, recipientModel: 'Family' },
    { type: 'appointment_reminder', priority: 'medium', title: 'Appointment Reminder', message: (p) => `Reminder: ${p.firstName}'s next checkup is coming up`, recipientModel: 'Family' },
  ];

  for (const { patient, doctor } of patientRecords) {
    const family = familyMap[patient._id.toString()];
    const meds = medMap[patient._id.toString()] || [];
    const med = meds[0];

    for (const tpl of notifTemplates) {
      const count = rnd(2, 5);
      for (let i = 0; i < count; i++) {
        let recipient, recipientModel;
        if (tpl.recipientModel === 'Family' && family) { recipient = family; recipientModel = 'Family'; }
        else { recipient = doctor; recipientModel = 'Doctor'; }

        const createdAt = daysAgo(rnd(0, 60));
        const isRead = Math.random() > 0.4;

        await new Notification({
          recipient: recipient._id,
          recipientModel,
          patient: patient._id,
          type: tpl.type,
          priority: tpl.priority,
          title: tpl.title,
          message: tpl.message(patient, med || { name: 'medication' }),
          isRead,
          readAt: isRead ? new Date(createdAt.getTime() + rnd(1, 120) * 60000) : null,
          createdAt,
          data: { patientId: patient._id, patientName: `${patient.firstName} ${patient.lastName}` },
        }).save();
        total++;
      }
    }
    log(`  Notifications for ${patient.firstName}: done`);
  }
  log(`  Total notifications: ${total}`);
}

// ─────────────────────────────────────────────────────────────
// Final report
// ─────────────────────────────────────────────────────────────
async function printReport() {
  section('VERIFICATION COUNTS');

  const counts = {
    doctors: await Doctor.countDocuments(),
    patients: await Patient.countDocuments(),
    families: await Family.countDocuments(),
    medications: await Medication.countDocuments(),
    moodEntries: await Mood.countDocuments(),
    dailyPlans: await DailyPlan.countDocuments(),
    notifications: await Notification.countDocuments(),
    patientLocations: await PatientLocation.countDocuments(),
    safetyZones: await SafetyZone.countDocuments(),
    memoryAlbums: await MemoryAlbum.countDocuments(),
    memoryItems: await MemoryItem.countDocuments(),
    cognitiveAssignments: await CognitiveAssignment.countDocuments(),
    cognitiveSchedules: await CognitiveSchedule.countDocuments(),
    cognitiveSessions: await CognitiveSession.countDocuments(),
    analyticsEvents: await CognitiveAnalyticsEvent.countDocuments(),
    exerciseTemplates: await ExerciseTemplate.countDocuments(),
  };

  console.log('\n' + '─'.repeat(60));
  for (const [key, val] of Object.entries(counts)) {
    console.log(`  ${key.padEnd(30)} ${val}`);
  }
  console.log('─'.repeat(60));

  section('LOGIN CREDENTIALS');

  console.log('\n📋 DOCTORS:');
  console.log('─'.repeat(80));
  for (const d of CREDENTIALS.doctors) {
    console.log(`  Name:     ${d.name}`);
    console.log(`  Email:    ${d.email}`);
    console.log(`  Password: ${d.password}`);
    console.log(`  Hospital: ${d.hospital}`);
    console.log('');
  }

  console.log('\n👨‍👩‍👧 FAMILY ACCOUNTS:');
  console.log('─'.repeat(80));
  for (const f of CREDENTIALS.families) {
    console.log(`  Name:         ${f.name}`);
    console.log(`  Email:        ${f.email}`);
    console.log(`  Password:     ${f.password}`);
    console.log(`  Relationship: ${f.relationship}`);
    console.log(`  Patient:      ${f.patientName}`);
    console.log('');
  }

  console.log('\n🏥 PATIENTS:');
  console.log('─'.repeat(80));
  for (const p of CREDENTIALS.patients) {
    console.log(`  Name:    ${p.name}`);
    console.log(`  Number:  ${p.patientNumber}`);
    console.log(`  Email:   ${p.email}`);
    console.log(`  Password:${p.password}`);
    console.log(`  Level:   ${p.alzheimerLevel}`);
    console.log(`  Doctor:  ${p.doctor}`);
    console.log('');
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  try {
    await connect();

    const templates     = await seedExerciseTemplates();
    const doctors       = await seedDoctors();
    const patientRecs   = await seedPatients(doctors);
    const familyMap     = await seedFamilies(patientRecs);
    const medMap        = await seedMedications(patientRecs);
    await seedMoods(patientRecs, familyMap);
    await seedDailyPlans(patientRecs, medMap, familyMap);
    await seedLocations(patientRecs, familyMap);
    const albumMap      = await seedMemoryAlbums(patientRecs, familyMap);
    await seedCognitive(patientRecs, albumMap, familyMap, templates);
    await seedNotifications(patientRecs, medMap, familyMap, doctors);

    await printReport();

    section('SEED COMPLETE');
    log('All data populated successfully.');
  } catch (err) {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
