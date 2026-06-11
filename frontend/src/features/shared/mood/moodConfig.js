/**
 * moodConfig.js — single source of truth for the AI mood + arousal display config.
 *
 * Matches the WavLM model taxonomy (backend AIMood.model.js / label_mapping.json):
 *   moods   : Calm, Neutral, Content, Anxious, Agitated, Low
 *   arousal : low | high   (the more reliable, clinically meaningful signal)
 *
 * `alert: true` marks the concerning mood states the backend also flags as isAbnormal.
 */

export const MOOD_CONFIG = {
  Calm:     { emoji: '😌', label: 'Calm',     color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
  Neutral:  { emoji: '😐', label: 'Neutral',  color: 'text-gray-300',    bg: 'bg-gray-500/20',    border: 'border-gray-500/30'   },
  Content:  { emoji: '🙂', label: 'Content',  color: 'text-green-400',   bg: 'bg-green-500/20',   border: 'border-green-500/30'  },
  Anxious:  { emoji: '😰', label: 'Anxious',  color: 'text-amber-400',   bg: 'bg-amber-500/20',   border: 'border-amber-500/30', alert: true },
  Agitated: { emoji: '😣', label: 'Agitated', color: 'text-red-400',     bg: 'bg-red-500/20',     border: 'border-red-500/30',   alert: true },
  Low:      { emoji: '😔', label: 'Low',      color: 'text-blue-400',    bg: 'bg-blue-500/20',    border: 'border-blue-500/30',  alert: true },
};

export const MOOD_ORDER = ['Calm', 'Neutral', 'Content', 'Anxious', 'Agitated', 'Low'];

export const moodCfg = (mood) => MOOD_CONFIG[mood] || MOOD_CONFIG.Neutral;

export const AROUSAL_CONFIG = {
  low:  { label: 'Low arousal',  short: 'Low',  emoji: '🟢', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
  high: { label: 'High arousal', short: 'High', emoji: '🔴', color: 'text-rose-400',    bg: 'bg-rose-500/20',    border: 'border-rose-500/30' },
};

export const arousalCfg = (arousal) => AROUSAL_CONFIG[arousal] || AROUSAL_CONFIG.low;
