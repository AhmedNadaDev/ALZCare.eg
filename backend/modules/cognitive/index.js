/**
 * Cognitive (Memory Assistant) module — public entry point.
 * Single import surface for server.js wiring.
 */
export { default as cognitiveRouter } from './routes/index.js';
export { startCognitiveScheduler } from './cognitive.scheduler.js';
export { seedExerciseTemplates } from './cognitive.seed.js';
