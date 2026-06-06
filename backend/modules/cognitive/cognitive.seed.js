/**
 * cognitive.seed.js
 *
 * Idempotently seeds the system ExerciseTemplate catalogue. Templates are
 * data-driven: each carries the default config the engine and frontend
 * renderer consume. Run on startup (like the patientNumber counter seed).
 * Uses upsert-by-key so re-running never duplicates and lets us evolve
 * defaults over time.
 */

import ExerciseTemplate from './models/ExerciseTemplate.model.js';

const SYSTEM_TEMPLATES = [
  {
    key: 'face_recognition',
    name: 'Face Recognition',
    type: 'face_recognition',
    description: "Recognise loved ones from the patient's own photos. Strengthens facial memory and personal connection.",
    icon: 'users',
    skills: ['recognition', 'memory', 'connection'],
    defaultConfig: { rounds: 5, optionsPerRound: 3 },
    defaultDurationSec: 180,
    order: 1,
  },
  {
    key: 'memory_recall',
    name: 'Memory Recall',
    type: 'memory_recall',
    description: 'Answer simple questions about cherished memories — names, relationships and places.',
    icon: 'sparkles',
    skills: ['recall', 'attention'],
    defaultConfig: { rounds: 5, optionsPerRound: 3 },
    defaultDurationSec: 180,
    order: 2,
  },
  {
    key: 'sequence_memory',
    name: 'Sequence Memory',
    type: 'sequence_memory',
    description: 'Watch a sequence of lights, then repeat it. Builds short-term and working memory.',
    icon: 'grid',
    skills: ['working_memory', 'attention'],
    defaultConfig: { sequenceLength: 3 },
    defaultDurationSec: 150,
    order: 3,
  },
  {
    key: 'daily_routine',
    name: 'Daily Routine Recall',
    type: 'daily_routine',
    description: 'Put the steps of a daily routine in the right order. Reinforces independence and structure.',
    icon: 'list',
    skills: ['sequencing', 'executive_function'],
    defaultConfig: { routineKey: 'morning' },
    defaultDurationSec: 150,
    order: 4,
  },
  {
    key: 'voice_recognition',
    name: 'Voice Recognition',
    type: 'voice_recognition',
    description: 'Respond out loud to gentle spoken prompts. Encourages verbal engagement and language.',
    icon: 'mic',
    skills: ['language', 'verbal_recall'],
    defaultConfig: { rounds: 4 },
    defaultDurationSec: 180,
    order: 5,
  },
];

export async function seedExerciseTemplates() {
  let created = 0;
  for (const tpl of SYSTEM_TEMPLATES) {
    const res = await ExerciseTemplate.updateOne(
      { key: tpl.key },
      {
        $set: {
          name: tpl.name,
          type: tpl.type,
          description: tpl.description,
          icon: tpl.icon,
          skills: tpl.skills,
          defaultConfig: tpl.defaultConfig,
          defaultDurationSec: tpl.defaultDurationSec,
          order: tpl.order,
          isSystem: true,
        },
        $setOnInsert: { isActive: true, difficultyLevels: ['easy', 'medium', 'hard'] },
      },
      { upsert: true }
    );
    if (res.upsertedCount) created += 1;
  }
  console.log(
    `[Cognitive] Exercise templates seeded (${SYSTEM_TEMPLATES.length} system templates, ${created} newly created)`
  );
}
