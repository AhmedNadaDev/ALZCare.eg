import React, { useEffect } from 'react';

/**
 * Shared cognitive (Memory Assistant) UI constants and primitives.
 * Imported by both the family management UI and the patient experience so
 * exercise/emotion/category presentation stays consistent everywhere.
 */

export const EXERCISE_META = {
  face_recognition: { label: 'Face Recognition', emoji: '🧑‍🤝‍🧑', gradient: 'from-pink-500 to-rose-500' },
  memory_recall: { label: 'Memory Recall', emoji: '✨', gradient: 'from-purple-500 to-violet-500' },
  sequence_memory: { label: 'Sequence Memory', emoji: '🔢', gradient: 'from-blue-500 to-cyan-500' },
  daily_routine: { label: 'Daily Routine', emoji: '📋', gradient: 'from-amber-500 to-orange-500' },
  voice_recognition: { label: 'Voice Recognition', emoji: '🎤', gradient: 'from-emerald-500 to-green-500' },
};

export const EMOTION_META = {
  joy: { label: 'Joy', emoji: '😊' },
  love: { label: 'Love', emoji: '❤️' },
  nostalgia: { label: 'Nostalgia', emoji: '🌅' },
  pride: { label: 'Pride', emoji: '🏆' },
  calm: { label: 'Calm', emoji: '🌿' },
  neutral: { label: 'Neutral', emoji: '🙂' },
};

export const CATEGORY_META = {
  family: { label: 'Family', emoji: '👨‍👩‍👧' },
  friends: { label: 'Friends', emoji: '🤝' },
  places: { label: 'Places', emoji: '🏞️' },
  events: { label: 'Events', emoji: '🎉' },
  pets: { label: 'Pets', emoji: '🐾' },
  achievements: { label: 'Achievements', emoji: '🏅' },
  other: { label: 'Other', emoji: '📦' },
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const RECURRENCES = ['once', 'daily', 'weekly', 'custom'];
export const WEEKDAYS = [
  { key: 'sunday', short: 'Sun' },
  { key: 'monday', short: 'Mon' },
  { key: 'tuesday', short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday', short: 'Thu' },
  { key: 'friday', short: 'Fri' },
  { key: 'saturday', short: 'Sat' },
];

export const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/** Resolve a stored relative media URL (/uploads/...) to an absolute URL. */
export const mediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_ORIGIN}${url}`;
};

export const statusColor = (status) =>
  ({
    completed: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    active: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
    scheduled: 'text-purple-300 bg-purple-500/15 border-purple-500/30',
    abandoned: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    missed: 'text-red-400 bg-red-500/15 border-red-500/30',
  }[status] || 'text-gray-400 bg-white/5 border-white/10');

// ── Primitives ──────────────────────────────────────────────────────────────

export const Spinner = ({ className = 'w-8 h-8' }) => (
  <div className={`${className} border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin`} />
);

export const EmptyState = ({ icon = '🗂️', title, hint }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6">
    <div className="text-5xl mb-3">{icon}</div>
    <p className="text-gray-200 font-medium">{title}</p>
    {hint && <p className="text-gray-500 text-sm mt-1 max-w-sm">{hint}</p>}
  </div>
);

/** Accessible modal with backdrop, Esc-to-close, and focus trap. */
export const Modal = ({ open, onClose, title, children, maxWidth = 'max-w-2xl' }) => {
  const dialogRef = React.useRef(null);

  useEffect(() => {
    if (!open) return;

    // Esc to close
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);

    // Focus trap
    const focusable = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const trap = (e) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const els = [...dialogRef.current.querySelectorAll(focusable)].filter((el) => !el.disabled);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', trap);

    // Auto-focus first focusable element
    const timer = setTimeout(() => {
      const el = dialogRef.current?.querySelector(focusable);
      el?.focus();
    }, 10);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', trap);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto bg-[#150a2b] border border-white/10 rounded-2xl shadow-2xl`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#150a2b]/95 backdrop-blur">
          <h3 id="modal-title" className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none px-2" aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export const Field = ({ label, children, hint }) => (
  <label className="block mb-4">
    <span className="block text-sm font-medium text-gray-300 mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
  </label>
);

export const inputCls =
  'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium hover:from-purple-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition';

export const btnGhost =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition';
