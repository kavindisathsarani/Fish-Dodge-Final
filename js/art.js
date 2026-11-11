/* art.js - all artwork for Fish Dodge, drawn as SVG from code.
   THEME: high cohesion - one place owns how things look.

   Every piece is a small object { viewBox:[x,y,w,h], inner:'<svg markup>' }.
   The same piece is used in two ways, so the menu and the game always match:
     1. as a <symbol> in the page (menu fish, corals on the menu screens, how-to icons)
     2. rasterised ONCE into a canvas sprite for the game loop (cheap to draw 60 times a second)
*/
import { rng } from './rng.js';

const r1 = n => Math.round(n * 10) / 10;
const hsl = (h, s, l, a = 1) => `hsl(${Math.round(h)} ${s}% ${l}%${a < 1 ? ` / ${a}` : ''})`;

/* ════════════════════════════════════════════
   THE FISH  (faces right; origin = middle of the body)
   Three parts so the game can animate them: tail, body, pectoral fin.
════════════════════════════════════════════ */
const FISH_VB = [-112, -64, 224, 128];
const BODY = 'M52 3C51 -12 36 -29 6 -31C-18 -32 -35 -20 -43 -7C-45 -3 -45 3 -43 7C-35 20 -18 31 6 30C36 29 51 17 52 3Z';
export const FISH_TAIL_JOINT = { x: -41, y: 0 };
export const FISH_FIN_JOINT = { x: 16, y: 9 };

function fishDefs(u) {
  return `<defs>
  <linearGradient id="${u}b" x1="0" y1="-31" x2="0" y2="31" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#17327f"/><stop offset=".26" stop-color="#1b63d6"/>
    <stop offset=".56" stop-color="#1fb1ee"/><stop offset=".82" stop-color="#8fecff"/><stop offset="1" stop-color="#e9fbff"/>
  </linearGradient>
  <linearGradient id="${u}f" x1="-40" y1="0" x2="-90" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fbbf24"/><stop offset=".5" stop-color="#fb8a1f"/><stop offset="1" stop-color="#f43f5e" stop-opacity=".78"/>
  </linearGradient>
  <linearGradient id="${u}d" x1="0" y1="-58" x2="0" y2="-24" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#f43f5e" stop-opacity=".85"/><stop offset=".45" stop-color="#fb8a1f"/><stop offset="1" stop-color="#fbbf24"/>
  </linearGradient>
  <linearGradient id="${u}p" x1="16" y1="9" x2="-14" y2="28" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#fb7185" stop-opacity=".85"/>
  </linearGradient>
  <linearGradient id="${u}g" x1="0" y1="-31" x2="0" y2="-2" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="${u}i" cx=".42" cy=".38" r=".7">
    <stop offset="0" stop-color="#fff3a8"/><stop offset=".45" stop-color="#f59e0b"/><stop offset="1" stop-color="#7c2d12"/>
  </radialGradient>
  <linearGradient id="${u}m" x1="52" y1="0" x2="-44" y2="0" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="1"/>
  </linearGradient>
  <mask id="${u}k" maskUnits="userSpaceOnUse" x="-50" y="-34" width="110" height="68"><rect x="-50" y="-34" width="110" height="68" fill="url(#${u}m)"/></mask>
  <pattern id="${u}s" width="14" height="12" patternUnits="userSpaceOnUse">
    <path d="M0 6Q7 -3 14 6M-7 12Q0 3 7 12M7 12Q14 3 21 12" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="1.1"/>
  </pattern>
  <clipPath id="${u}c"><path d="${BODY}"/></clipPath>
</defs>`;
}

export function fishTail(u = 'ft') {
  const rays = [[-86, -45], [-80, -32], [-78, -18], [-77, -6], [-86, 45], [-80, 32], [-78, 18], [-77, 6]]
    .map(([x, y]) => `M-41 0L${x} ${y}`).join('');
  return { viewBox: FISH_VB, inner: `${fishDefs(u)}
  <path d="M-39 -5C-52 -12 -62 -30 -88 -49C-80 -30 -78 -14 -77 -3C-79 -1 -79 1 -77 3C-78 14 -80 30 -88 49C-62 30 -52 12 -39 5Z" fill="url(#${u}f)" stroke="#c2410c" stroke-opacity=".35" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="${rays}" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="1.1" stroke-linecap="round"/>` };
}

export function fishFin(u = 'fp') {
  return { viewBox: FISH_VB, inner: `${fishDefs(u)}
  <path d="M16 8C8 5 -5 10 -17 27C-6 29 9 23 19 14Z" fill="url(#${u}p)" stroke="#c2410c" stroke-opacity=".3" stroke-width="1" stroke-linejoin="round"/>
  <path d="M15 9L-12 26M14 10L-4 27M15 11L5 24" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width=".9" stroke-linecap="round"/>` };
}

