/**
 * WatchModelGLTF.jsx — OPTIONAL real GLB/GLTF smartwatch.
 *
 * Off by default (see WatchCanvas: USE_GLB). To use a real model:
 *   1. Drop a model at  frontend/public/models/smartwatch.glb
 *   2. In WatchCanvas.jsx set  USE_GLB = true
 *
 * Recommended sources (free / CC0): Poly Pizza, Sketchfab "Downloadable + CC0",
 * or the Khronos glTF sample models. Keep it < ~3 MB and Draco-compress if large.
 *
 * It reuses the exact same scroll motion (motion.js), the shared aura, and — if
 * it can find a screen-like mesh in the model — the same live screen texture, so
 * a real model behaves like the procedural one. If the file is missing or fails
 * to load, WatchCanvas's error boundary falls back to the procedural watch.
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

import { watchTransform } from './motion.js';
import { useWatchScreen } from './useWatchScreen.js';
import WatchAura from './WatchAura.jsx';

const damp = THREE.MathUtils.damp;
const SCREEN_RE = /screen|display|glass|face|dial|lcd|oled/i;

export default function WatchModelGLTF({
  url = '/models/smartwatch.glb',
  progressRef,
  activeStage,
  reduced = false,
  compact = false,
  modelScale = 1,
}) {
  const group = useRef();
  const { scene } = useGLTF(url);
  const { texture, redraw, targetColor } = useWatchScreen(activeStage, reduced);

  // clone so the cached GLTF isn't mutated across mounts
  const model = useMemo(() => scene.clone(true), [scene]);

  // attach the live screen texture to a detected display mesh (best effort)
  useEffect(() => {
    const created = [];
    let applied = false;
    model.traverse((o) => {
      if (!applied && o.isMesh && SCREEN_RE.test(o.name || '')) {
        const mat = new THREE.MeshStandardMaterial({
          map: texture,
          emissive: new THREE.Color('#ffffff'),
          emissiveMap: texture,
          emissiveIntensity: 1.2,
          toneMapped: false,
          roughness: 0.35,
          metalness: 0,
        });
        o.material = mat;
        created.push(mat);
        applied = true;
      }
    });
    // Dispose ONLY the materials we created. Geometries (and the original
    // materials) are shared by reference via scene.clone(true) with drei's
    // cached GLTF — disposing them would corrupt the cache / break the fallback.
    return () => created.forEach((m) => m.dispose());
  }, [model, texture]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    const d = Math.min(delta, 0.05);
    if (compact) {
      g.rotation.y = damp(g.rotation.y, Math.sin(t * 0.4) * 0.35, 3, d);
      g.scale.setScalar(damp(g.scale.x, modelScale, 4, d));
    } else {
      const p = progressRef ? progressRef.current : 0;
      const { scale, rotY, rotX, posY } = watchTransform(p, state.pointer, reduced);
      g.scale.setScalar(damp(g.scale.x, scale * modelScale, 5, d));
      g.rotation.y = damp(g.rotation.y, rotY, 4, d);
      g.rotation.x = damp(g.rotation.x, rotX, 4, d);
      g.position.y = damp(g.position.y, posY, 5, d);
    }
    redraw(t);
  });

  return (
    <group ref={group} dispose={null}>
      <WatchAura targetColor={targetColor} reduced={reduced} />
      <primitive object={model} />
    </group>
  );
}
