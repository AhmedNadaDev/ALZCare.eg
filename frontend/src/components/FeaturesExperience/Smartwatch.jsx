/**
 * Smartwatch.jsx — procedural, fully 3D smartwatch (no DOM, no fake divs).
 *
 * Real Three.js geometry: rounded titanium case, glossy glass, digital crown,
 * side button and two softly-curved silicone straps. The display is a live
 * CanvasTexture (see watchFace.js) used as the emissive map, so the screen
 * actually changes per feature and animates.
 *
 * Scroll choreography is read from `progressRef` inside useFrame, so scrolling
 * never triggers a React re-render — only stage CHANGES (a prop) do.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Float } from '@react-three/drei';
import * as THREE from 'three';

import { BANDS } from './featuresData.js';
import { watchTransform, easeOut } from './motion.js';
import { useWatchScreen } from './useWatchScreen.js';
import WatchAura from './WatchAura.jsx';

const damp = THREE.MathUtils.damp;

export default function Smartwatch({ progressRef, activeStage, reduced = false, compact = false }) {
  const group = useRef();
  const screenMat = useRef();

  const { texture, redraw, targetColor } = useWatchScreen(activeStage, reduced);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    const d = Math.min(delta, 0.05); // guard against tab-restore spikes

    if (compact) {
      // mobile/compact hero: gentle idle presentation, no scroll coupling
      g.rotation.y = damp(g.rotation.y, Math.sin(t * 0.4) * 0.35, 3, d);
      g.rotation.x = damp(g.rotation.x, -0.05 + Math.sin(t * 0.5) * 0.04, 3, d);
      g.scale.setScalar(damp(g.scale.x, 1, 4, d));
    } else {
      const p = progressRef ? progressRef.current : 0;
      const { scale, rotY, rotX, posY } = watchTransform(p, state.pointer, reduced);
      g.scale.setScalar(damp(g.scale.x, scale, 5, d));
      g.rotation.y = damp(g.rotation.y, rotY, 4, d);
      g.rotation.x = damp(g.rotation.x, rotX, 4, d);
      g.position.y = damp(g.position.y, posY, 5, d);
    }

    // animated screen (no-op for reduced motion)
    redraw(t);

    if (screenMat.current) {
      const power = compact
        ? 1.25
        : 0.2 + 1.15 * easeOut(Math.min((progressRef?.current ?? 1) / BANDS.introEnd, 1));
      screenMat.current.emissiveIntensity = damp(screenMat.current.emissiveIntensity, power, 5, d);
    }
  });

  const Wrapper = reduced || compact ? React.Fragment : Float;
  const wrapperProps = reduced || compact ? {} : { speed: 1.1, rotationIntensity: 0.18, floatIntensity: 0.5 };

  return (
    <group ref={group} dispose={null}>
      <WatchAura targetColor={targetColor} reduced={reduced} />

      <Wrapper {...wrapperProps}>
        {/* case */}
        <RoundedBox args={[2.05, 2.5, 0.52]} radius={0.34} smoothness={5} castShadow>
          <meshStandardMaterial color="#2b2b34" metalness={1} roughness={0.32} envMapIntensity={1.4} />
        </RoundedBox>

        {/* screen — live CanvasTexture */}
        <mesh position={[0, 0, 0.262]}>
          <planeGeometry args={[1.62, 2.04]} />
          <meshStandardMaterial
            ref={screenMat}
            map={texture}
            emissive="#ffffff"
            emissiveMap={texture}
            emissiveIntensity={1.2}
            transparent
            alphaTest={0.02}
            roughness={0.35}
            metalness={0}
            toneMapped={false}
          />
        </mesh>

        {/* glossy glass cover */}
        <mesh position={[0, 0, 0.28]}>
          <planeGeometry args={[1.82, 2.24]} />
          <meshPhysicalMaterial
            transparent
            opacity={0.12}
            roughness={0.06}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.04}
            envMapIntensity={2}
            color="#ffffff"
          />
        </mesh>

        {/* digital crown + side button */}
        <mesh position={[1.06, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 28]} />
          <meshStandardMaterial color="#3a3a44" metalness={1} roughness={0.25} envMapIntensity={1.5} />
        </mesh>
        <RoundedBox position={[1.05, -0.45, 0]} args={[0.16, 0.5, 0.18]} radius={0.07} smoothness={3}>
          <meshStandardMaterial color="#34343d" metalness={1} roughness={0.3} />
        </RoundedBox>

        {/* straps (softly curved away from the camera) */}
        <group position={[0, 1.5, -0.18]} rotation={[-0.55, 0, 0]}>
          <RoundedBox args={[1.55, 1.5, 0.26]} radius={0.13} smoothness={3}>
            <meshStandardMaterial color="#1b1b22" metalness={0.1} roughness={0.85} />
          </RoundedBox>
        </group>
        <group position={[0, -1.5, -0.18]} rotation={[0.55, 0, 0]}>
          <RoundedBox args={[1.55, 1.5, 0.26]} radius={0.13} smoothness={3}>
            <meshStandardMaterial color="#1b1b22" metalness={0.1} roughness={0.85} />
          </RoundedBox>
        </group>
      </Wrapper>
    </group>
  );
}
