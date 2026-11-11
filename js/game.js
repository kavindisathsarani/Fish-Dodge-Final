/* game.js - the canvas game loop, physics, collisions and drawing.
   THEME: high cohesion. No DOM and no database in here: it only talks to the canvas and
   announces what happened through events.js ('hud', 'life-lost', 'out-of-lives', 'level-complete', ...).

   How it stays smooth:
   - everything is drawn from pre-rendered sprites (art.js), so a frame is a few dozen drawImage calls
   - the canvas is sized to the screen's real pixel density, so it is sharp on laptops and phones
   - movement uses the real time between frames and eases (no instant start/stop), so it feels fluid
   - getting hit glides you back to a checkpoint instead of teleporting you
*/
import { WORLD, levelConfig, buildLevel, bobOffset } from './levels.js';
import { ROCK_POINTS, LEVEL_POINTS, FOOD_POINTS } from './scoring.js';
import * as input from './input.js';
import { emit } from './events.js';
import * as art from './art.js';
import { rng } from './rng.js';

const { W, H, TOP, BOTTOM, FISH_X } = WORLD;
const K = 2;                        // pre-rendered sprites are 2x the logical size (crisp on hi-dpi)
const FISH_SCALE = 0.62;            // art units -> pixels
const LOOP = 1920;                  // the reef strips repeat every 1920px
const SAND = { far: H - 96, mid: H - 70, near: H - 52, front: H - 36 };

// three circles that follow the fish's body; what the rocks are tested against
const HITBOX = [{ dx: 15, dy: 0, r: 12 }, { dx: -3, dy: 1, r: 14 }, { dx: -21, dy: 0, r: 9 }];

let canvas, ctx, raf = 0, last = 0, lastPct = -1, lastLives = -1, lastScore = -1, scale = 1;
let sp = null;                      // sprites, once baked
let readyResolve, readyReject;
/** Resolves when the artwork is baked and the game can start (about 100 ms). */
export const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });

const s = {
  level: 1, banked: 0, lives: 3, levelScore: 0, worldX: 0, y: 260, vy: 0,
  cfg: null, cols: [], rocks: [], food: [], colBob: [], speed: 200,
  safe: { worldX: 0, y: 260 }, inv: 0, running: false, paused: true,
  clock: 0, shake: 0, flash: 0, hitstop: 0, rewind: null, finishing: 0, gulp: 0, banner: 0,
  particles: [], floaters: [], bubbles: [], motes: [], trail: 0, tail: 0, finBeat: 0,
};

/* ═══════════════ setup ═══════════════ */
export function init(c) {
  canvas = c;
  ctx = c.getContext('2d');
  input.initCanvasTouch(c, H);
  new ResizeObserver(resize).observe(c);
  resize();
  const R = rng(5);
  s.bubbles = Array.from({ length: 16 }, () => ({ x: R() * W, y: R() * H, r: 2 + R() * 4.5, v: 18 + R() * 26, ph: R() * 6.28, ws: 1.2 + R() * 1.6, a: .3 + R() * .25 }));
  s.motes = Array.from({ length: 46 }, () => ({ x: R() * W, y: 40 + R() * (H - 120), z: .25 + R() * .7, r: .8 + R() * 1.4 }));
  bake().then(readyResolve).catch(err => { console.error('Could not prepare artwork', err); readyReject(err); });
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth;
  if (!cssW) return;
  const w = Math.round(cssW * dpr);
  if (canvas.width !== w) { canvas.width = w; canvas.height = Math.round(w * H / W); }
  scale = canvas.width / W;
}

/* ═══════════════ pre-rendering (runs once, ~100 ms) ═══════════════ */
const make = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * K); c.height = Math.ceil(h * K); const g = c.getContext('2d'); g.scale(K, K); return [c, g]; };