export function fishBody(u = 'fb') {
  return { viewBox: FISH_VB, inner: `${fishDefs(u)}
  <!-- fins behind the body -->
  <path d="M21 -28C17 -46 0 -59 -17 -57C-12 -49 -22 -34 -35 -21C-14 -26 4 -28 21 -28Z" fill="url(#${u}d)" stroke="#c2410c" stroke-opacity=".3" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M13 -28L-3 -52M3 -28L-11 -51M-8 -26L-17 -47M-20 -24L-27 -38" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width=".9" stroke-linecap="round"/>
  <path d="M12 25C12 39 0 51 -17 49C-9 41 -8 33 -8 26Z" fill="url(#${u}p)" stroke="#c2410c" stroke-opacity=".3" stroke-width="1" stroke-linejoin="round"/>
  <path d="M-25 23C-27 33 -38 39 -49 35C-41 29 -39 22 -37 15Z" fill="url(#${u}p)" stroke="#c2410c" stroke-opacity=".3" stroke-width="1" stroke-linejoin="round"/>
  <!-- body -->
  <path d="${BODY}" fill="url(#${u}b)"/>
  <g clip-path="url(#${u}c)">
    <rect x="-46" y="-33" width="100" height="66" fill="url(#${u}s)" mask="url(#${u}k)"/>
    <path d="M2 -34C-8 -14 -8 14 2 34L-9 34C-19 14 -19 -14 -9 -34Z" fill="#fbbf24" fill-opacity=".9"/>
    <path d="M2 -34C-8 -14 -8 14 2 34M-9 -34C-19 -14 -19 14 -9 34" fill="none" stroke="#0b1f5c" stroke-opacity=".45" stroke-width="1.6"/>
    <ellipse cx="8" cy="21" rx="32" ry="8" fill="#fff" fill-opacity=".28"/>
  </g>
  <path d="M46 -6C40 -22 22 -28 4 -28C-14 -28 -28 -21 -35 -10C-18 -21 14 -23 46 -6Z" fill="url(#${u}g)"/>
  <path d="${BODY}" fill="none" stroke="#0a2a6b" stroke-opacity=".55" stroke-width="1.7" stroke-linejoin="round"/>
  <!-- gill, mouth, cheek -->
  <path d="M21 -17C13 -3 13 9 21 19" fill="none" stroke="#0b2a6b" stroke-opacity=".42" stroke-width="2.2" stroke-linecap="round"/>
  <ellipse cx="25" cy="11" rx="6.5" ry="4.2" fill="#fb7185" fill-opacity=".42"/>
  <path d="M52 4C49 9 44 10.5 39 9.5" fill="none" stroke="#0b1b3f" stroke-width="2.1" stroke-linecap="round"/>
  <!-- eye -->
  <circle cx="34" cy="-8" r="10.5" fill="#fff" stroke="#0b2a6b" stroke-opacity=".5" stroke-width="1.2"/>
  <circle cx="36" cy="-7.5" r="7.4" fill="url(#${u}i)"/>
  <circle cx="37" cy="-7.5" r="4" fill="#0b1220"/>
  <circle cx="39.2" cy="-10" r="2.5" fill="#fff"/>
  <circle cx="34.4" cy="-4.2" r="1.2" fill="#fff" fill-opacity=".9"/>` };
}

/** Whole fish at rest, for menu / how-to / feedback screens. */
export function fishStatic(u = 'fs') {
  const t = fishTail(u + 't'), b = fishBody(u + 'b'), p = fishFin(u + 'p');
  return { viewBox: FISH_VB, inner: t.inner + b.inner + p.inner };
}

/* ════════════════════════════════════════════
   FISH FOOD  (a small pinch of colourful pellets)
════════════════════════════════════════════ */
export function foodPellets(u = 'fd') {
  const pellet = (cx, cy, r, a, b, c, id) => `
  <radialGradient id="${u}${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${u}${id})" stroke="${c}" stroke-opacity=".6" stroke-width="1"/>
  <circle cx="${cx - r * .32}" cy="${cy - r * .34}" r="${r * .27}" fill="#fff" fill-opacity=".85"/>`;
  return { viewBox: [0, 0, 48, 48], inner: `
  ${pellet(16, 30, 11, '#ffd6a0', '#fb923c', '#c2410c', 'a')}
  ${pellet(32, 32, 10, '#fff6b0', '#facc15', '#a16207', 'b')}
  ${pellet(24, 15, 11, '#ffc2c2', '#f87171', '#b91c1c', 'c')}` };
}

export function heart(u = 'ht') {
  return { viewBox: [0, 0, 24, 22], inner: `
  <defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a7a"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>
  <path d="M12 21C-6 9 3 -3 12 5C21 -3 30 9 12 21Z" fill="url(#${u})" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M6 6.2C7.4 4.6 9.6 4.8 10.6 6.4" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>` };
}

/* ════════════════════════════════════════════
   CORALS
   All grow upward from the bottom-middle of their box.
════════════════════════════════════════════ */

