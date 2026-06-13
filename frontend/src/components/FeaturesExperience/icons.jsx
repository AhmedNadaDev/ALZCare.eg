/**
 * FeaturesExperience — capability icons
 * Lightweight stroke SVGs (currentColor) so they inherit each node's accent.
 * Kept dependency-free (no FontAwesome) to keep the lazy chunk small.
 */
import React from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const MoodIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 12h3l2 5 4-14 2.5 9H21" />
    <circle cx="12" cy="12" r="9" opacity="0.25" />
  </svg>
);

export const FaceIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="9.5" cy="11" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="11" r="0.8" fill="currentColor" stroke="none" />
    <path d="M9.5 14.5c.9.8 1.7 1.1 2.5 1.1s1.6-.3 2.5-1.1" />
  </svg>
);

export const LocationIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const MedicationIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <path d="M12 8v8" />
    <path d="M7.5 12h0.01" />
  </svg>
);

export const MemoryIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="m3 14 4-4 3 3 4-5 7 7" />
    <circle cx="8.5" cy="8.5" r="1.2" />
  </svg>
);

export const VoiceIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="2.5" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);

export const EmergencyIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6l-9-4Z" />
    <path d="M12 8v4" />
    <path d="M12 16h0.01" />
  </svg>
);

export const ScheduleIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    <path d="M12 13v3l2 1" opacity="0.9" />
  </svg>
);

export const ChatbotIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.2A8 8 0 1 1 21 12Z" />
    <path d="M8.5 11h7M8.5 14h4" />
  </svg>
);

export const SparkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="m6.3 6.3 2.5 2.5M15.2 15.2l2.5 2.5M17.7 6.3l-2.5 2.5M8.8 15.2l-2.5 2.5" opacity="0.5" />
    <circle cx="12" cy="12" r="2.4" />
  </svg>
);
