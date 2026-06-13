/**
 * Shared scroll → transform math so the procedural watch and any drop-in GLB
 * model animate identically. Pure functions, no THREE/React imports.
 */
import { BANDS } from './featuresData.js';

export const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @param {number} p        scroll progress 0..1
 * @param {{x:number,y:number}} pointer  normalized pointer (-1..1)
 * @param {boolean} reduced prefers-reduced-motion
 * @returns {{scale:number, rotY:number, rotX:number, posY:number, intro:number}}
 */
export function watchTransform(p, pointer, reduced) {
  const intro = easeOut(Math.min(p / BANDS.introEnd, 1));
  const scale = 0.6 + 0.4 * intro;
  const turn = -0.9 * (1 - intro) + (p - BANDS.introEnd) * 0.5;
  const rotY = turn + (reduced ? 0 : pointer.x * 0.25);
  const rotX = -0.04 - (reduced ? 0 : pointer.y * 0.18);
  const posY = (1 - intro) * -0.4;
  return { scale, rotY, rotX, posY, intro };
}
