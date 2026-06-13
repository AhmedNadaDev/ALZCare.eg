/**
 * useWatchScreen — owns the animated CanvasTexture used as the watch display.
 * Shared by the procedural watch and the optional GLB model so both behave
 * identically and dispose cleanly. No re-render on animation; only on stage
 * change (cheap).
 */
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

import { drawWatchFace } from './watchFace.js';
import { FEATURES, STAGE, stageToFeatureIndex } from './featuresData.js';

export function stageToScreenState(stage) {
  if (stage === STAGE.CONNECT) return { mode: 'connect', feature: null, accent: '#a855f7' };
  if (stage === STAGE.FINAL) return { mode: 'final', feature: null, accent: '#a855f7' };
  const fi = stageToFeatureIndex(stage);
  if (fi >= 0) return { mode: 'feature', feature: FEATURES[fi], accent: FEATURES[fi].accent };
  return { mode: 'intro', feature: null, accent: '#a855f7' };
}

export function useWatchScreen(activeStage, reduced) {
  const { canvas, ctx, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 420;
    c.height = 520;
    const x = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { canvas: c, ctx: x, texture: tex };
  }, []);

  const screenRef = useRef(stageToScreenState(activeStage));
  const targetColor = useRef(new THREE.Color(screenRef.current.accent));
  const lastPaint = useRef(-1);

  const paint = (t) => {
    drawWatchFace(ctx, { w: canvas.width, h: canvas.height, t, ...screenRef.current });
    texture.needsUpdate = true;
  };

  // prime once
  useEffect(() => {
    paint(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update on stage change
  useEffect(() => {
    screenRef.current = stageToScreenState(activeStage);
    targetColor.current.set(screenRef.current.accent);
    if (reduced) paint(0); // static frame for reduced motion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStage, reduced]);

  // dispose GPU texture on unmount
  useEffect(() => () => texture.dispose(), [texture]);

  // called every frame by the owner. Throttled to ~30fps — a tiny on-wrist UI
  // doesn't need 60fps, and this halves the Canvas2D paint + GPU texture upload.
  const redraw = (t) => {
    if (reduced) return;
    if (t - lastPaint.current < 1 / 30) return;
    lastPaint.current = t;
    paint(t);
  };

  return { texture, redraw, targetColor };
}