/** Branching staghorn coral. */
export function branchCoral(seed = 1, hue = 335, u = 'bc') {
  const rand = rng(seed * 131 + 7);
  const segs = [], tips = [];
  const maxDepth = 4;
  (function grow(x, y, ang, len, w, depth) {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    const bend = ang + (rand() - .5) * .55;
    segs.push({ x, y, cx: x + Math.cos(bend) * len * .55, cy: y + Math.sin(bend) * len * .55, x2, y2, w, depth });
    if (depth >= maxDepth) { tips.push([x2, y2, w]); return; }
    const n = depth === 0 ? 3 : rand() < .4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * (.5 + rand() * .3);
      grow(x2, y2, ang + spread + (rand() - .5) * .22, len * (.7 + rand() * .1), w * .66, depth + 1);
    }
  })(0, 0, -Math.PI / 2, 40, 15, 0);

  let x0 = 1e9, x1 = -1e9, y0 = 1e9;
  for (const s of segs) { x0 = Math.min(x0, s.x2 - s.w, s.cx); x1 = Math.max(x1, s.x2 + s.w, s.cx); y0 = Math.min(y0, s.y2 - s.w * 2); }
  const pad = 8, vb = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, -y0 + pad + 10];
  const col = d => hsl(hue + d * 4, 72 + d * 4, 34 + d * 7);
  let out = '';
  for (const s of segs.sort((a, b) => a.depth - b.depth)) {
    const p = `M${r1(s.x)} ${r1(s.y)}Q${r1(s.cx)} ${r1(s.cy)} ${r1(s.x2)} ${r1(s.y2)}`;
    out += `<path d="${p}" fill="none" stroke="${hsl(hue, 70, 24)}" stroke-width="${r1(s.w + 2.4)}" stroke-linecap="round"/>`;
    out += `<path d="${p}" fill="none" stroke="${col(s.depth)}" stroke-width="${r1(s.w)}" stroke-linecap="round"/>`;
    if (s.w > 4) out += `<path d="M${r1(s.x - s.w * .22)} ${r1(s.y - 1)}Q${r1(s.cx - s.w * .22)} ${r1(s.cy - 1)} ${r1(s.x2 - s.w * .22)} ${r1(s.y2 - 1)}" fill="none" stroke="${hsl(hue + 8, 90, 78, .55)}" stroke-width="${r1(s.w * .3)}" stroke-linecap="round"/>`;
  }
  for (const [x, y, w] of tips) {
    out += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(w * .8 + 1.6)}" fill="${hsl(hue + 14, 95, 76)}"/><circle cx="${r1(x - .8)}" cy="${r1(y - .8)}" r="${r1((w * .8 + 1.6) * .42)}" fill="#fff" fill-opacity=".85"/>`;
  }
  return { viewBox: vb, inner: out };
}

/** Sea fan (gorgonian): a lacy fan of ribs. */
export function fanCoral(hue = 305, u = 'fc') {
  const rand = rng(Math.round(hue) * 17 + 3);
  const bx = 90, by = 158, N = 11, ribs = [];
  let out = `<defs><radialGradient id="${u}v" cx=".5" cy="1" r="1"><stop offset="0" stop-color="${hsl(hue, 80, 60, .45)}"/><stop offset="1" stop-color="${hsl(hue, 80, 60, .05)}"/></radialGradient></defs>`;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1) * 2 - 1;
    const ang = -Math.PI / 2 + t * 1.12;
    const L = 122 - Math.abs(t) * 22 + rand() * 6;
    ribs.push({ ang, L, t });
  }
  const pt = (rb, f, wob = 0) => [bx + Math.cos(rb.ang) * rb.L * f + Math.sin(rb.ang) * wob, by + Math.sin(rb.ang) * rb.L * f - Math.cos(rb.ang) * wob];
  // soft veil
  out += `<path d="M${bx} ${by}${ribs.map(rb => `L${r1(pt(rb, 1)[0])} ${r1(pt(rb, 1)[1])}`).join('')}Z" fill="url(#${u}v)"/>`;
  // cross links
  for (const f of [.3, .46, .62, .78, .93]) {
    let d = '';
    ribs.forEach((rb, i) => { const [x, y] = pt(rb, f, Math.sin(i * 1.7 + f * 9) * 2.6); d += (i ? 'L' : 'M') + r1(x) + ' ' + r1(y); });
    out += `<path d="${d}" fill="none" stroke="${hsl(hue + 14, 85, 72)}" stroke-width="1.5" stroke-opacity=".85" stroke-linejoin="round"/>`;
  }
  // ribs
  for (const rb of ribs) {
    const [mx, my] = pt(rb, .55, 5 * rb.t), [ex, ey] = pt(rb, 1);
    out += `<path d="M${bx} ${by}Q${r1(mx)} ${r1(my)} ${r1(ex)} ${r1(ey)}" fill="none" stroke="${hsl(hue, 70, 30)}" stroke-width="4.4" stroke-linecap="round"/>`;
    out += `<path d="M${bx} ${by}Q${r1(mx)} ${r1(my)} ${r1(ex)} ${r1(ey)}" fill="none" stroke="${hsl(hue, 78, 58)}" stroke-width="2.4" stroke-linecap="round"/>`;
    out += `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.4" fill="${hsl(hue + 12, 95, 80)}"/>`;
  }
  out += `<path d="M${bx} 171L${bx} ${by - 4}" stroke="${hsl(hue, 65, 26)}" stroke-width="9" stroke-linecap="round"/><path d="M${bx - 1} 171L${bx - 1} ${by - 4}" stroke="${hsl(hue, 70, 44)}" stroke-width="4" stroke-linecap="round"/>`;
  return { viewBox: [0, 12, 180, 166], inner: out };
}

