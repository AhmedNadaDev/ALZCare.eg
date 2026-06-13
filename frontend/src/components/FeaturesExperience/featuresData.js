/**
 * FeaturesExperience — content + choreography model
 *
 * One source of truth shared by the 3D watch screen, the orbiting DOM nodes,
 * the connector lines, the progress rail and the captions.
 *
 * Orbit angles are measured CLOCKWISE from 12 o'clock (0 = top, 90 = right,
 * 180 = bottom, 270 = left). The nine nodes are spread across the top 300°
 * arc, deliberately leaving the bottom ~60° clear for the caption scrim.
 */
import {
  MoodIcon,
  FaceIcon,
  LocationIcon,
  MedicationIcon,
  MemoryIcon,
  VoiceIcon,
  EmergencyIcon,
  ScheduleIcon,
  ChatbotIcon,
} from './icons.jsx';

// Activation order follows the scroll story (mood → … → assistant).
export const FEATURES = [
  {
    id: 'mood',
    kicker: 'AI Mood Detection',
    title: 'Understand Emotional Changes\nBefore They Escalate',
    description:
      'On-device voice emotion analysis reads subtle shifts in tone and alerts caregivers in real time — so you respond with care, not guesswork.',
    points: ['Voice emotion analysis', 'Detects emotional changes', 'Real-time caregiver insight'],
    accent: '#c084fc',
    screenLabel: 'Mood',
    motif: 'wave',
    Icon: MoodIcon,
  },
  {
    id: 'face',
    kicker: 'Face Recognition Assistance',
    title: 'Never Forget\na Loved One Again',
    description:
      'The watch gently recognizes family and friends and surfaces their name — dissolving the anxiety of an unfamiliar face.',
    points: ['Identifies family members', 'Reduces confusion & anxiety', 'Real-time recognition'],
    accent: '#a78bfa',
    screenLabel: 'Recognize',
    motif: 'faceScan',
    Icon: FaceIcon,
  },
  {
    id: 'location',
    kicker: 'Smart Location Tracking',
    title: "Know They're Safe,\nWherever They Go",
    description:
      'Live GPS, geofencing and safe-zone alerts mean peace of mind the moment they step beyond a trusted boundary.',
    points: ['Live GPS tracking', 'Geofencing', 'Safety-zone alerts'],
    accent: '#22d3ee',
    screenLabel: 'Location',
    motif: 'radar',
    Icon: LocationIcon,
  },
  {
    id: 'medication',
    kicker: 'Medication Management',
    title: 'Never Miss\na Critical Dose',
    description:
      'Smart reminders, missed-dose detection and instant caregiver notifications keep every medication on schedule.',
    points: ['Smart reminders', 'Missed-dose detection', 'Caregiver notifications'],
    accent: '#f0abfc',
    screenLabel: 'Meds',
    motif: 'pill',
    Icon: MedicationIcon,
  },
  {
    id: 'memory',
    kicker: 'Memory Assistant',
    title: 'Keep Precious\nMemories Alive',
    description:
      'Personalized cognitive exercises and family photo albums turn the watch into a daily companion for the mind.',
    points: ['Cognitive exercises', 'Memory training', 'Family photo albums'],
    accent: '#34d399',
    screenLabel: 'Memory',
    motif: 'album',
    Icon: MemoryIcon,
  },
  {
    id: 'voice',
    kicker: 'Voice-Based Interaction',
    title: 'As Simple\nas Speaking',
    description:
      'Natural, elder-friendly conversation — no menus, no buttons. Just talk, and the watch listens and responds.',
    points: ['Natural conversations', 'Speech understanding', 'Elder-friendly design'],
    accent: '#d8b4fe',
    screenLabel: 'Voice',
    motif: 'voiceBars',
    Icon: VoiceIcon,
  },
  {
    id: 'emergency',
    kicker: 'Emergency Assistance',
    title: 'Help Is\nOne Touch Away',
    description:
      'One tap fires an alert with live location to every caregiver — turning frightening moments into fast responses.',
    points: ['One-tap emergency alert', 'Live location sharing', 'Instant caregiver notice'],
    accent: '#fb7185',
    screenLabel: 'SOS',
    motif: 'sos',
    Icon: EmergencyIcon,
  },
  {
    id: 'schedule',
    kicker: 'Daily Schedule Assistant',
    title: 'Bring Calm Structure\nto Every Day',
    description:
      'Personalized routines, appointment reminders and gentle activity guidance reduce confusion from morning to night.',
    points: ['Personalized routines', 'Appointment reminders', 'Daily activity guidance'],
    accent: '#60a5fa',
    screenLabel: 'Today',
    motif: 'clock',
    Icon: ScheduleIcon,
  },
  {
    id: 'chatbot',
    kicker: "Alzheimer's AI Assistant",
    title: 'Expert Guidance,\nAlways on the Wrist',
    description:
      "A specialized assistant trained on Alzheimer's care answers questions and supports caregivers, day or night.",
    points: ['Specialized AI chatbot', 'Alzheimer-focused knowledge', 'Caregiver support'],
    accent: '#a78bfa',
    screenLabel: 'Assist',
    motif: 'chat',
    Icon: ChatbotIcon,
  },
];

