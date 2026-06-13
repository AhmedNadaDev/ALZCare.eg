/**
 * WatchAura — the coloured halo + accent point light that tint the watch with
 * the active feature's hue. Shared by the procedural watch and the GLB model so
 * they glow identically. Animates entirely inside useFrame (no re-renders).
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const damp = THREE.MathUtils.damp;

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function WatchAura({ targetColor, reduced = false }) {
  const glow = useRef();
  const glowMat = useRef();
  const light = useRef();

  const glowTex = useMemo(() => makeGlowTexture(), []);
  useEffect(() => () => glowTex.dispose(), [glowTex]);

  useFrame((state, delta) => {
    const d = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const target = targetColor?.current;
    if (light.current && target) {
      light.current.color.lerp(target, 1 - Math.pow(0.0001, d));
      const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2);
      light.current.intensity = damp(light.current.intensity, 6 * pulse, 4, d);
    }
    if (glowMat.current && glow.current && target) {
      glowMat.current.color.lerp(target, 1 - Math.pow(0.0001, d));
      const pulse = reduced ? 1 : 0.9 + 0.1 * Math.sin(t * 1.8);
      glowMat.current.opacity = damp(glowMat.current.opacity, 0.5 * pulse, 4, d);
      glow.current.scale.setScalar(damp(glow.current.scale.x, 5.2 * pulse, 4, d));
    }
  });

  return (
    <group>
      <mesh ref={glow} position={[0, 0, -0.9]} scale={5}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={glowMat}
          map={glowTex}
          transparent
          opacity={0.45}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#a855f7"
        />
      </mesh>
      <pointLight ref={light} position={[0, 0.2, 1.6]} intensity={6} distance={9} color="#a855f7" />
    </group>
  );
}
