/**
 * watchFace.js — draws the smartwatch screen onto a 2D canvas.
 *
 * The canvas is consumed as a THREE.CanvasTexture (map + emissiveMap) on the
 * watch's screen mesh, so the watch shows a real, animated UI that changes per
 * feature. Everything outside the rounded "glass" is left transparent so the
 * screen mesh reads as a real inset display.
 *
 * Pure drawing — no React, no THREE imports — so it stays cheap and testable.
 */

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---- per-feature motifs (drawn in a centered box) ---------------------------

function motifWave(ctx, cx, cy, R, accent, t) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = R * 0.06;
  ctx.lineCap = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.4;
  ctx.beginPath();
  for (let i = -R; i <= R; i += 3) {
    const env = Math.cos((i / R) * (Math.PI / 2));
    const y = cy + Math.sin(i * 0.05 + t * 4) * R * 0.45 * env;
    i === -R ? ctx.moveTo(cx + i, y) : ctx.lineTo(cx + i, y);
  }
  ctx.stroke();
  ctx.restore();
}

function motifFaceScan(ctx, cx, cy, R, accent, t) {
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = R * 0.04;
  roundRectPath(ctx, cx - R * 0.6, cy - R * 0.7, R * 1.2, R * 1.4, R * 0.3);
  ctx.stroke();
  // eyes + smile
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx - R * 0.22, cy - R * 0.15, R * 0.07, 0, TAU);
  ctx.arc(cx + R * 0.22, cy - R * 0.15, R * 0.07, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + R * 0.1, R * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  // scan line
  const sy = cy + Math.sin(t * 2) * R * 0.65;
  const grad = ctx.createLinearGradient(cx - R, sy, cx + R, sy);
  grad.addColorStop(0, rgba(accent, 0));
  grad.addColorStop(0.5, accent);
  grad.addColorStop(1, rgba(accent, 0));
  ctx.strokeStyle = grad;
  ctx.lineWidth = R * 0.05;
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.7, sy);
  ctx.lineTo(cx + R * 0.7, sy);
  ctx.stroke();
  ctx.restore();
}

function motifRadar(ctx, cx, cy, R, accent, t) {
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.5);
  ctx.lineWidth = R * 0.03;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R * i) / 3, 0, TAU);
    ctx.stroke();
  }
  const ang = (t * 1.6) % TAU;
  const sweep = ctx.createConicGradient ? ctx.createConicGradient(ang, cx, cy) : null;
  if (sweep) {
    sweep.addColorStop(0, rgba(accent, 0.55));
    sweep.addColorStop(0.12, rgba(accent, 0));
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
  }
  // blip
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.5;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(ang) * R * 0.55, cy + Math.sin(ang) * R * 0.55, R * 0.09, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function motifPill(ctx, cx, cy, R, accent, t) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.6);
  const w = R * 1.4;
  const h = R * 0.7;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = rgba(accent, 0.25);
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(-w / 2, -h / 2, w / 2, h);
  ctx.restore();
  // countdown ring
  ctx.save();
  ctx.strokeStyle = rgba('#ffffff', 0.12);
  ctx.lineWidth = R * 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineCap = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.4;
  const prog = (t * 0.25) % 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
  ctx.stroke();
  ctx.restore();
}

function motifAlbum(ctx, cx, cy, R, accent, t) {
  ctx.save();
  const g = R * 0.66;
  const gap = g * 0.16;
  const cell = (g * 2 - gap * 2) / 3;
  const active = Math.floor(t * 1.5) % 9;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const x = cx - g + c * (cell + gap);
      const y = cy - g + r * (cell + gap);
      roundRectPath(ctx, x, y, cell, cell, cell * 0.28);
      ctx.fillStyle = i === active ? accent : rgba(accent, 0.22);
      if (i === active) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = R * 0.3;
      } else ctx.shadowBlur = 0;
      ctx.fill();
    }
  }
  ctx.restore();
}

function motifVoiceBars(ctx, cx, cy, R, accent, t) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.3;
  const n = 5;
  const bw = R * 0.18;
  const gap = R * 0.16;
  const total = n * bw + (n - 1) * gap;
  for (let i = 0; i < n; i++) {
    const x = cx - total / 2 + i * (bw + gap);
    const hgt = R * (0.3 + 0.7 * Math.abs(Math.sin(t * 5 + i * 0.9)));
    roundRectPath(ctx, x, cy - hgt / 2, bw, hgt, bw / 2);
    ctx.fill();
  }
  ctx.restore();
}