/** Brain coral: a dome covered in winding grooves. */
export function brainCoral(hue = 48, u = 'br') {
  const rand = rng(Math.round(hue) * 7 + 11);
  const dome = 'M6 108C6 44 46 8 86 8C126 8 166 44 166 108Z';
  let grooves = '', lights = '';
  for (let k = 0; k < 12; k++) {
    const y0 = 20 + k * 7.6, ph = rand() * 6, fr = .09 + rand() * .06, am = 2.4 + rand() * 2.4;
    let d = '', d2 = '';
    for (let x = 4; x <= 168; x += 5) {
      const y = y0 + Math.sin(x * fr + ph) * am + Math.sin(x * fr * 2.3 + ph * 1.7) * am * .5;
      d += (x === 4 ? 'M' : 'L') + x + ' ' + r1(y);
      d2 += (x === 4 ? 'M' : 'L') + x + ' ' + r1(y + 1.6);
    }
    grooves += `<path d="${d}" fill="none" stroke="${hsl(hue, 55, 24)}" stroke-width="2.7" stroke-opacity=".6" stroke-linejoin="round"/>`;
    lights += `<path d="${d2}" fill="none" stroke="${hsl(hue, 85, 82)}" stroke-width="1.3" stroke-opacity=".55" stroke-linejoin="round"/>`;
  }
  return { viewBox: [0, 0, 172, 114], inner: `<defs>
    <radialGradient id="${u}g" cx=".36" cy=".26" r=".95"><stop offset="0" stop-color="${hsl(hue, 85, 74)}"/><stop offset=".5" stop-color="${hsl(hue, 72, 52)}"/><stop offset="1" stop-color="${hsl(hue, 62, 28)}"/></radialGradient>
    <clipPath id="${u}c"><path d="${dome}"/></clipPath></defs>
    <ellipse cx="86" cy="109" rx="84" ry="6" fill="#000" fill-opacity=".22"/>
    <path d="${dome}" fill="url(#${u}g)"/>
    <g clip-path="url(#${u}c)">${grooves}${lights}
      <ellipse cx="62" cy="34" rx="30" ry="13" fill="#fff" fill-opacity=".22" transform="rotate(-18 62 34)"/></g>
    <path d="${dome}" fill="none" stroke="${hsl(hue, 60, 22)}" stroke-opacity=".5" stroke-width="2"/>` };
}

/** Tube / organ-pipe coral. */
export function tubeCoral(hue = 22, u = 'tb') {
  const tubes = [
    { x: 28, h: 66, w: 21, lean: -4 }, { x: 56, h: 108, w: 25, lean: -2 }, { x: 86, h: 136, w: 27, lean: 1 },
    { x: 113, h: 96, w: 23, lean: 3 }, { x: 134, h: 62, w: 19, lean: 5 }, { x: 98, h: 64, w: 17, lean: 2 },
  ];
  let defs = '', body = '';
  tubes.forEach((t, i) => {
    const hh = hue + (i % 3) * 5, id = `${u}${i}`;
    defs += `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hsl(hh, 78, 30)}"/><stop offset=".3" stop-color="${hsl(hh, 90, 62)}"/><stop offset=".52" stop-color="${hsl(hh + 8, 95, 76)}"/><stop offset="1" stop-color="${hsl(hh, 75, 28)}"/></linearGradient>`;
    const top = 156 - t.h, rx = t.w / 2, ry = t.w * .23, x = t.x;
    let crown = '';
    for (let a = 0; a < 9; a++) { const th = a / 9 * Math.PI * 2; crown += `M${r1(x + Math.cos(th) * rx * .3)} ${r1(top + Math.sin(th) * ry * .3)}L${r1(x + Math.cos(th) * rx * .82)} ${r1(top + Math.sin(th) * ry * .82 - 1)}`; }
    body += `<g transform="rotate(${t.lean} ${x} 156)">
      <path d="M${x - rx} 156L${x - rx} ${top}A${rx} ${ry} 0 0 1 ${x + rx} ${top}L${x + rx} 156Z" fill="url(#${id})"/>
      <ellipse cx="${x}" cy="${top}" rx="${rx}" ry="${ry}" fill="${hsl(hh, 88, 70)}"/>
      <ellipse cx="${x}" cy="${top + .6}" rx="${r1(rx - 2.4)}" ry="${r1(ry - 1.4)}" fill="${hsl(hh - 10, 70, 14)}"/>
      <path d="${crown}" stroke="${hsl(hh + 24, 95, 78)}" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M${x - rx + 4} ${top + 8}L${x - rx + 4} 150" stroke="#fff" stroke-opacity=".3" stroke-width="2.2" stroke-linecap="round"/></g>`;
  });
  return { viewBox: [0, 12, 164, 150], inner: `<defs>${defs}</defs><ellipse cx="82" cy="157" rx="74" ry="5" fill="#000" fill-opacity=".2"/>${body}` };
}