async function bake() {
  const FW = 224 * FISH_SCALE;
  const C = art.CORALS;
  const [tail, body, fin, fishAll, pellets, brA, brB, brC, fanA, fanB, brainA, brainB, tubeA, tubeB, anA, anB, kelpA, kelpB, star, shell] = await Promise.all([
    art.rasterize(art.fishTail('ft'), FW, K), art.rasterize(art.fishBody('fb'), FW, K), art.rasterize(art.fishFin('fp'), FW, K),
    art.rasterize(art.fishStatic('fa'), 64, K), art.rasterize(art.foodPellets('fd'), 38, K * 1.5),
    ...['coral-branch-a', 'coral-branch-b', 'coral-branch-c'].map(k => art.rasterize(C[k], 104, 2.5)),
    ...['coral-fan-a', 'coral-fan-b'].map(k => art.rasterize(C[k], 116, 2.5)),
    ...['coral-brain-a', 'coral-brain-b'].map(k => art.rasterize(C[k], 92, 2.5)),
    ...['coral-tube-a', 'coral-tube-b'].map(k => art.rasterize(C[k], 96, 2.5)),
    ...['coral-anemone-a', 'coral-anemone-b'].map(k => art.rasterize(C[k], 84, 2.5)),
    ...['kelp-a', 'kelp-b'].map(k => art.rasterize(C[k], 50, 2.5)),
    art.rasterize(C.starfish, 26, K), art.rasterize(C.shell, 24, K),
  ]);
  const L = art.SEALIFE;
  const [fo, fy, fp, crabS, horse, jA, jB] = await Promise.all([
    art.rasterize(L['fish-orange'], 40, K), art.rasterize(L['fish-yellow'], 38, K), art.rasterize(L['fish-pink'], 34, K),
    art.rasterize(L.crab, 42, K), art.rasterize(L.seahorse, 24, K),
    art.rasterize(L['jelly-a'], 36, K), art.rasterize(L['jelly-b'], 30, K),
  ]);
  sp = { tail, body, fin, fishAll, pellets, star, shell, life: { fo, fy, fp, crabS, horse, jA, jB }, anemones: [anA, anB], kelp: [kelpA, kelpB] };
  const reef = [brA, brB, brC, fanA, fanB, brainA, brainB, tubeA, tubeB];

  sp.bg = bakeBackground();
  sp.rays = bakeRays();
  sp.glowFish = bakeGlow(70, 'rgba(190,240,255,.55)', 'rgba(190,240,255,0)');
  sp.glowFood = bakeGlow(26, 'rgba(255,214,90,.75)', 'rgba(255,170,40,0)');
  sp.far = bakeReef({ reef, base: SAND.far, parallax: 'far', scale: [1.35, 1.9], gap: [90, 150], haze: 'rgba(48,160,232,.74)', sand: ['#2a8fb8', '#1f78a6'], seed: 3 });
  sp.mid = bakeReef({ reef, base: SAND.mid, parallax: 'mid', scale: [1.0, 1.35], gap: [110, 190], haze: 'rgba(48,160,232,.36)', sand: ['#4aa6a8', '#35899b'], seed: 8 });
  sp.near = bakeNear(reef);
  sp.front = bakeFront();
  sp.rockSkins = Array.from({ length: 18 }, (_, i) => bakeRock(i));
}

function bakeBackground() {
  const [c, g] = make(W, H);
  const o = g.createLinearGradient(0, 0, 0, H);
  o.addColorStop(0, '#53ccff'); o.addColorStop(.3, '#1f9fe6'); o.addColorStop(.62, '#0b73bb'); o.addColorStop(1, '#073a6d');
  g.fillStyle = o; g.fillRect(0, 0, W, H);
  const top = g.createLinearGradient(0, 0, 0, 90);
  top.addColorStop(0, 'rgba(255,255,255,.32)'); top.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = top; g.fillRect(0, 0, W, 90);
  const v = g.createRadialGradient(W / 2, H * .45, H * .35, W / 2, H * .5, H * 1.05);
  v.addColorStop(0, 'rgba(2,18,48,0)'); v.addColorStop(1, 'rgba(2,18,48,.5)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return c;
}

function bakeRays() {
  const [c, g] = make(W + 200, H);
  [[60, 90, .16], [260, 70, .11], [430, 120, .15], [640, 80, .1], [800, 100, .13]].forEach(([x, w, a]) => {
    const l = g.createLinearGradient(x, 0, x + 120, H);
    l.addColorStop(0, `rgba(255,255,255,${a})`); l.addColorStop(.7, `rgba(255,255,255,${a * .25})`); l.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = l; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + 190, H); g.lineTo(x + 40, H); g.fill();
  });
  return c;
}

function bakeGlow(r, a, b) {
  const [c, g] = make(r * 2, r * 2);
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  return Object.assign(c, { lw: r * 2, lh: r * 2 });
}

/** A wavy sand strip that tiles seamlessly (all sine periods divide LOOP). */
function sandPath(g, base, amp, seed) {
  const R = rng(seed), p1 = R() * 6, p2 = R() * 6;
  g.beginPath(); g.moveTo(0, H + 4);
  for (let x = 0; x <= LOOP; x += 16) {
    const t = x / LOOP * Math.PI * 2;
    g.lineTo(x, base + Math.sin(t * 3 + p1) * amp + Math.sin(t * 7 + p2) * amp * .35);
  }
  g.lineTo(LOOP, H + 4); g.closePath();
}

function placeSprite(g, spr, x, base, sc, alpha = 1) {
  const w = spr.lw * sc, h = spr.lh * sc;
  for (const ox of [0, -LOOP, LOOP]) {          // draw wrapped copies so nothing is cut at the seam
    const px = x + ox - w / 2;
    if (px + w < 0 || px > LOOP) continue;
    g.globalAlpha = alpha; g.drawImage(spr, px, base - h + 3 * sc, w, h);
  }
  g.globalAlpha = 1;
}

