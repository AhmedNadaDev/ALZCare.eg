/**
 * FeatureNode — a single capability orbiting the watch.
 * Reveals (and stays lit) once its stage is reached; glows when it's the active
 * one. Click to jump to that moment in the scroll story.
 *
 * Centering lives on a static wrapper (transform: translate(-50%,-50%)) so it is
 * never clobbered by Framer Motion's animated `transform` on the inner button.
 */
import React from 'react';
import { motion } from 'motion/react';

export default function FeatureNode({ feature, point, revealed, active, reduced, onJump }) {
  const { Icon, accent, kicker, screenLabel } = feature;

  return (
    <div
      className="absolute z-20"
      style={{ left: point.x, top: point.y, transform: 'translate(-50%, -50%)' }}
    >
      <motion.button
        type="button"
        onClick={() => onJump?.(feature.index)}
        aria-label={`${kicker} — jump to this feature`}
        className="group flex select-none flex-col items-center gap-2 focus:outline-none"
        style={{ pointerEvents: revealed ? 'auto' : 'none' }}
        initial={false}
        animate={{ opacity: revealed ? 1 : 0, scale: revealed ? (active ? 1.12 : 1) : 0.6 }}
        transition={{ duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
        whileHover={reduced ? undefined : { scale: active ? 1.18 : 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.96 }}
      >
        {/* icon chip */}
        <span
          className="relative grid h-12 w-12 place-items-center rounded-2xl border backdrop-blur-md transition-colors duration-500 group-focus-visible:ring-2 group-focus-visible:ring-white/80 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#0a0118] sm:h-14 sm:w-14"
          style={{
            color: accent,
            borderColor: active ? accent : 'rgba(255,255,255,0.14)',
            background: active ? `${accent}1f` : 'rgba(255,255,255,0.04)',
            boxShadow:
              active && !reduced ? `0 0 28px -4px ${accent}, inset 0 0 16px -8px ${accent}` : 'none',
          }}
        >
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          {/* pulsing ring on the active node */}
          {active && !reduced && (
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-2xl border"
              style={{ borderColor: accent }}
              initial={{ opacity: 0.6, scale: 1 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
        </span>

        {/* label */}
        <span
          className="max-w-[7.5rem] text-center text-[11px] font-semibold leading-tight tracking-wide transition-colors duration-500 sm:text-xs"
          style={{ color: active ? '#fff' : 'rgba(226,220,255,0.62)' }}
        >
          {screenLabel}
        </span>
      </motion.button>
    </div>
  );
}
