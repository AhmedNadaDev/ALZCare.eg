/**
 * useScrollStory — the immersive scroll engine.
 *
 * Lenis (smooth scroll) drives GSAP's ScrollTrigger, which pins the stage and
 * scrubs a single pinned timeline. Scroll progress is written to `progressRef`
 * (read by the 3D scene in useFrame — no React re-render), and only discrete
 * STAGE changes call `onStage` (cheap, ~12×/scroll).
 *
 * Everything is created in a gsap.context and torn down on unmount: the ticker
 * callback is removed, Lenis is destroyed, and ctx.revert() kills the
 * ScrollTrigger and unwraps the pin-spacer. No leaks, no orphaned triggers.
 */
import { useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { progressToStage } from './featuresData.js';

gsap.registerPlugin(ScrollTrigger);

// Total pinned scroll length, in viewport heights ("several screens tall").
const SCROLL_VH = 8;

export function useScrollStory({ enabled, sectionRef, pinRef, progressRef, onStage }) {
  const lenisRef = useRef(null);
  const stRef = useRef(null);
  const lastStage = useRef(-1);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return undefined;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false, // native scrolling on touch (Lenis is desktop-only here)
    });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      stRef.current = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => '+=' + window.innerHeight * SCROLL_VH,
        pin,
        pinSpacing: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const stage = progressToStage(self.progress);
          if (stage !== lastStage.current) {
            lastStage.current = stage;
            onStage(stage);
          }
        },
        onRefresh: (self) => {
          progressRef.current = self.progress;
        },
      });
    }, section);

    // Recalculate once layout/fonts have settled, then again next frame.
    const refresh = () => ScrollTrigger.refresh();
    const raf = requestAnimationFrame(refresh);
    const t = setTimeout(refresh, 350);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      gsap.ticker.remove(tick);
      // lagSmoothing is GLOBAL (not scoped to ctx) and shared with other GSAP
      // users (e.g. the Navbar menu) — restore GSAP's defaults on teardown.
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenisRef.current = null;
      ctx.revert(); // kills the ScrollTrigger + restores the pinned DOM
      stRef.current = null;
      lastStage.current = -1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /** Smoothly jump to a normalized progress (0..1) within the pinned range. */
  const scrollToProgress = useCallback((p) => {
    const st = stRef.current;
    if (!st) return;
    const y = st.start + (st.end - st.start) * Math.max(0, Math.min(1, p));
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  return { scrollToProgress };
}