function bakeReef({ reef, base, scale: [s0, s1], gap: [g0, g1], haze, sand, seed }) {
  const [c, g] = make(LOOP, 260);
  g.translate(0, -(H - 260));                    // strip covers the bottom 260px of the screen
  const R = rng(seed);
  sandPath(g, base, 7, seed);
  const sg = g.createLinearGradient(0, base - 10, 0, H); sg.addColorStop(0, sand[0]); sg.addColorStop(1, sand[1]);
  g.fillStyle = sg; g.fill();
  for (let x = 40 + R() * 60; x < LOOP - 30; x += g0 + R() * (g1 - g0)) {
    const spr = reef[Math.floor(R() * reef.length)];
    placeSprite(g, spr, x, base + 4, s0 + R() * (s1 - s0));
  }
  g.globalCompositeOperation = 'source-atop';    // paint a haze over everything so it sits "far away"
  g.fillStyle = haze; g.fillRect(0, H - 260, LOOP, 260);
  return c;
}

function bakeNear(reef) {
  const [c, g] = make(LOOP, 260);
  g.translate(0, -(H - 260));
  const R = rng(21), base = SAND.near;
  sandPath(g, base, 8, 21);
  const sg = g.createLinearGradient(0, base - 12, 0, H); sg.addColorStop(0, '#f3d27a'); sg.addColorStop(.5, '#e0a64a'); sg.addColorStop(1, '#b97b2c');
  g.fillStyle = sg; g.fill();
  sp.anchors = [];                               // where the swaying anemones go
  for (let x = 70; x < LOOP - 40; x += 150 + R() * 110) {
    if (R() < .3) { sp.anchors.push({ x, s: .85 + R() * .35, v: Math.floor(R() * 2), ph: R() * 6 }); continue; }
    placeSprite(g, reef[Math.floor(R() * reef.length)], x, base + 6, .72 + R() * .4);
  }
  return c;
}

function bakeFront() {
  const [c, g] = make(LOOP, 120);
  g.translate(0, -(H - 120));
  const R = rng(33), base = SAND.front;
  sandPath(g, base, 6, 33);
  const sg = g.createLinearGradient(0, base - 8, 0, H); sg.addColorStop(0, '#ffe9a4'); sg.addColorStop(.35, '#f2b84f'); sg.addColorStop(1, '#c4842f');
  g.fillStyle = sg; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let x = 30; x < LOOP; x += 110 + R() * 90) {        // sand ripples
    const y = base + 12 + R() * 22; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 6, x + 64, y); g.stroke();
  }
  g.fillStyle = 'rgba(120,70,10,.18)';
  for (let i = 0; i < 90; i++) g.fillRect(R() * LOOP, base + 6 + R() * 50, 1.5, 1.5);   // sand grains
  for (let x = 60; x < LOOP; x += 160 + R() * 160) {
    const sprite = R() < .5 ? sp.star : sp.shell, sc = .8 + R() * .5;
    const w = sprite.lw * sc, h = sprite.lh * sc;
    g.save(); g.translate(x, base + 14 + R() * 16); g.rotate((R() - .5) * 1.2);
    g.drawImage(sprite, -w / 2, -h / 2, w, h); g.restore();
  }
  return c;
}

