/**
 * FeaturesExperience — premium, scroll-driven "one watch, nine capabilities"
 * story for the ALZCare landing page.
 *
 * Desktop (immersive): the smartwatch is pinned centre-screen while capability
 * nodes orbit in, wire themselves to the watch and light up one by one, the
 * watch screen changes per capability, and benefit-driven copy stays in sync —
 * all scrubbed by Lenis + GSAP ScrollTrigger.
 *
 * Tablet / mobile / reduced-motion / no-WebGL: a lighter, equally premium
 * vertical reveal (no pinning, no layout shift) — see MobileExperience.
 */
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

import {
  FEATURES,
  STAGE,
  stageToFeatureIndex,
  featureCenterProgress,
  SECTION_COPY,
} from './featuresData.js';
import { getOrbit, nodePoint } from './layout.js';
import {
  useMediaQuery,
  usePrefersReducedMotion,
  useWebGLAvailable,
  useElementSize,
} from './hooks.js';
import { useScrollStory } from './useScrollStory.js';
import FeatureNode from './FeatureNode.jsx';
import Connectors from './Connectors.jsx';
import ProgressRail from './ProgressRail.jsx';
import StageCaption from './StageCaption.jsx';
import MobileExperience from './MobileExperience.jsx';

const WatchCanvas = lazy(() => import('./WatchCanvas.jsx'));

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/10 blur-[120px]" />
      <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-violet-600/10 blur-[100px]" />
      <div className="absolute -right-16 bottom-1/4 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-[100px]" />
    </div>
  );
}

function ImmersiveExperience() {
  const sectionRef = useRef(null);
  const pinRef = useRef(null);
  const progressRef = useRef(0);
  const [activeStage, setActiveStage] = useState(STAGE.INTRO);
  const [active, setActive] = useState(true);

  const { width, height } = useElementSize(pinRef);
  const orbit = getOrbit(width, height);

  const onStage = useCallback((s) => setActiveStage(s), []);
  const { scrollToProgress } = useScrollStory({
    enabled: true,
    sectionRef,
    pinRef,
    progressRef,
    onStage,
  });

  // Gate the WebGL render loop to when the section is on screen (saves battery).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), {
      rootMargin: '200px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const curFI = stageToFeatureIndex(activeStage);
  const allOn = activeStage >= STAGE.CONNECT;
  const revealed = (i) => allOn || (curFI >= 0 && i <= curFI);
  const isActive = (i) => !allOn && curFI === i;
  const jumpToFeature = (i) => scrollToProgress(featureCenterProgress(i));

  return (
    <section
      ref={sectionRef}
      aria-label="ALZCare smartwatch capabilities"
      className="relative bg-[#0a0118]"
    >
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden">
        <Backdrop />

        {/* top section label (also the section's heading for a11y/heading order) */}
        <div className="absolute inset-x-0 top-24 z-30 flex flex-col items-center px-4 text-center">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-300/80">
            {SECTION_COPY.eyebrow}
          </h2>
        </div>

        {/* 3D watch */}
        <Suspense fallback={null}>
          <WatchCanvas progressRef={progressRef} activeStage={activeStage} active={active} dprMax={2} />
        </Suspense>

        {/* neural wiring + orbiting nodes (wait for a real measured size to
            avoid a one-frame flash of nodes stacked at the top-left corner) */}
        {width > 0 && height > 0 && (
          <>
            <Connectors
              features={FEATURES}
              orbit={orbit}
              revealed={revealed}
              active={isActive}
              allOn={allOn}
              reduced={false}
            />
            {FEATURES.map((f) => (
              <FeatureNode
                key={f.id}
                feature={f}
                point={nodePoint(orbit.cx, orbit.cy, orbit.Rx, orbit.Ry, f.angle)}
                revealed={revealed(f.index)}
                active={isActive(f.index)}
                reduced={false}
                onJump={jumpToFeature}
              />
            ))}
          </>
        )}

        <ProgressRail
          features={FEATURES}
          activeStage={activeStage}
          onJump={scrollToProgress}
          reduced={false}
        />

        <StageCaption activeStage={activeStage} reduced={false} />

        {/* scroll hint during the intro only */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 top-36 z-30 flex justify-center"
          animate={{ opacity: activeStage === STAGE.INTRO ? 1 : 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-col items-center gap-2 text-white/45">
            <span className="text-xs font-medium tracking-widest">SCROLL TO REVEAL</span>
            <motion.svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <path d="m6 9 6 6 6-6" />
            </motion.svg>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function FeaturesExperience() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const reduced = usePrefersReducedMotion();
  const webgl = useWebGLAvailable();

  if (isDesktop && webgl && !reduced) return <ImmersiveExperience />;
  return <MobileExperience webgl={webgl} reduced={reduced} />;
}
