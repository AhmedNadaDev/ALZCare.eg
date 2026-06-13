/**
 * ProgressRail — slim vertical capability index on the right (desktop only).
 * Shows which capabilities have been revealed and lets you jump to any of them.
 */
import React from 'react';
import { motion } from 'motion/react';
import { STAGE, stageToFeatureIndex, featureCenterProgress } from './featuresData.js';

export default function ProgressRail({ features, activeStage, onJump, reduced }) {
  const curFI = stageToFeatureIndex(activeStage);
  const allOn = activeStage >= STAGE.CONNECT;

  return (
    <div className="absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-2.5 lg:flex">
      {features.map((f) => {
        const revealed = allOn || (curFI >= 0 && f.index <= curFI);
        const active = !allOn && curFI === f.index;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onJump?.(featureCenterProgress(f.index))}
            className="group flex items-center gap-2.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0118]"
            aria-label={`Go to ${f.kicker}`}
          >
            <span
              className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
              style={{ color: f.accent }}
            >
              {f.screenLabel}
            </span>
            <motion.span
              className="block rounded-full"
              animate={{
                width: active ? 26 : 8,
                height: 8,
                backgroundColor: revealed ? f.accent : 'rgba(255,255,255,0.22)',
                boxShadow: active && !reduced ? `0 0 12px ${f.accent}` : '0 0 0 transparent',
              }}
              transition={{ duration: reduced ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </button>
        );
      })}
    </div>
  );
}
