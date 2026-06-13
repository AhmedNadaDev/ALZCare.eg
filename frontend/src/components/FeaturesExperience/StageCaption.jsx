/**
 * StageCaption — the synchronized, benefit-driven copy that swaps with the
 * scroll story. Sits in a bottom scrim so it never fights the orbiting nodes.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { FEATURES, STAGE, stageToFeatureIndex, SECTION_COPY } from './featuresData.js';

function captionFor(activeStage) {
  const fi = stageToFeatureIndex(activeStage);
  if (fi >= 0) {
    const f = FEATURES[fi];
    return {
      key: `f-${f.id}`,
      eyebrow: f.kicker,
      title: f.title,
      sub: f.description,
      accent: f.accent,
      cta: false,
      counter: `${fi + 1} / ${FEATURES.length}`,
    };
  }
  if (activeStage === STAGE.CONNECT)
    return {
      key: 'connect',
      eyebrow: 'Everything connects',
      title: SECTION_COPY.connectTitle,
      sub: SECTION_COPY.connectSub,
      accent: '#c4b5fd',
      cta: false,
    };
  if (activeStage === STAGE.FINAL)
    return {
      key: 'final',
      eyebrow: 'ALZCare',
      title: SECTION_COPY.finalTitle,
      sub: SECTION_COPY.finalSub,
      accent: '#c4b5fd',
      cta: true,
    };
  return {
    key: 'intro',
    eyebrow: SECTION_COPY.eyebrow,
    title: SECTION_COPY.introTitle,
    sub: SECTION_COPY.introSub,
    accent: '#c4b5fd',
    cta: false,
  };
}

export default function StageCaption({ activeStage, reduced }) {
  const c = captionFor(activeStage);
  const dur = reduced ? 0 : 0.5;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* scrim for legibility */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#0a0118] via-[#0a0118]/80 to-transparent" />

      {/* No mode="wait": the caption is scrubbed by ScrollTrigger and must stay
          in lockstep with the watch/nodes. Captions are anchored to the stable
          full-stage box and crossfade, so they never lag or shift layout. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={c.key}
          className="absolute inset-x-0 bottom-10 mx-auto max-w-3xl px-5 text-center sm:bottom-14"
          initial={{ opacity: 0, y: reduced ? 0 : 24, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: reduced ? 0 : -16, filter: 'blur(6px)' }}
          transition={{ duration: dur, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className="h-px w-6" style={{ background: c.accent }} />
              <span
                className="text-xs font-semibold uppercase tracking-[0.22em]"
                style={{ color: c.accent }}
              >
                {c.eyebrow}
              </span>
              {c.counter && (
                <span className="text-xs font-medium tracking-widest text-white/35">· {c.counter}</span>
              )}
            </div>

            <h3 className="mx-auto whitespace-pre-line text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
              {c.title}
            </h3>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-300/90 sm:text-lg">
              {c.sub}
            </p>

            {c.cta && (
              <div className="pointer-events-auto mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/dashboard"
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-purple-500/50"
                >
                  Explore the Platform
                </Link>
                <Link
                  to="/features"
                  className="rounded-xl border border-white/15 px-7 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-white/[0.06]"
                >
                  See All Features
                </Link>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
    </div>
  );
}
