/**
 * Orbit geometry shared by the nodes and the connector lines so they always
 * line up. Angles are measured CLOCKWISE from 12 o'clock (see featuresData).
 *
 * The orbit is an ELLIPSE (wider than tall) centred on the watch. Vertical
 * radius is intentionally smaller so the fanned nodes stay clear of the top
 * navbar and the bottom caption at any common viewport size.
 */
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export function getOrbit(width, height) {
  const cx = width / 2;
  const cy = height * 0.5; // hub == watch centre
  const Rx = clamp(width * 0.4, 130, 620);
  const Ry = clamp(height * 0.33, 110, 360);
  return { cx, cy, Rx, Ry };
}

export function nodePoint(cx, cy, Rx, Ry, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.sin(a) * Rx, y: cy - Math.cos(a) * Ry };
}
