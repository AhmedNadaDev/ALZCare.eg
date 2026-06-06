import MemoryItem from '../models/MemoryItem.model.js';

/**
 * exerciseEngine
 *
 * Generates the playable `content` for an exercise session from three inputs:
 *   - the exercise `type` (drives which generator runs)
 *   - the merged `config` (template defaults ← assignment overrides)
 *   - the `difficulty` (scales rounds / option counts / sequence length)
 *   - the patient's memory pool (photos with names power recognition/recall)
 *
 * All generators are pure data producers and degrade gracefully when the
 * memory pool is too small. Nothing about a specific game is hardcoded in the
 * services or controllers — adding a new exercise type means adding a
 * generator here plus a renderer on the frontend.
 */

const DIFFICULTY = {
  easy: { rounds: 4, options: 3, sequenceLen: 3, routineSteps: 4 },
  medium: { rounds: 6, options: 4, sequenceLen: 4, routineSteps: 5 },
  hard: { rounds: 8, options: 5, sequenceLen: 6, routineSteps: 6 },
};

const TILES = [
  { id: 'red', color: '#ef4444' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'green', color: '#22c55e' },
  { id: 'yellow', color: '#eab308' },
  { id: 'purple', color: '#a855f7' },
  { id: 'orange', color: '#f97316' },
];

const DEFAULT_ROUTINES = {
  morning: ['Wake up', 'Brush your teeth', 'Eat breakfast', 'Take morning medicine', 'Get dressed', 'Go for a short walk'],
  evening: ['Eat dinner', 'Take evening medicine', 'Brush your teeth', 'Put on pajamas', 'Read a little', 'Go to sleep'],
};