/** One boulder, baked once. Lit from the upper left; skins add moss, polyps or barnacles. */
function bakeRock(i) {
  const R = rng(i * 77 + 3), skin = i % 3, S = 84, [c, g] = make(S, S);
  const rad = 32, pts = art.rockShape(R, 11);
  g.translate(S / 2, S / 2);
  const path = new Path2D(art.smoothPath(pts, rad * 1.04));
  const fillG = g.createRadialGradient(-rad * .35, -rad * .4, rad * .1, 0, 0, rad * 1.2);
  fillG.addColorStop(0, '#cfdcec'); fillG.addColorStop(.5, '#8aa2bf'); fillG.addColorStop(1, '#4a6285');
  g.fillStyle = fillG; g.fill(path);
  g.save(); g.clip(path);
  pts.forEach((p, n) => {                                  // facets: light from the upper left
    const q = pts[(n + 1) % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, lit = -(mx * .6 + my * .8) / Math.hypot(mx, my);
    g.fillStyle = lit > 0 ? `rgba(255,255,255,${(lit * .24).toFixed(2)})` : `rgba(6,18,38,${(-lit * .26).toFixed(2)})`;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(p[0] * rad * 1.1, p[1] * rad * 1.1); g.lineTo(q[0] * rad * 1.1, q[1] * rad * 1.1); g.fill();
  });
  g.strokeStyle = 'rgba(8,20,40,.35)'; g.lineWidth = 1.6; g.lineCap = 'round';
  for (let n = 0; n < 2; n++) {                            // cracks
    const x = (R() - .5) * 30, y = (R() - .5) * 30;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8 + R() * 8, y + 4, x + 6 + R() * 12, y + 14 + R() * 8); g.stroke();
  }
  if (skin === 0) {                                        // moss cap
    g.fillStyle = 'rgba(74,222,128,.85)';
    for (let n = 0; n < 5; n++) { g.beginPath(); g.ellipse(-14 + n * 8 + R() * 4, -rad * .72 + R() * 5, 7 + R() * 4, 3.5 + R() * 2, (R() - .5) * .6, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(21,128,61,.6)'; g.beginPath(); g.ellipse(-4, -rad * .64, 16, 3.5, 0, 0, 7); g.fill();
  } else if (skin === 1) {                                 // coral polyps
    const hue = R() < .5 ? 340 : 22;
    for (let n = 0; n < 7; n++) {
      const x = -6 + R() * 22, y = 6 + R() * 18;
      g.fillStyle = `hsl(${hue} 85% 62%)`; g.beginPath(); g.arc(x, y, 3 + R() * 1.6, 0, 7); g.fill();
      g.fillStyle = `hsl(${hue + 20} 95% 85%)`; g.beginPath(); g.arc(x - .8, y - .8, 1.2, 0, 7); g.fill();
    }
  } else {                                                 // barnacles
    g.fillStyle = 'rgba(253,246,214,.85)'; g.strokeStyle = 'rgba(80,70,50,.5)'; g.lineWidth = 1;
    for (let n = 0; n < 8; n++) { const x = (R() - .5) * 36, y = (R() - .2) * 30; g.beginPath(); g.arc(x, y, 2 + R() * 1.6, 0, 7); g.fill(); g.stroke(); }
  }
  const shade = g.createRadialGradient(rad * .3, rad * .4, rad * .3, rad * .3, rad * .4, rad * 1.3);   // bottom-right darkening for volume
  shade.addColorStop(0, 'rgba(4,14,34,0)'); shade.addColorStop(1, 'rgba(4,14,34,.34)');
  g.fillStyle = shade; g.fillRect(-S, -S, S * 2, S * 2);
  g.restore();
  g.strokeStyle = 'rgba(16,28,48,.9)'; g.lineWidth = 2.4; g.lineJoin = 'round'; g.stroke(path);
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.6; g.save(); g.clip(path); g.translate(1.8, 2); g.stroke(path); g.restore();
  return Object.assign(c, { lw: S, lh: S });
}

/* ═══════════════ public controls ═══════════════ */
export async function startLevel(level, banked, startScore = 0) {
  if (!sp) await ready;
  resize();
  const cfg = levelConfig(level), lv = buildLevel(level);
  Object.assign(s, {
    level, banked, lives: 3, levelScore: startScore, worldX: 0, y: (TOP + BOTTOM) / 2, vy: 0, cfg,
    cols: lv.cols, rocks: lv.rocks, food: lv.food, colBob: lv.cols.map(() => 0), speed: cfg.speed,
    inv: 0, running: true, paused: false, clock: 0, shake: 0, flash: 0, hitstop: 0, rewind: null,
    finishing: 0, gulp: 0, banner: 2.4, particles: [], floaters: [], trail: 0, tail: 0,
  });
  s.safe = { worldX: 0, y: s.y };
  last = performance.now();
  lastPct = lastLives = lastScore = -1;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
  hud(true);
}

export const pause  = () => { s.paused = true; };
export const resume = () => { if (s.running) { s.paused = false; last = performance.now(); } };
export const stop   = () => { s.running = false; cancelAnimationFrame(raf); };
export const getState = () => ({
  running: s.running, level: s.level, levelScore: s.levelScore, lives: s.lives, total: s.banked + s.levelScore,
});
/** For automated tests only. */
export const _debug = () => s;

function hud(force) {
  const pct = Math.min(100, Math.round(((s.worldX + FISH_X) / s.cfg.length) * 100));
  const score = s.banked + s.levelScore;
  if (force || pct !== lastPct || s.lives !== lastLives || score !== lastScore) {
    lastPct = pct; lastLives = s.lives; lastScore = score;
    emit('hud', { level: s.level, pct, lives: s.lives, score });
  }
}

/* ═══════════════ the loop ═══════════════ */
function loop(t) {
  if (!s.running) return;
  const dt = Math.max(0, Math.min((t - last) / 1000, 0.1));
  last = t;
  if (!s.paused) {
    let left = dt;                                 // long frames are split so fast fish can't skip through a rock
    while (left > 0 && s.running && !s.paused) { const d = Math.min(left, 1 / 60); update(d); left -= d; }
  }
  if (s.running) { draw(); raf = requestAnimationFrame(loop); }
}

const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function update(dt) {
  s.clock += dt;
  const cfg = s.cfg;
  for (const c of s.cols) s.colBob[c.id] = bobOffset(c, s.clock);

  tickEffects(dt);
  if (s.hitstop > 0) { s.hitstop -= dt; if (s.hitstop <= 0) beginRewind(); return; }

  // ── steering: ease toward the wanted speed, so the fish glides instead of snapping ──
  if (s.rewind) { runRewind(dt); return; }
  const aim = input.pointerTarget();
  let want = 0;
  if (aim !== null) want = Math.max(-cfg.swim, Math.min(cfg.swim, (aim - s.y) * 9));
  else want = ((input.down() ? 1 : 0) - (input.up() ? 1 : 0)) * cfg.swim;
  s.vy += (want - s.vy) * (1 - Math.exp(-dt / 0.055));
  s.y += s.vy * dt;
  if (s.y < TOP) { s.y = TOP; s.vy = Math.max(0, s.vy); }
  if (s.y > BOTTOM) { s.y = BOTTOM; s.vy = Math.min(0, s.vy); }

  const run = s.finishing ? Math.max(.25, 1 - s.finishing * 1.2) : 1;      // ease the world to a stop after the line
  s.worldX += s.speed * run * dt;
  if (s.inv > 0) s.inv -= dt;

  const fx = s.worldX + FISH_X;
  eatFood(dt, fx);
  if (!s.finishing) {
    passColumns(fx);
    if (s.inv <= 0 && collides(fx)) return loseLife();
    if (fx >= cfg.length) startFinish();
  } else {
    s.finishing += dt;
    if (s.finishing > .95) finish();
  }
  hud(false);
}

function tickEffects(dt) {
  if (s.shake > 0) s.shake -= dt;
  if (s.flash > 0) s.flash -= dt;
  if (s.gulp > 0) s.gulp -= dt;
  if (s.banner > 0) s.banner -= dt;
  const moving = Math.abs(s.vy) / s.cfg.swim;
  s.tail += dt * (9 + moving * 9 + (s.level - 1) * .6);
  s.finBeat += dt * (6 + moving * 8);

  for (const fl of s.floaters) { fl.y += fl.vy * dt; fl.life -= dt * 1.2; }
  s.floaters = s.floaters.filter(f => f.life > 0);
  for (const p of s.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.life -= p.decay * dt; }
  s.particles = s.particles.filter(p => p.life > 0);

  for (const b of s.bubbles) {                       // ambient bubbles rise at a steady real-time speed
    b.y -= b.v * dt;
    if (b.y < -12) { b.y = H + 12; b.x = Math.random() * W; }
  }
  s.trail += dt;                                     // a bubble from the fish's mouth now and then
  if (s.trail > .5 && !s.rewind) {
    s.trail = 0;
    s.particles.push({ x: FISH_X + 46, y: s.y - 2, vx: -s.speed * .25, vy: -22 - Math.random() * 14, g: -6, life: 1, decay: .75, r: 1.6 + Math.random() * 2.2, color: 'rgba(255,255,255,.7)', ring: true });
  }
}

function eatFood(dt, fx) {
  for (const f of s.food) {
    if (f.collected) continue;
    const fy = f.col >= 0 ? f.y0 + s.colBob[f.col] : f.y0;
    const dx = fx - f.x, dy = s.y - fy, d = Math.hypot(dx, dy);
    if (d < 85 && f.col < 0) {                       // pellets near the fish drift toward its mouth
      const pull = (1 - d / 85) * 7 * dt; f.x += dx * pull; f.y0 += dy * pull;
    }
    f.y = fy;
    const mouth = Math.hypot(fx + 22 - f.x, s.y - fy);
    if (d < f.r + 16 || mouth < f.r + 14) {
      f.collected = true; s.gulp = .2;
      burst(f.x - s.worldX, fy, '#fde047', '#fb923c', 14, 100);
      float(FISH_X + 24, s.y - 22, '+' + FOOD_POINTS, '#fde047');
      s.levelScore += FOOD_POINTS;
      hud(true);
      emit('food-collected', { score: s.banked + s.levelScore });
    }
  }
}

function passColumns(fx) {
  for (const c of s.cols) {
    if (!c.passed && fx - 30 > c.x + c.half + 38) {
      c.passed = true;
      s.levelScore += ROCK_POINTS;
      s.safe = { worldX: s.worldX, y: Math.max(TOP, Math.min(BOTTOM, s.y)) };
      float(FISH_X + 20, s.y - 20, '+' + ROCK_POINTS, '#7dd3fc');
      hud(true);
    }
  }
}

function collides(fx) {
  for (const r of s.rocks) {
    const dx = r.x - fx;
    if (dx > 60 || dx < -60) continue;
    const ry = r.y0 + s.colBob[r.col];
    for (const c of HITBOX) {
      const ddx = r.x - (fx + c.dx), ddy = ry - (s.y + c.dy), reach = r.hit + c.r;
      if (ddx * ddx + ddy * ddy < reach * reach) return true;
    }
  }
  return false;
}

/* ── getting hit: a quick freeze, then a smooth glide back to the last checkpoint ── */
function loseLife() {
  s.lives--; s.shake = .4; s.flash = .3; s.hitstop = .09; s.vy = 0;
  burst(FISH_X, s.y, '#ef4444', '#f97316', 14, 130);
  emit('life-lost', { lives: s.lives });
  hud(true);
  if (s.lives <= 0) { s.hitstop = 0; s.paused = true; emit('out-of-lives', getState()); }
}

function beginRewind() {
  s.rewind = { t: 0, dur: .65, fx: s.worldX, tx: s.safe.worldX, fy: s.y, ty: s.safe.y };
}

function runRewind(dt) {
  const r = s.rewind; r.t += dt;
  const k = ease(Math.min(1, r.t / r.dur));
  s.worldX = r.fx + (r.tx - r.fx) * k;
  s.y = r.fy + (r.ty - r.fy) * k;
  if (r.t >= r.dur) { s.rewind = null; s.inv = 1.6; s.vy = 0; }
  hud(false);
}

function startFinish() {
  s.finishing = .001;
  for (let i = 0; i < 40; i++) burst(FISH_X + 40, s.y, ['#fde047', '#7dd3fc', '#f9a8d4', '#86efac'][i % 4], '#ffffff', 1, 220);
}

function finish() {
  s.levelScore += LEVEL_POINTS;
  hud(true);
  stop();
  emit('level-complete', { level: s.level, levelScore: s.levelScore });
}

function burst(x, y, c1, c2, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = spd * (.35 + Math.random() * .65);
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 90, life: 1, decay: 1.4 + Math.random() * .9, r: 2.2 + Math.random() * 3.2, color: Math.random() > .5 ? c1 : c2 });
  }
}
const float = (x, y, text, color) => s.floaters.push({ x, y, text, color, life: 1, vy: -48 });