/** Sea anemone: a soft column crowned with waving tentacles. */
export function anemone(hue = 285, u = 'an') {
  const rand = rng(Math.round(hue) * 5 + 2);
  const cx = 65, cy = 88;
  const tents = Array.from({ length: 22 }, (_, i) => {
    const th = i / 22 * Math.PI * 2;
    return { th, bx: cx + Math.cos(th) * 25, by: cy + Math.sin(th) * 6.5, lean: Math.cos(th),
      tx: cx + Math.cos(th) * (34 + rand() * 20) + (rand() - .5) * 8, ty: cy - 44 - rand() * 26 + Math.sin(th) * 6, i };
  }).sort((a, b) => a.by - b.by);
  let t = '';
  for (const s of tents) {
    const c = hsl(hue + (s.i % 3) * 14, 80, 56 + (s.by - cy) * .9);
    const d = `M${r1(s.bx)} ${r1(s.by)}Q${r1(s.bx + s.lean * 14)} ${r1((s.by + s.ty) / 2 + 6)} ${r1(s.tx)} ${r1(s.ty)}`;
    t += `<path d="${d}" fill="none" stroke="${hsl(hue, 60, 22)}" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="4.4" stroke-linecap="round"/>`;
    t += `<circle cx="${r1(s.tx)}" cy="${r1(s.ty)}" r="3.4" fill="${hsl(hue + 30, 95, 82)}"/>`;
  }
  return { viewBox: [0, 0, 130, 110], inner: `<defs><linearGradient id="${u}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hsl(hue, 55, 28)}"/><stop offset=".4" stop-color="${hsl(hue, 70, 50)}"/><stop offset="1" stop-color="${hsl(hue, 55, 24)}"/></linearGradient></defs>
    <path d="M36 106C36 96 40 90 44 86L86 86C90 90 94 96 94 106Z" fill="url(#${u}c)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="27" ry="8" fill="${hsl(hue, 60, 30)}"/>${t}` };
}

/** Kelp / seaweed: three wavy blades. */
export function kelp(seed = 1, u = 'kp') {
  const rand = rng(seed * 53 + 9);
  const H = 200, blades = [{ x: 22, h: H * .78, w: 11 }, { x: 36, h: H, w: 14 }, { x: 50, h: H * .6, w: 10 }];
  let defs = '', out = '';
  blades.forEach((b, k) => {
    const ph = rand() * 6, am = 6 + rand() * 4, L = [], R = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, y = H - t * b.h, x = b.x + Math.sin(t * 5 + ph) * am * t;
      const w = b.w * Math.sin(Math.PI * Math.pow(t, .55)) * (1 - t * .45) + .6;
      L.push([x - w / 2, y]); R.push([x + w / 2, y]);
    }
    const d = 'M' + L.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'L' + R.reverse().map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z';
    defs += `<linearGradient id="${u}${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f5f3a"/><stop offset=".55" stop-color="#1fa356"/><stop offset="1" stop-color="#7be495"/></linearGradient>`;
    const mid = L.map((p, i) => [(p[0] + R[R.length - 1 - i][0]) / 2, p[1]]);
    out += `<path d="${d}" fill="url(#${u}${k})" stroke="#0b4a2d" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"/>
      <path d="M${mid.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L')}" fill="none" stroke="#c9ffd6" stroke-opacity=".4" stroke-width="1.2" stroke-linecap="round"/>`;
  });
  return { viewBox: [0, 0, 72, 204], inner: `<defs>${defs}</defs>${out}` };
}

export function starfish(u = 'sf') {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = i * Math.PI / 5 - Math.PI / 2, rad = i % 2 ? 11 : 27;
    return [30 + Math.cos(a) * rad, 31 + Math.sin(a) * rad];
  });
  const d = 'M' + pts.map(p => r1(p[0]) + ' ' + r1(p[1])).join('L') + 'Z';
  let dots = '';
  for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5 - Math.PI / 2; for (const f of [.35, .58, .8]) dots += `<circle cx="${r1(30 + Math.cos(a) * 27 * f)}" cy="${r1(31 + Math.sin(a) * 27 * f)}" r="${r1(2.2 - f * .8)}" fill="#fff3d6" fill-opacity=".85"/>`; }
  return { viewBox: [0, 0, 60, 60], inner: `<defs><radialGradient id="${u}" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ffb066"/><stop offset="1" stop-color="#ea580c"/></radialGradient></defs>
    <path d="${d}" fill="url(#${u})" stroke="#c2410c" stroke-width="5" stroke-linejoin="round"/><path d="${d}" fill="url(#${u})" stroke="url(#${u})" stroke-width="3" stroke-linejoin="round"/>${dots}` };
}