const DEFAULT_VOICE_PROMPTS = [
  'Please say your full name.',
  'What did you have for breakfast today?',
  'Can you name a family member you love?',
  'What is your favourite place to visit?',
  'Tell me one happy memory.',
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sample = (arr, n) => shuffle(arr).slice(0, Math.max(0, n));
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

/** Fetch the patient's named photos — the basis for recognition & recall. */
const getNamedPhotos = async (patientId) => {
  const items = await MemoryItem.find({
    patient: patientId,
    type: 'image',
    mediaUrl: { $ne: null },
    name: { $ne: null, $nin: ['', null] },
  })
    .select('mediaUrl thumbnailUrl name relationship story location emotion')
    .limit(200)
    .lean();
  return items.filter((i) => i.name && i.name.trim());
};

const buildChoiceRound = (index, { prompt, media, subtitle, correctLabel, distractors, optionCount }) => {
  const options = shuffle([correctLabel, ...sample(distractors, optionCount - 1)]).map((label, k) => ({
    id: `${index}-${k}`,
    label,
  }));
  const answer = options.find((o) => o.label === correctLabel)?.id ?? null;
  return { index, kind: 'choice', prompt, subtitle: subtitle || null, media: media || null, options, answer };
};

// ── Generators ────────────────────────────────────────────────────────────

const genFaceRecognition = async ({ cfg, patientId }) => {
  const photos = await getNamedPhotos(patientId);
  const allNames = uniq(photos.map((p) => p.name.trim()));

  if (photos.length < 2 || allNames.length < 2) {
    return {
      type: 'face_recognition',
      ready: false,
      reason: 'Add at least two photos with names to play Face Recognition.',
      instructions: 'Look at the photo and choose who it is.',
      totalRounds: 0,
      rounds: [],
    };
  }

  const chosen = sample(photos, Math.min(cfg.rounds, photos.length));
  const rounds = chosen.map((item, i) =>
    buildChoiceRound(i, {
      prompt: 'Who is this?',
      subtitle: item.relationship ? `Hint: ${item.relationship}` : null,
      media: { url: item.mediaUrl, type: 'image' },
      correctLabel: item.name.trim(),
      distractors: allNames.filter((n) => n !== item.name.trim()),
      optionCount: cfg.options,
    })
  );

  return {
    type: 'face_recognition',
    ready: true,
    instructions: 'Look at the photo and choose who it is.',
    totalRounds: rounds.length,
    rounds,
  };
};

const genMemoryRecall = async ({ cfg, patientId }) => {
  const photos = await getNamedPhotos(patientId);
  if (photos.length < 2) {
    return {
      type: 'memory_recall',
      ready: false,
      reason: 'Add at least two photos with details to play Memory Recall.',
      instructions: 'Look at the memory, then answer the question.',
      totalRounds: 0,
      rounds: [],
    };
  }

  const allNames = uniq(photos.map((p) => p.name?.trim()));
  const allRelationships = uniq(photos.map((p) => p.relationship?.trim()));
  const allLocations = uniq(photos.map((p) => p.location?.trim()));

  const chosen = sample(photos, Math.min(cfg.rounds, photos.length));
  const rounds = [];
  chosen.forEach((item, i) => {
    // Pick a question whose answer this item actually has, with ≥2 distractors.
    const candidates = [];
    if (item.name?.trim() && allNames.length >= 2)
      candidates.push({ q: 'What is the name of this person?', val: item.name.trim(), pool: allNames });
    if (item.relationship?.trim() && allRelationships.length >= 2)
      candidates.push({ q: 'What is their relationship to you?', val: item.relationship.trim(), pool: allRelationships });
    if (item.location?.trim() && allLocations.length >= 2)
      candidates.push({ q: 'Where was this memory?', val: item.location.trim(), pool: allLocations });
    if (!candidates.length) return;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    rounds.push(
      buildChoiceRound(i, {
        prompt: pick.q,
        media: { url: item.mediaUrl, type: 'image' },
        correctLabel: pick.val,
        distractors: pick.pool.filter((v) => v !== pick.val),
        optionCount: cfg.options,
      })
    );
  });

  return {
    type: 'memory_recall',
    ready: rounds.length > 0,
    reason: rounds.length === 0 ? 'Add more details (names, relationships, locations) to your photos.' : undefined,
    instructions: 'Look at the memory, then answer the question.',
    totalRounds: rounds.length,
    rounds,
  };
};

const genSequenceMemory = ({ cfg }) => {
  const tileCount = Math.min(cfg.options + 1, TILES.length);
  const tiles = TILES.slice(0, Math.max(3, tileCount));
  const sequence = Array.from({ length: cfg.sequenceLen }, () => tiles[Math.floor(Math.random() * tiles.length)].id);
  return {
    type: 'sequence_memory',
    ready: true,
    instructions: 'Watch the lights, then tap them in the same order.',
    tiles,
    sequence,
    totalRounds: sequence.length,
  };
};

const genDailyRoutine = ({ cfg, config }) => {
  const routineKey = config.routineKey || 'morning';
  const base =
    Array.isArray(config.steps) && config.steps.length >= 3
      ? config.steps
      : DEFAULT_ROUTINES[routineKey] || DEFAULT_ROUTINES.morning;

  const steps = base.slice(0, Math.max(3, Math.min(cfg.routineSteps, base.length)));
  const ordered = steps.map((label, i) => ({ id: `s${i}`, label }));
  const shuffled = shuffle(ordered);
  return {
    type: 'daily_routine',
    ready: true,
    instructions: 'Put the steps of your routine in the correct order.',
    routineKey,
    steps: shuffled, // presented out of order
    correctOrder: ordered.map((s) => s.id), // authoritative answer key
    totalRounds: ordered.length,
  };
};

const genVoiceRecognition = ({ cfg, config }) => {
  const source =
    Array.isArray(config.prompts) && config.prompts.length ? config.prompts : DEFAULT_VOICE_PROMPTS;
  const prompts = sample(source, Math.min(cfg.rounds, source.length)).map((text, i) => ({ index: i, text }));
  return {
    type: 'voice_recognition',
    ready: true,
    instructions: 'Listen to each prompt and answer out loud.',
    prompts,
    totalRounds: prompts.length,
  };
};

/**
 * Build content for a given exercise type.
 * @returns {Promise<object>} content payload with a `type` discriminator.
 */
export const buildExerciseContent = async ({ type, difficulty = 'easy', config = {}, patientId }) => {
  const base = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  // Allow explicit numeric overrides from config (data-driven tuning).
  const cfg = {
    rounds: config.rounds || base.rounds,
    options: config.optionsPerRound || config.options || base.options,
    sequenceLen: config.sequenceLength || base.sequenceLen,
    routineSteps: config.routineSteps || base.routineSteps,
  };

  switch (type) {
    case 'face_recognition':
      return genFaceRecognition({ cfg, patientId });
    case 'memory_recall':
      return genMemoryRecall({ cfg, patientId });
    case 'sequence_memory':
      return genSequenceMemory({ cfg });
    case 'daily_routine':
      return genDailyRoutine({ cfg, config });
    case 'voice_recognition':
      return genVoiceRecognition({ cfg, config });
    default:
      return { type, ready: false, reason: `Unknown exercise type: ${type}`, totalRounds: 0, rounds: [] };
  }
};

/**
 * Authoritatively score a finished exercise session from the reported
 * interactions and the stored content. Falls back to client-reported
 * correctness when an answer key is unavailable (e.g. voice exercises).
 */
export const scoreExercise = ({ content, interactions = [] }) => {
  const total = content?.totalRounds || interactions.length || 0;

  let correct = 0;
  let answered = 0;

  if (content?.type === 'daily_routine') {
    // Single submission: interactions[0].meta.order = array of step ids
    const submitted = interactions[0]?.meta?.order || interactions[0]?.answer || [];
    const order = Array.isArray(submitted) ? submitted : [];
    answered = order.length ? total : 0;
    correct = (content.correctOrder || []).reduce(
      (acc, id, idx) => acc + (order[idx] === id ? 1 : 0),
      0
    );
  } else if (content?.type === 'sequence_memory') {
    const submitted = interactions[0]?.meta?.sequence || interactions[0]?.answer || [];
    const seq = Array.isArray(submitted) ? submitted : [];
    answered = seq.length ? total : 0;
    correct = (content.sequence || []).reduce((acc, id, idx) => acc + (seq[idx] === id ? 1 : 0), 0);
  } else {
    // Choice / voice rounds: one interaction per round
    for (const it of interactions) {
      if (it.correct === true) {
        correct += 1;
        answered += 1;
      } else if (it.correct === false) {
        answered += 1;
      } else if (it.answer != null || it.kind === 'voice') {
        // voice / engagement rounds without a key count as answered
        answered += 1;
        if (content?.type === 'voice_recognition') correct += 1;
      }
    }
  }

  const completionRate = total > 0 ? Math.round((answered / total) * 100) : 0;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  const mistakes = Math.max(0, answered - correct);

  return { score, completionRate, correct, total, mistakes };
};