/* ═══════════════ drawing ═══════════════ */
function strip(img, parallax, y) {
  const x = -(((s.worldX * parallax) % LOOP + LOOP) % LOOP);        // 0 .. -LOOP; the strip is drawn twice so it always fills the screen
  ctx.drawImage(img, x, y, LOOP, img.height / K);
  ctx.drawImage(img, x + LOOP, y, LOOP, img.height / K);
}

function draw() {
  if (!sp || !ctx) return;
  const t = s.clock;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  if (s.shake > 0) { const m = s.shake * 14; ctx.translate((Math.random() - .5) * m, (Math.random() - .5) * m); }

  ctx.drawImage(sp.bg, 0, 0, W, H);
  ctx.globalAlpha = .9; ctx.drawImage(sp.rays, Math.sin(t * .17) * 55 - 40, 0, W + 200, H); ctx.globalAlpha = 1;

  drawSchool(t);
  strip(sp.far, .22, H - 260);
  drawMotes();
  drawKelp(t);
  strip(sp.mid, .5, H - 260);
  drawSeaLife(t);                                  // decoration only: faded, behind rocks and player
  drawBubbles(t);
  strip(sp.near, 1, H - 260);
  drawAnemones(t);
  drawFinish();
  drawFood(t);
  drawRocks();
  strip(sp.front, 1, H - 120);                     // front sand hides the bottoms of the rocks

  drawParticles();
  drawFish(t);
  drawFloaters();
  drawBanner();

  if (s.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${Math.min(.3, s.flash)})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

function drawSchool(t) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const x = ((i * 190 - s.worldX * .12 + t * 18) % (W + 160) + (W + 160)) % (W + 160) - 80;
    const y = 120 + ((i * 53) % 150) + Math.sin(t * 1.2 + i) * 9, sc = .5 + (i % 3) * .1;
    ctx.globalAlpha = .38;
    const w = sp.fishAll.lw * sc, h = sp.fishAll.lh * sc;
    ctx.drawImage(sp.fishAll, x - w / 2, y - h / 2, w, h);
  }
  ctx.restore();
}

