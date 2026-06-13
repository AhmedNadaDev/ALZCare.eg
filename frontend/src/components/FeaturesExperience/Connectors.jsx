/**
 * Connectors — glowing lines from the watch (hub) out to each capability node.
 * Each line "draws" itself (pathLength) when its feature is revealed and
 * brightens while active; in the connect/final stages every line is lit at once.
 */
import React from 'react';
import { motion } from 'motion/react';
import { nodePoint } from './layout.js';

export default function Connectors({ features, orbit, revealed, active, allOn, reduced }) {
  const { cx, cy, Rx, Ry } = orbit;
  if (!Rx) return null;

  return (
    <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true">
      {/* soft hub glow at the watch centre */}
      <circle cx={cx} cy={cy} r={6} fill="#c4b5fd" opacity={0.5} />

      {features.map((f) => {
        const p = nodePoint(cx, cy, Rx, Ry, f.angle);
        const on = revealed(f.index);
        const hot = allOn || active(f.index);
        const d = `M ${cx} ${cy} L ${p.x} ${p.y}`;
        return (
          <motion.path
            key={f.id}
            d={d}
            fill="none"
            stroke={f.accent}
            strokeWidth={hot ? 2.4 : 1.3}
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: on ? 1 : 0, opacity: on ? (hot ? 0.9 : 0.32) : 0 }}
            transition={{ duration: reduced ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: hot && !reduced ? `drop-shadow(0 0 6px ${f.accent})` : 'none' }}
          />
        );
      })}
    </svg>
  );
}