export function shell(u = 'sh') {
  let ribs = '';
  for (let i = 0; i < 7; i++) { const a = Math.PI * (.08 + i * .84 / 6); ribs += `M30 48L${r1(30 - Math.cos(a) * 28)} ${r1(48 - Math.sin(a) * 38)}`; }
  return { viewBox: [0, 0, 60, 56], inner: `<defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6e7"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs>
    <path d="M30 50C6 46 2 24 12 14C20 6 40 6 48 14C58 24 54 46 30 50Z" fill="url(#${u})" stroke="#be185d" stroke-opacity=".55" stroke-width="1.6"/>
    <path d="${ribs}" stroke="#be185d" stroke-opacity=".35" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M24 50L36 50L34 55L26 55Z" fill="#f9a8d4" stroke="#be185d" stroke-opacity=".5" stroke-width="1.2"/>` };
}


/* ════════════════════════════════════════════
   SEA LIFE  (decoration only - drawn faded, behind the rocks, never in the way)
   Fish / crab / seahorse face right; jellyfish hangs from its top.
════════════════════════════════════════════ */

/** Small reef fish (clownfish-ish stripes, or a yellow tang style). */
export function reefFish(hue = 28, u = 'rf', stripes = true) {
  const body = hsl(hue, 92, 56), dark = hsl(hue, 90, 38), light = hsl(hue, 100, 78);
  return { viewBox: [0, 0, 80, 48], inner: `
  <defs><linearGradient id="${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${body}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <clipPath id="${u}c"><path d="M62 24C60 12 46 6 32 7C18 8 10 16 9 24C10 32 18 40 32 41C46 42 60 36 62 24Z"/></clipPath></defs>
  <path d="M10 24L-2 8C3 18 3 30 -2 40Z" fill="${dark}" stroke="${dark}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M42 8C38 0 28 -1 20 4C26 6 30 7 34 8Z" fill="${dark}"/>
  <path d="M62 24C60 12 46 6 32 7C18 8 10 16 9 24C10 32 18 40 32 41C46 42 60 36 62 24Z" fill="url(#${u})" stroke="${dark}" stroke-width="1.4"/>
  ${stripes ? `<g clip-path="url(#${u}c)"><path d="M44 0L38 48L30 48L36 0Z" fill="#fff"/><path d="M24 0L18 48L13 48L19 0Z" fill="#fff"/><path d="M44 0L38 48M36 0L30 48M24 0L18 48M19 0L13 48" stroke="#1e293b" stroke-opacity=".35" stroke-width="1.2" fill="none"/></g>` : ''}
  <path d="M26 30C34 36 44 36 52 31" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
  <circle cx="51" cy="19" r="5" fill="#fff"/><circle cx="52.5" cy="19.5" r="3" fill="#0f172a"/><circle cx="53.5" cy="18" r="1.1" fill="#fff"/>` };
}

export function crab(u = 'cr') {
  const legs = [-1, 1].map(sd => [0, 1, 2].map(i =>
    `<path d="M${40 + sd * 12} ${42 + i * 4}Q${40 + sd * 26} ${40 + i * 6} ${40 + sd * 32} ${52 + i * 3}" fill="none" stroke="#c2410c" stroke-width="3.2" stroke-linecap="round"/>`).join('')).join('');
  const claw = sd => `<path d="M${40 + sd * 14} 38Q${40 + sd * 24} 30 ${40 + sd * 24} 20" fill="none" stroke="#dc2626" stroke-width="4" stroke-linecap="round"/>
  <path d="M${40 + sd * 24} 22C${40 + sd * 14} 14 ${40 + sd * 18} 2 ${40 + sd * 24} 4C${40 + sd * 30} 2 ${40 + sd * 34} 14 ${40 + sd * 24} 22Z" fill="url(#${u})" stroke="#9a1c1c" stroke-width="1.4"/>
  <path d="M${40 + sd * 24} 6L${40 + sd * 24} 17" stroke="#9a1c1c" stroke-width="1.2"/>`;
  return { viewBox: [0, 0, 80, 62], inner: `
  <defs><radialGradient id="${u}" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#ff8a72"/><stop offset=".6" stop-color="#ef4444"/><stop offset="1" stop-color="#b91c1c"/></radialGradient></defs>
  ${legs}${claw(-1)}${claw(1)}
  <ellipse cx="40" cy="44" rx="21" ry="14" fill="url(#${u})" stroke="#9a1c1c" stroke-width="1.5"/>
  <ellipse cx="34" cy="39" rx="9" ry="4" fill="#fff" fill-opacity=".3"/>
  <path d="M33 33L32 27M47 33L48 27" stroke="#9a1c1c" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="32" cy="25" r="4" fill="#fff" stroke="#9a1c1c" stroke-width="1"/><circle cx="48" cy="25" r="4" fill="#fff" stroke="#9a1c1c" stroke-width="1"/>
  <circle cx="32.6" cy="25.4" r="2" fill="#0f172a"/><circle cx="47.4" cy="25.4" r="2" fill="#0f172a"/>` };
}