/* Faded decorative sea life. Drawn well behind the rocks and the player, low opacity, no collisions. */
function drawSeaLife(t) {
  const L = sp.life, wx = s.worldX;
  const wrap = (v, span) => ((v % span) + span) % span;
  ctx.save();
  // little reef fish drifting in both directions
  [[L.fo, 0, 150, .5, 22, 1], [L.fy, 1, 230, .45, 14, -1], [L.fp, 2, 90, .42, 30, 1], [L.fo, 3, 330, .4, 18, -1], [L.fy, 4, 280, .38, 26, 1]].forEach(([img, i, y0, a, sp_, dir]) => {
    const span = W + 200, x = wrap(i * 260 + dir * t * sp_ - wx * .2, span) - 100;
    const y = y0 + Math.sin(t * .9 + i * 2) * 8, w = img.lw, h = img.lh;
    ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); if (dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
  });
  // jellyfish pulsing slowly
  [[L.jA, 0, 130, .42], [L.jB, 1, 300, .34]].forEach(([img, i, y0, a]) => {
    const x = wrap(i * 520 + 180 - wx * .16, W + 160) - 80;
    const pulse = 1 + Math.sin(t * 2 + i * 3) * .06, y = y0 + Math.sin(t * .6 + i * 4) * 22;
    ctx.globalAlpha = a; ctx.save(); ctx.translate(x, y); ctx.scale(1 / pulse, pulse);
    ctx.drawImage(img, -img.lw / 2, -img.lh / 2, img.lw, img.lh); ctx.restore();
  });
  // seahorse bobbing near the reef
  { const x = wrap(640 - wx * .3, W + 160) - 80, y = SAND.mid - 78 + Math.sin(t * 1.3) * 6;
    ctx.globalAlpha = .5; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.1) * .08);
    ctx.drawImage(L.horse, -L.horse.lw / 2, -L.horse.lh / 2, L.horse.lw, L.horse.lh); ctx.restore(); }
  // crabs sidling along the sand
  [[0, 300], [1, 980]].forEach(([i, x0]) => {
    const x = wrap(x0 + Math.sin(t * .35 + i * 2) * 60 - wx * .5, LOOP) - 60;
    if (x > W + 40) return;
    const y = SAND.mid + 6 + Math.abs(Math.sin(t * 5 + i)) * 1.5;
    ctx.globalAlpha = .6; ctx.drawImage(L.crabS, x - L.crabS.lw / 2, y - L.crabS.lh, L.crabS.lw, L.crabS.lh);
  });
  ctx.restore();
}