export const FEATURE_COUNT = FEATURES.length;

// 220° arc fanned across the top + sides; the bottom ~140° is left clear so the
// nodes never collide with the bottom caption.
const ARC_START = -110;
const ARC_END = 110;
FEATURES.forEach((f, i) => {
  f.index = i;
  f.angle = ARC_START + ((ARC_END - ARC_START) * i) / (FEATURE_COUNT - 1);
});

/**
 * Stage map (drives discrete React state — changes ~12 times over the scroll):
 *   0            → intro (watch powers on)
 *   1..N         → feature i = stage - 1 active
 *   N+1          → "all connect" (every node + line lit)
 *   N+2          → final message
 */
export const STAGE = {
  INTRO: 0,
  FIRST_FEATURE: 1,
  CONNECT: FEATURE_COUNT + 1,
  FINAL: FEATURE_COUNT + 2,
};
export const TOTAL_STAGES = FEATURE_COUNT + 3; // intro + 9 + connect + final

// Progress band boundaries (0..1) for the scrubbed timeline.
export const BANDS = {
  introEnd: 0.07,
  featuresEnd: 0.84, // features occupy introEnd..featuresEnd
  connectEnd: 0.93, // connect occupies featuresEnd..connectEnd
  // final occupies connectEnd..1
};

/** Map continuous scroll progress (0..1) → discrete stage id. */
export function progressToStage(p) {
  if (p < BANDS.introEnd) return STAGE.INTRO;
  if (p < BANDS.featuresEnd) {
    const t = (p - BANDS.introEnd) / (BANDS.featuresEnd - BANDS.introEnd);
    const i = Math.min(FEATURE_COUNT - 1, Math.floor(t * FEATURE_COUNT));
    return STAGE.FIRST_FEATURE + i;
  }
  if (p < BANDS.connectEnd) return STAGE.CONNECT;
  return STAGE.FINAL;
}

/** Center progress (0..1) of a feature stage — used for click-to-jump. */
export function featureCenterProgress(featureIndex) {
  const span = BANDS.featuresEnd - BANDS.introEnd;
  return BANDS.introEnd + (span * (featureIndex + 0.5)) / FEATURE_COUNT;
}

export const stageToFeatureIndex = (stage) =>
  stage >= STAGE.FIRST_FEATURE && stage <= FEATURE_COUNT ? stage - STAGE.FIRST_FEATURE : -1;

export const SECTION_COPY = {
  eyebrow: 'ONE INTELLIGENT WATCH',
  headline: 'Nine capabilities.\nWorn on one wrist.',
  introTitle: 'Meet the watch that\nnever stops caring.',
  introSub: 'Everything below lives inside a single device on your loved one’s wrist.',
  connectTitle: 'Nine capabilities,\nworking as one.',
  connectSub: 'Every signal flows back to one intelligent watch — and on to the people who care.',
  finalTitle: 'Everything your loved one needs.\nOne intelligent smartwatch.',
  finalSub: 'ALZCare turns continuous, compassionate care into something you can simply wear.',
};
