/**
 * MobileExperience — the "lite" path for tablet, mobile, reduced-motion and
 * no-WebGL. Same story and copy, no pinning or scroll-scrubbing (which are
 * fragile on touch / mobile address-bar resize). Premium glass cards reveal as
 * they enter view; the watch appears once as a hero (compact 3D when capable,
 * a styled fallback otherwise).
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

import { FEATURES, STAGE, SECTION_COPY } from './featuresData.js';
import { useMediaQuery } from './hooks.js';

const WatchCanvas = lazy(() => import('./WatchCanvas.jsx'));

/** Compact hero watch that gently cycles through the capabilities. */
function CompactWatch() {
  const ref = useRef(null);
  const dummyProgress = useRef(1); // intro already "complete" in compact mode
  const [stage, setStage] = useState(STAGE.FIRST_FEATURE);
  const [inView, setInView] = useState(true);

  // Pause the WebGL loop + cycler when the hero is scrolled off-screen (battery).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      rootMargin: '100px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return undefined;
    const id = setInterval(() => {
      setStage((s) => (s + 1 > FEATURES.length ? STAGE.FIRST_FEATURE : s + 1));
    }, 2600);
    return () => clearInterval(id);
  }, [inView]);

  return (
    <div ref={ref} className="absolute inset-0">
      <Suspense fallback={<WatchFallback />}>
        <WatchCanvas
          progressRef={dummyProgress}
          activeStage={stage}
          compact
          active={inView}
          dprMax={1.75}
        />
      </Suspense>
    </div>
  );
}

/** Pure-CSS watch used when WebGL is unavailable or motion is reduced. */
function WatchFallback() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="relative h-44 w-36 rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#1a1030] to-[#0a0118] shadow-[0_0_60px_-12px_rgba(168,85,247,0.6)]">
        <div className="absolute inset-3 grid place-items-center rounded-[1.4rem] bg-gradient-to-br from-[#160c2b] to-[#06030f]">
          <div className="text-center">
            <div className="mx-auto mb-2 h-10 w-10 rounded-full border-2 border-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
            <span className="text-sm font-bold text-white">ALZCare</span>
          </div>
        </div>
        <div className="absolute -right-1.5 top-12 h-7 w-1.5 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

function FeatureCard({ feature, reduced, index }) {
  const { Icon, accent, kicker, title, description, points } = feature;
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 32 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: (index % 2) * 0.05 }}
      className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-sm transition-colors duration-500 hover:border-white/20 sm:p-8"
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: accent }}
      />
      <div className="relative">
        <div
          className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border"
          style={{ color: accent, borderColor: `${accent}55`, background: `${accent}14` }}
        >
          <Icon className="h-7 w-7" />
        </div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
          {kicker}
        </p>
        <h3 className="text-xl font-bold leading-snug text-white sm:text-2xl">
          {title.replace(/\n/g, ' ')}
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-400">{description}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {points.map((pt) => (
            <li
              key={pt}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-300"
            >
              {pt}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export default function MobileExperience({ webgl, reduced }) {
  const canShow3D = useMediaQuery('(min-width: 640px)');
  const show3D = webgl && !reduced && canShow3D;

  return (
    <section className="relative overflow-hidden bg-[#0a0118] py-20 sm:py-24">
      <div className="pointer-events-none absolute left-1/2 top-40 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-600/15 blur-[110px]" />

      <div className="relative mx-auto max-w-3xl px-4 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300/80">
          {SECTION_COPY.eyebrow}
        </span>
        <h2 className="mt-4 whitespace-pre-line text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
          {SECTION_COPY.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-400 sm:text-lg">
          {SECTION_COPY.introSub}
        </p>

        <div className="relative mx-auto mt-8 h-[300px] w-full sm:h-[360px]">
          {show3D ? <CompactWatch /> : <WatchFallback />}
        </div>
      </div>

      <div className="relative mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-5 px-4 md:grid-cols-2">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.id} feature={f} reduced={reduced} index={i} />
        ))}
      </div>

      <div className="relative mx-auto mt-16 max-w-3xl px-4 text-center">
        <h3 className="mx-auto whitespace-pre-line text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          {SECTION_COPY.finalTitle}
        </h3>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-400 sm:text-lg">{SECTION_COPY.finalSub}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-purple-500/30 transition-all duration-300 hover:-translate-y-0.5"
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
      </div>
    </section>
  );
}