function drawMotes() {
  ctx.fillStyle = 'rgba(220,245,255,.5)';
  for (const m of s.motes) {
    const x = (((m.x - s.worldX * m.z * .8) % W) + W) % W;
    ctx.globalAlpha = .25 + m.z * .4;
    ctx.fillRect(x, m.y + Math.sin(s.clock * .8 + m.x) * 4, m.r, m.r);
  }
  ctx.globalAlpha = 1;
}

function drawKelp(t) {
  for (let i = 0; i < 9; i++) {
    const spr = sp.kelp[i % 2], x = ((i * 230 - s.worldX * .4) % (LOOP) + LOOP) % LOOP - 60;
    if (x > W + 60) continue;
    const sc = .85 + (i % 3) * .2, w = spr.lw * sc, h = spr.lh * sc, base = SAND.mid + 8;
    ctx.save(); ctx.translate(x, base);
    ctx.transform(1, 0, Math.sin(t * 1.5 + i * 1.3) * .07, 1, 0, 0);
    ctx.globalAlpha = .75; ctx.drawImage(spr, -w / 2, -h, w, h); ctx.restore();
  }
}

function drawBubbles(t) {
  for (const b of s.bubbles) {
    const x = (((b.x + Math.sin(t * b.ws + b.ph) * 6 - s.worldX * .15) % W) + W) % W;
    ctx.fillStyle = `rgba(255,255,255,${b.a * .35})`; ctx.strokeStyle = `rgba(255,255,255,${b.a * .85})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${b.a * 1.3})`; ctx.beginPath(); ctx.arc(x - b.r * .35, b.y - b.r * .35, b.r * .26, 0, 7); ctx.fill();
  }
}

function drawAnemones(t) {
  const x0 = (s.worldX % LOOP + LOOP) % LOOP;
  for (const a of sp.anchors) {
    for (const off of [0, LOOP]) {
      const x = a.x + off - x0;
      if (x < -80 || x > W + 80) continue;
      const spr = sp.anemones[a.v], w = spr.lw * a.s, h = spr.lh * a.s;
      ctx.save(); ctx.translate(x, SAND.near + 6);
      ctx.rotate(Math.sin(t * 1.4 + a.ph) * .05); ctx.scale(1, 1 + Math.sin(t * 2.2 + a.ph) * .035);
      ctx.drawImage(spr, -w / 2, -h, w, h); ctx.restore();
    }
  }
}

function drawFinish() {
  const x = s.cfg.length - s.worldX;
  if (x > W + 60) return;
  const g = ctx.createLinearGradient(x - 70, 0, x + 40, 0);
  g.addColorStop(0, 'rgba(253,224,71,0)'); g.addColorStop(.7, 'rgba(253,224,71,.28)'); g.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 70, 0, 110, H);
  for (let r = 0; r < 24; r++) for (let c = 0; c < 2; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#ffffff' : '#12233f'; ctx.fillRect(x + c * 14, r * 20, 14, 20);
  }
  ctx.fillStyle = '#f59e0b'; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - 34, 26, 96, 30, 10); else ctx.rect(x - 34, 26, 96, 30);
  ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '700 17px Fredoka, "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FINISH', x + 14, 47);
}

