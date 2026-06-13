/**
 * Small, self-cleaning hooks used across the FeaturesExperience.
 * Every subscription is removed on unmount — no leaks.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/** matchMedia → boolean, kept in sync. */
export function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    // Safari < 14 uses addListener
    mql.addEventListener ? mql.addEventListener('change', onChange) : mql.addListener(onChange);
    return () =>
      mql.removeEventListener
        ? mql.removeEventListener('change', onChange)
        : mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** True once if a WebGL context can be created (checked a single time). */
export function useWebGLAvailable() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      setOk(!!gl);
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

/** Observe an element's content-box size. Returns { width, height }. */
export function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** rAF-throttled callback ref (e.g. pointer parallax) that auto-cancels. */
export function useRafCallback(cb) {
  const frame = useRef(0);
  const run = useCallback(
    (...args) => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        cb(...args);
      });
    },
    [cb]
  );
  useEffect(() => () => frame.current && cancelAnimationFrame(frame.current), []);
  return run;
}