function motifSos(ctx, cx, cy, R, accent, t) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.9 + i / 3) % 1);
    ctx.strokeStyle = rgba(accent, (1 - p) * 0.7);
    ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (0.3 + p * 0.9), 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.6;
  ctx.font = `700 ${R * 0.5}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SOS', cx, cy + R * 0.02);
  ctx.restore();
}

function motifClock(ctx, cx, cy, R, accent, t) {
  ctx.save();
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = R * 0.04;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.92, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78);
    ctx.lineTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88);
    ctx.stroke();
  }
  ctx.lineCap = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.3;
  const hourA = t * 0.2 - Math.PI / 2;
  const minA = t * 0.9 - Math.PI / 2;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = R * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourA) * R * 0.45, cy + Math.sin(hourA) * R * 0.45);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = R * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minA) * R * 0.72, cy + Math.sin(minA) * R * 0.72);
  ctx.stroke();
  ctx.restore();
}

function motifChat(ctx, cx, cy, R, accent, t) {
  ctx.save();
  // incoming bubble
  roundRectPath(ctx, cx - R * 0.85, cy - R * 0.75, R * 1.3, R * 0.6, R * 0.22);
  ctx.fillStyle = rgba(accent, 0.3);
  ctx.fill();
  // reply bubble with typing dots
  roundRectPath(ctx, cx - R * 0.35, cy + R * 0.1, R * 1.2, R * 0.62, R * 0.22);
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * 0.3;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0118';
  for (let i = 0; i < 3; i++) {
    const yo = Math.sin(t * 6 + i * 0.7) * R * 0.06;
    ctx.beginPath();
    ctx.arc(cx + R * 0.05 + i * R * 0.28, cy + R * 0.41 + yo, R * 0.08, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const MOTIFS = {
  wave: motifWave,
  faceScan: motifFaceScan,
  radar: motifRadar,
  pill: motifPill,
  album: motifAlbum,
  voiceBars: motifVoiceBars,
  sos: motifSos,
  clock: motifClock,
  chat: motifChat,
};

// ---- composite screen states ------------------------------------------------

function drawStatusBar(ctx, w, pad, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = `600 ${w * 0.075}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('10:24', pad, pad * 1.5);
  // battery
  ctx.textAlign = 'right';
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = w * 0.008;
  const bw = w * 0.12;
  const bh = w * 0.06;
  const bx = w - pad - bw;
  const by = pad * 1.5 - bh / 2;
  roundRectPath(ctx, bx, by, bw, bh, bh * 0.3);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.fillRect(bx + bw * 0.12, by + bh * 0.22, bw * 0.6, bh * 0.56);
  ctx.restore();
}

function drawBrandFace(ctx, w, h, accent, t, label) {
  const cx = w / 2;
  const cy = h * 0.44;
  const R = w * 0.2;
  ctx.save();
  // pulsing ring
  ctx.strokeStyle = rgba(accent, 0.9);
  ctx.lineWidth = R * 0.08;
  ctx.shadowColor = accent;
  ctx.shadowBlur = R * (0.6 + 0.3 * Math.sin(t * 2));
  ctx.beginPath();
  ctx.arc(cx, cy, R * (1 + 0.04 * Math.sin(t * 2)), 0, TAU);
  ctx.stroke();
  // "A" mark
  ctx.shadowBlur = R * 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${R * 1.1}px 'Plus Jakarta Sans', Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', cx, cy + R * 0.04);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 ${w * 0.1}px 'Plus Jakarta Sans', Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, h * 0.74);
  ctx.restore();
}

function drawFeatureFace(ctx, w, h, feature, t) {
  const accent = feature.accent;
  drawStatusBar(ctx, w, w * 0.1, accent);
  const cx = w / 2;
  const cy = h * 0.43;
  const R = w * 0.27;
  const motif = MOTIFS[feature.motif] || motifWave;
  motif(ctx, cx, cy, R, accent, t);
  // label
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${w * 0.11}px 'Plus Jakarta Sans', Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(feature.screenLabel, cx, h * 0.82);
  // accent underline
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = w * 0.06;
  roundRectPath(ctx, cx - w * 0.08, h * 0.88, w * 0.16, w * 0.018, w * 0.01);
  ctx.fill();
  ctx.restore();
}

function drawConnectFace(ctx, w, h, t) {
  const cx = w / 2;
  const cy = h * 0.46;
  const R = w * 0.28;
  ctx.save();
  // nodes around a hub, lines pulsing
  const n = 9;
  ctx.strokeStyle = 'rgba(168,85,247,0.55)';
  ctx.lineWidth = w * 0.01;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 0.3;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i));
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = w * 0.05;
    ctx.beginPath();
    ctx.arc(x, y, w * 0.03, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#a855f7';
  ctx.shadowBlur = w * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.06, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 ${w * 0.09}px 'Plus Jakarta Sans', Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('All systems', w / 2, h * 0.85);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} o  { w, h, mode:'intro'|'feature'|'connect'|'final', feature, t, accent }
 */
export function drawWatchFace(ctx, o) {
  const { w, h } = o;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  // rounded display + dark gradient background
  roundRectPath(ctx, 0, 0, w, h, w * 0.26);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#120a23');
  g.addColorStop(1, '#06030f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // ambient accent glow from the active hue
  const accent = o.accent || (o.feature && o.feature.accent) || '#a855f7';
  const rg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.75);
  rg.addColorStop(0, rgba(accent, 0.22));
  rg.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  if (o.mode === 'feature' && o.feature) drawFeatureFace(ctx, w, h, o.feature, o.t);
  else if (o.mode === 'connect') drawConnectFace(ctx, w, h, o.t);
  else if (o.mode === 'final') drawBrandFace(ctx, w, h, accent, o.t, 'ALZCare');
  else drawBrandFace(ctx, w, h, accent, o.t, 'ALZCare');

  // inner vignette for depth
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = w * 0.02;
  roundRectPath(ctx, w * 0.01, h * 0.01, w * 0.98, h * 0.98, w * 0.25);
  ctx.stroke();
  ctx.restore();
}