function drawFood(t) {
  const sp_ = sp.pellets;
  for (const f of s.food) {
    if (f.collected) continue;
    const x = f.x - s.worldX;
    if (x < -40 || x > W + 40) continue;
    const y = (f.col >= 0 ? f.y0 + s.colBob[f.col] : f.y0) + Math.sin(t * 3.2 + f.x * .05) * 3;
    const pulse = 1 + Math.sin(t * 4 + f.x) * .08;
    ctx.globalAlpha = .85; ctx.drawImage(sp.glowFood, x - 26 * pulse, y - 26 * pulse, 52 * pulse, 52 * pulse); ctx.globalAlpha = 1;
    ctx.drawImage(sp_, x - sp_.lw / 2, y - sp_.lh / 2, sp_.lw, sp_.lh);
  }
}

function drawRocks() {
  for (const r of s.rocks) {
    const x = r.x - s.worldX;
    if (x < -50 || x > W + 50) continue;
    const spr = sp.rockSkins[r.variant % 18], k = r.r / 33, size = spr.lw * k;
    const y = r.y0 + s.colBob[r.col];
    if (r.flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(spr, -size / 2, -size / 2, size, size); ctx.restore(); }
    else ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
  }
}

function drawParticles() {
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * Math.max(.2, p.life), 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

function drawFish(t) {
  const tilt = Math.max(-1, Math.min(1, s.vy / s.cfg.swim)) * .3;
  const gulp = s.gulp > 0 ? 1 + Math.sin((1 - s.gulp / .2) * Math.PI) * .1 : 1;
  const wag = Math.sin(s.tail) * (.2 + Math.abs(s.vy) / s.cfg.swim * .12);
  const flap = Math.sin(s.finBeat) * .35 - .1;
  const bob = Math.sin(t * 2.4) * 1.6;
  const k = FISH_SCALE, fj = art.FISH_FIN_JOINT, tj = art.FISH_TAIL_JOINT;

  ctx.save();
  ctx.translate(FISH_X, s.y + bob); ctx.rotate(tilt); ctx.scale(gulp, gulp);
  if (s.inv > 0 && Math.floor(performance.now() / 90) % 2) ctx.globalAlpha = .4;

  ctx.drawImage(sp.glowFish, -70, -70, 140, 140);                   // soft light so the fish pops from the water
  const put = spr => ctx.drawImage(spr, spr.vb[0] * spr.scale, spr.vb[1] * spr.scale, spr.lw, spr.lh);
  ctx.save(); ctx.translate(tj.x * k, tj.y * k); ctx.rotate(wag); ctx.translate(-tj.x * k, -tj.y * k); put(sp.tail); ctx.restore();
  put(sp.body);
  ctx.save(); ctx.translate(fj.x * k, fj.y * k); ctx.rotate(flap); ctx.translate(-fj.x * k, -fj.y * k); put(sp.fin); ctx.restore();
  ctx.restore();
}

function drawFloaters() {
  ctx.textAlign = 'center'; ctx.font = '700 22px Fredoka, "Trebuchet MS", sans-serif';
  for (const f of s.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4));
    ctx.fillStyle = 'rgba(8,30,70,.75)'; ctx.fillText(f.text, f.x + 1.5, f.y + 1.5);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawBanner() {
  const hint = s.cfg.bob && s.level === 4 ? 'The gaps start to drift!' : s.level === 1 ? 'Swim through the gaps, grab the food' : s.level === 10 ? 'The final stretch!' : '';
  if (s.banner > 0) {
    const a = Math.min(1, s.banner * 1.5, (2.4 - s.banner) * 4);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
    ctx.font = '700 58px Fredoka, "Trebuchet MS", sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(8,30,70,.55)'; ctx.strokeText(`Level ${s.level}`, W / 2, 190);
    ctx.fillStyle = '#fde047'; ctx.fillText(`Level ${s.level}`, W / 2, 190);
    if (hint) { ctx.font = '600 22px Fredoka, "Trebuchet MS", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(hint, W / 2, 226); }
    ctx.restore();
  }
  if (s.finishing) {
    ctx.save(); ctx.globalAlpha = Math.min(1, s.finishing * 4); ctx.textAlign = 'center';
    ctx.font = '700 64px Fredoka, "Trebuchet MS", sans-serif'; ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(8,30,70,.55)';
    ctx.strokeText('Level clear!', W / 2, 250); ctx.fillStyle = '#fde047'; ctx.fillText('Level clear!', W / 2, 250);
    ctx.restore();
  }
}