export function seahorse(u = 'sh2') {
  return { viewBox: [0, 0, 44, 84], inner: `
  <defs><linearGradient id="${u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset=".55" stop-color="#fb923c"/><stop offset="1" stop-color="#f43f5e"/></linearGradient></defs>
  <path d="M22 8C32 6 36 14 33 20L42 22C42 24 38 25 34 25C38 38 36 52 28 60C24 66 24 72 29 74C34 76 36 70 32 68" fill="none" stroke="url(#${u})" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 8C14 8 11 16 15 22C19 28 26 26 26 36C26 46 18 54 18 64C18 70 22 74 28 74" fill="none" stroke="url(#${u})" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M33 20C36 18 40 20 41 23" fill="none" stroke="#c2410c" stroke-width="3" stroke-linecap="round"/>
  <path d="M10 36C4 40 4 48 11 50" fill="none" stroke="#fbbf24" stroke-width="5" stroke-linecap="round" stroke-opacity=".8"/>
  <path d="M19 5L17 -1M24 5L25 -2" stroke="#f43f5e" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M18 34Q26 36 30 34M18 42Q26 44 29 42M18 50Q25 52 27 50" stroke="#fff" stroke-opacity=".5" stroke-width="1.6" fill="none"/>
  <circle cx="22" cy="14" r="3.6" fill="#fff"/><circle cx="22.8" cy="14.3" r="2" fill="#0f172a"/>` };
}

export function jellyfish(hue = 300, u = 'jf') {
  const c1 = hsl(hue, 85, 80), c2 = hsl(hue, 80, 62), tent = hsl(hue, 85, 78);
  const tents = [14, 24, 34, 44, 54].map((x, i) =>
    `<path d="M${x} 36Q${x + (i % 2 ? 6 : -6)} 50 ${x} 60T${x + (i % 2 ? 3 : -3)} 84" fill="none" stroke="${tent}" stroke-width="2.4" stroke-linecap="round" stroke-opacity=".8"/>`).join('');
  return { viewBox: [0, 0, 68, 88], inner: `
  <defs><radialGradient id="${u}" cx=".5" cy=".25" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="${c1}" stop-opacity=".9"/><stop offset="1" stop-color="${c2}" stop-opacity=".85"/></radialGradient></defs>
  ${tents}
  <path d="M6 36C6 14 18 4 34 4C50 4 62 14 62 36C54 40 48 34 41 38C36 41 32 41 27 38C20 34 14 40 6 36Z" fill="url(#${u})" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
  <ellipse cx="26" cy="16" rx="10" ry="5" fill="#fff" fill-opacity=".5" transform="rotate(-18 26 16)"/>` };
}

/* ════════════════════════════════════════════
   ROCK  (shared shape maths: used by the menu SVG and by the game's canvas rocks)
════════════════════════════════════════════ */
/** Returns jagged-but-soft polygon points around (0,0) for radius 1. */
export function rockShape(rand, n = 11) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (rand() - .5) * .25;
    const rad = .93 + rand() * .2;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad * .92]);
  }
  return pts;
}

/** Soft closed path through points (midpoint smoothing). */
export function smoothPath(pts, s = 1) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2 * s, (a[1] + b[1]) / 2 * s];
  let m = mid(pts[n - 1], pts[0]), d = `M${r1(m[0])} ${r1(m[1])}`;
  for (let i = 0; i < n; i++) { const c = pts[i], e = mid(pts[i], pts[(i + 1) % n]); d += `Q${r1(c[0] * s)} ${r1(c[1] * s)} ${r1(e[0])} ${r1(e[1])}`; }
  return d + 'Z';
}

