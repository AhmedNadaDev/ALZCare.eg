/**
 * WatchCanvas.jsx — the R3F stage that hosts the smartwatch.
 *
 * - Transparent canvas (the section's CSS gradient shows through).
 * - Studio reflections via drei <Environment> + <Lightformer> (baked once, no
 *   external HDR download).
 * - Adaptive DPR + events so it stays smooth on weaker GPUs.
 * - `active` gates the render loop so it costs nothing while off-screen.
 * - Procedural watch by default; flip USE_GLB to use a real /models/*.glb.
 */
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Environment,
  Lightformer,
  Sparkles,
  AdaptiveDpr,
  AdaptiveEvents,
  Preload,
} from '@react-three/drei';

import Smartwatch from './Smartwatch.jsx';

// ── Drop a real model at frontend/public/models/smartwatch.glb and flip this. ──
const USE_GLB = false;

// Lazy so the GLTF loader code only ships when actually enabled.
const WatchModelGLTF = USE_GLB ? React.lazy(() => import('./WatchModelGLTF.jsx')) : null;

/** Falls back to the procedural watch if the GLB is missing or errors. */
class GLBErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    // eslint-disable-next-line no-console
    console.warn('[ALZCare] GLB watch failed to load — using procedural watch.', err?.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StudioLighting() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#a78bfa" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 2]} scale={[8, 3, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={2} position={[-5, 1, 1]} scale={[3, 6, 1]} color="#c4b5fd" />
        <Lightformer form="rect" intensity={2} position={[5, -1, 1]} scale={[3, 6, 1]} color="#818cf8" />
        <Lightformer form="circle" intensity={1.5} position={[0, -3, 2]} scale={5} color="#7c3aed" />
      </Environment>
    </>
  );
}

export default function WatchCanvas({
  progressRef,
  activeStage,
  reduced = false,
  compact = false,
  active = true,
  dprMax = 2,
}) {
  const watchProps = { progressRef, activeStage, reduced, compact };

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, dprMax]}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, compact ? 6.6 : 6.2], fov: 32 }}
    >
      <StudioLighting />

      <Suspense fallback={null}>
        {USE_GLB && WatchModelGLTF ? (
          <GLBErrorBoundary fallback={<Smartwatch {...watchProps} />}>
            <WatchModelGLTF {...watchProps} />
          </GLBErrorBoundary>
        ) : (
          <Smartwatch {...watchProps} />
        )}

        {!reduced && (
          <Sparkles count={compact ? 22 : 46} scale={[9, 9, 5]} size={2.4} speed={0.25} opacity={0.5} color="#c4b5fd" />
        )}
        <Preload all />
      </Suspense>

      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  );
}
