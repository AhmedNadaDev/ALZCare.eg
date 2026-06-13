# FeaturesExperience

The premium, scroll-driven **"one smartwatch, nine capabilities"** section of the
ALZCare landing page. Replaces the old static feature-card grid.

## What it does

- The smartwatch is the visual hero. On desktop it stays **pinned centre-screen**
  while you scroll; capability **nodes orbit in**, **wire themselves to the watch**
  with animated lines, and **light up one by one**. The **watch screen changes**
  per capability (a live, animated display), and **benefit-driven copy** stays in
  sync — all scrubbed by **Lenis + GSAP ScrollTrigger**.
- Story beats: intro (watch powers on) → 9 capabilities, each activating in turn →
  "everything connects" (all nodes + lines lit) → final message.

## Component map

```
FeaturesExperience.jsx   Orchestrator. Picks immersive vs lite; render-gates WebGL.
  useScrollStory.js      Lenis smooth-scroll → GSAP ScrollTrigger pin/scrub. Full cleanup.
  WatchCanvas.jsx        R3F <Canvas>: lights, baked Environment reflections, sparkles,
                         adaptive DPR/events. Procedural watch by default; optional GLB.
    Smartwatch.jsx       Procedural 3D watch (real geometry — case/glass/crown/band).
    WatchModelGLTF.jsx   OPTIONAL drop-in real GLB model (off by default).
    WatchAura.jsx        Shared accent halo + point light (tints the watch per feature).
    useWatchScreen.js    Live CanvasTexture for the display (drawn by watchFace.js).
    watchFace.js         2D canvas renderer: a distinct animated UI per capability.
  Connectors.jsx         SVG "neural" lines from the hub to each node (Framer Motion).
  FeatureNode.jsx        A single orbiting capability (Framer Motion).
  ProgressRail.jsx       Right-side capability index (desktop), click-to-jump.
  StageCaption.jsx       Synchronized, benefit-driven headline/subhead + final CTA.
  MobileExperience.jsx   Lite path: vertical reveal + compact/fallback watch.
  featuresData.js        Single source of truth: copy, accents, orbit angles, stage map.
  layout.js, motion.js, hooks.js, icons.js
```

## Dependencies

Already in `package.json` (versions pinned for **React 18** compatibility):

- `@react-three/fiber@^8.18`, `@react-three/drei@^9.122`, `three@^0.182` — 3D.
- `gsap@^3.14` (ScrollTrigger) + `lenis@^1.1` — scroll story.
- `motion@^12` (Framer Motion, imported from `motion/react`) — DOM animation.

> R3F v9 / drei v10 require React 19; this project is on React 18 (react-leaflet
> needs it), so the 3D stack is intentionally pinned to the v8/v9 line.

## Using a real GLB model (optional)

The default watch is **procedural** (genuine Three.js geometry, works out of the
box). To use a real model instead:

1. Drop a model at `frontend/public/models/smartwatch.glb`
   (free/CC0 sources: Poly Pizza, Sketchfab "CC0", Khronos glTF samples; keep it
   small / Draco-compressed).
2. In `WatchCanvas.jsx` set `const USE_GLB = true`.

It reuses the same scroll motion and aura, and will map the live screen texture
onto a mesh whose name matches `/screen|display|glass|face|dial|lcd|oled/i`. If the
file is missing or fails to load, an error boundary falls back to the procedural
watch automatically.

## Responsiveness & performance

- **Desktop (≥1024px, WebGL, motion allowed):** full pinned immersive story.
- **Tablet / mobile / reduced-motion / no-WebGL:** `MobileExperience` — a premium
  vertical reveal (no pinning → no mobile address-bar jank, no layout shift), with a
  compact cycling 3D watch where capable and a styled CSS fallback otherwise.
- Heavy `three` code is a lazy chunk; it only loads when a canvas actually renders.
- The render loop is gated to when the section is on-screen; DPR/events adapt to GPU.
- All effects clean up (Lenis destroy, ScrollTrigger revert, observers/intervals/
  rAF, GPU textures) — safe under React StrictMode.
- Honors `prefers-reduced-motion`.