export function rockArt(seed = 3, u = 'rk') {
  const rand = rng(seed * 29 + 5), pts = rockShape(rand), S = 26, c = 30;
  const facets = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const lit = -(mx * .6 + my * .8) / Math.hypot(mx, my); // light from upper left
    const fill = lit > 0 ? `rgba(255,255,255,${(lit * .26).toFixed(2)})` : `rgba(8,20,40,${(-lit * .34).toFixed(2)})`;
    return `<path d="M${c} ${c}L${r1(c + p[0] * S)} ${r1(c + p[1] * S)}L${r1(c + q[0] * S)} ${r1(c + q[1] * S)}Z" fill="${fill}"/>`;
  }).join('');
  const shape = smoothPath(pts, S).replace(/^M([\d.-]+) ([\d.-]+)/, (_, x, y) => `M${r1(+x + c)} ${r1(+y + c)}`);
  const body = `<g transform="translate(${c} ${c})"><path d="${smoothPath(pts, S)}" fill="url(#${u}g)"/></g>`;
  return { viewBox: [0, 0, 60, 60], inner: `<defs>
    <radialGradient id="${u}g" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#9fb4cc"/><stop offset=".55" stop-color="#5f7794"/><stop offset="1" stop-color="#2d405a"/></radialGradient>
    <clipPath id="${u}c"><path d="${shape}"/></clipPath></defs>
    ${body}<g clip-path="url(#${u}c)">${facets}
      <path d="M12 21C16 14 24 11 31 12C24 15 19 19 17 25Z" fill="#fff" fill-opacity=".3"/>
      <path d="M18 40C26 44 36 43 43 36" fill="none" stroke="#0b1a2e" stroke-opacity=".3" stroke-width="2"/>
      <path d="M17 17C21 20 22 24 21 28" fill="none" stroke="#2d3f57" stroke-opacity=".6" stroke-width="1.2"/></g>
    <g transform="translate(${c} ${c})"><path d="${smoothPath(pts, S)}" fill="none" stroke="#1a283d" stroke-width="2.2" stroke-linejoin="round" stroke-opacity=".85"/></g>
    <path d="M13 30C14 22 21 15 30 14C35 14 40 17 42 20C36 17 30 18 25 22C20 25 16 28 13 30Z" fill="#4ade80" fill-opacity=".8"/>
    <circle cx="20" cy="40" r="1.8" fill="#fde68a" fill-opacity=".8"/><circle cx="25" cy="43" r="1.4" fill="#fde68a" fill-opacity=".8"/>` };
}

/* ════════════════════════════════════════════
   THE SPRITE CATALOGUE
════════════════════════════════════════════ */
export const CORALS = {
  'coral-branch-a': branchCoral(1, 338, 'bca'),
  'coral-branch-b': branchCoral(4, 18, 'bcb'),
  'coral-branch-c': branchCoral(9, 282, 'bcc'),
  'coral-fan-a': fanCoral(312, 'fca'),
  'coral-fan-b': fanCoral(18, 'fcb'),
  'coral-brain-a': brainCoral(48, 'bra'),
  'coral-brain-b': brainCoral(150, 'brb'),
  'coral-tube-a': tubeCoral(22, 'tba'),
  'coral-tube-b': tubeCoral(318, 'tbb'),
  'coral-anemone-a': anemone(285, 'ana'),
  'coral-anemone-b': anemone(170, 'anb'),
  'kelp-a': kelp(1, 'kpa'),
  'kelp-b': kelp(2, 'kpb'),
  'starfish': starfish(),
  'shell': shell(),
};

export const SEALIFE = {
  'fish-orange': reefFish(28, 'rfa', true),
  'fish-yellow': reefFish(50, 'rfb', false),
  'fish-pink': reefFish(335, 'rfc', true),
  'crab': crab('cra'),
  'seahorse': seahorse('sha'),
  'jelly-a': jellyfish(300, 'jfa'),
  'jelly-b': jellyfish(190, 'jfb'),
};

export const SYMBOLS = {
  fish: fishStatic('fs'),
  pellets: foodPellets('fd'),
  heart: heart('ht'),
  rock: rockArt(3, 'rkm'),
  plant: CORALS['kelp-a'], // legacy id used by older markup
  ...CORALS,
  ...SEALIFE,
};

const sym = (id, a) => `<symbol id="${id}" viewBox="${a.viewBox.join(' ')}" overflow="visible">${a.inner}</symbol>`;

/** Put every sprite into the page once, so <svg><use href="#coral-fan-a"/></svg> works anywhere. */
export function injectSprites() {
  if (document.getElementById('sprites')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'sprites'; svg.setAttribute('width', 0); svg.setAttribute('height', 0);
  svg.setAttribute('style', 'position:absolute'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<defs>
    <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a4"/><stop offset=".4" stop-color="#f2b84f"/><stop offset="1" stop-color="#c4842f"/></linearGradient>
    <linearGradient id="sandBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc4c9"/><stop offset="1" stop-color="#4a98a8"/></linearGradient>
  </defs>` + Object.entries(SYMBOLS).map(([id, a]) => sym(id, a)).join('');
  document.body.prepend(svg);
}

/** Draw an art piece into a canvas, `w` logical px wide (height follows the shape), `k` = pixel density. */
export async function rasterize(art, w, k = 2) {
  const [vx, vy, vw, vh] = art.viewBox, h = w * vh / vw;
  const W = Math.ceil(w * k), H = Math.ceil(h * k);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${W}" height="${H}">${art.inner}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').drawImage(img, 0, 0, W, H);
  return Object.assign(c, { lw: w, lh: h, vb: art.viewBox, scale: w / vw });
}
