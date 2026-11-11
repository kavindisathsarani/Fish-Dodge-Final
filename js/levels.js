/* levels.js - deterministic level design for the 10 levels. Pure data: no canvas, no DOM.
   THEME: low coupling / high cohesion (game.js only asks "give me level N").

   Difficulty ramps three ways at once as the level number goes up:
     - the world scrolls faster, and the fish swims faster to keep up
     - the gap in each rock column gets narrower
     - columns come closer together, get thicker, and (from level 4) the gaps start to drift up and down
   The generator guarantees every gap can be reached in time, so a level is always beatable.
*/
import { rng } from './rng.js';

export const TOTAL_LEVELS = 10;
export const WORLD = { W: 960, H: 540, TOP: 70, BOTTOM: 445, FISH_X: 170 };

// speed  = how fast the sea scrolls past (px/s)         gap   = clear opening between the rocks (px)
// swim   = how fast the fish can move up/down (px/s)    gapT  = seconds between columns
// thick  = chance a column is 2-3 rocks deep            bob   = how far a gap drifts up/down (px)
const LEVELS = [
  { speed: 215, swim: 330, gap: 118, columns: 7,  gapT: 2.15, thick: 0,   bob: 0  }, // 1  calm intro
  { speed: 233, swim: 345, gap: 110, columns: 9,  gapT: 2.0,  thick: 0.1, bob: 0  }, // 2
  { speed: 252, swim: 360, gap: 103, columns: 11, gapT: 1.9,  thick: 0.25, bob: 0 }, // 3
  { speed: 271, swim: 375, gap: 96,  columns: 13, gapT: 1.8,  thick: 0.3, bob: 10 }, // 4  gaps start to drift
  { speed: 290, swim: 390, gap: 90,  columns: 15, gapT: 1.7,  thick: 0.35, bob: 16 }, // 5
  { speed: 309, swim: 405, gap: 84,  columns: 17, gapT: 1.6,  thick: 0.4, bob: 20 }, // 6
  { speed: 328, swim: 420, gap: 78,  columns: 19, gapT: 1.5,  thick: 0.45, bob: 24 }, // 7
  { speed: 347, swim: 435, gap: 73,  columns: 21, gapT: 1.4,  thick: 0.5, bob: 28 }, // 8
  { speed: 366, swim: 450, gap: 68,  columns: 23, gapT: 1.32, thick: 0.5, bob: 32 }, // 9
  { speed: 385, swim: 465, gap: 64,  columns: 25, gapT: 1.25, thick: 0.55, bob: 36 }, // 10 finale
];

export const ROCK_HIT = 0.9; // collision radius = drawn radius * this (slightly forgiving)
const ROCK_STEP = 1.5;       // rocks in a column overlap so it reads as one solid wall

/** Vertical offset of a column's gap at time t (seconds). Columns with bob = 0 never move. */
export const bobOffset = (col, t) => (col.bob ? col.bob * Math.sin(col.phase + col.rate * t) : 0);

const cache = new Map();

/** Speed, swim speed, gap, level length... for level n (cheap: built once, then cached). */
export const levelConfig = n => {
  const c = LEVELS[Math.max(0, Math.min(TOTAL_LEVELS, n) - 1)];
  if (!cache.has(n)) build(n);
  return { ...c, ...cache.get(n).meta };
};

/** Everything about level n: columns, rocks, food, length. Built once per level, deterministic. */
export function buildLevel(n) {
  if (!cache.has(n)) build(n);
  return freshCopy(cache.get(n));
}

function build(n) {
  const { TOP, BOTTOM, H, FISH_X } = WORLD;
  const L = LEVELS[Math.max(0, Math.min(TOTAL_LEVELS, n) - 1)];
  const rand = rng(n * 9973 + 17);

  const spacing = Math.max(330, L.speed * L.gapT);
  const lead = FISH_X + L.speed * 2.3;             // about 2.3 seconds of calm water before the first column
  const margin = L.bob + 26;
  const lo = TOP + L.gap / 2 + margin, hi = BOTTOM - L.gap / 2 - margin;

  // How far can the fish realistically travel between two columns? Keep 60% of that, so it is always fair.
  const timeBetween = spacing / L.speed;
  const maxDelta = Math.max(70, L.swim * (timeBetween * 0.6 - 0.18));

  const cols = [];
  let gapY = (lo + hi) / 2, x = lead;
  for (let c = 0; c < L.columns; c++) {
    const target = lo + rand() * (hi - lo);
    const dy = Math.max(-maxDelta, Math.min(maxDelta, target - gapY));
    gapY = Math.max(lo, Math.min(hi, gapY + dy));
    const depth = rand() < L.thick ? (L.thick > 0.4 && rand() < 0.4 ? 3 : 2) : 1;
    const half = (depth - 1) * 20;
    cols.push({
      id: c, x, depth, half, gapY, gap: L.gap,
      bob: L.bob ? L.bob * (0.55 + rand() * 0.45) : 0,
      rate: 1.1 + rand() * 0.8, phase: rand() * Math.PI * 2,
    });
    x += spacing;
  }

  // Rocks: a solid wall above and below each gap. Collision circles touch the gap edge exactly.
  const rocks = [];
  for (const col of cols) {
    const colRocks = [];
    for (let k = 0; k < col.depth; k++) {
      const dx = (k - (col.depth - 1) / 2) * 40;
      for (const dir of [-1, 1]) {
        let edge = col.gapY + dir * col.gap / 2;
        const limit = dir < 0 ? -(col.bob + 40) : H - 34 + col.bob;
        let order = 0;
        while (dir < 0 ? edge > limit : edge < limit) {
          const r = 25 + rand() * 9;
          const hit = r * ROCK_HIT;
          colRocks.push({
            col: col.id, x: col.x + dx + (rand() - 0.5) * 12, y0: edge + dir * hit, y: 0, r, hit,
            variant: Math.floor(rand() * 1000), flip: rand() < 0.5, order: order++ + (k ? 0.5 : 0),
          });
          edge += dir * hit * ROCK_STEP * 1.18;
        }
      }
    }
    // far-from-gap rocks first so the rocks lining the gap are drawn on top
    colRocks.sort((a, b) => b.order - a.order);
    rocks.push(...colRocks);
  }

  // Fish food: pellets along the route between gaps, plus a risky one hugging a gap edge now and then.
  const food = [];
  const clampY = y => Math.max(TOP + 14, Math.min(BOTTOM - 14, y));
  for (let c = 0; c < cols.length - 1; c++) {
    const a = cols[c], b = cols[c + 1];
    const x0 = a.x + a.half + 70, x1 = b.x - b.half - 70, mid = (x0 + x1) / 2;
    const ya = a.gapY, yb = b.gapY;
    const yAt = f => ya + (yb - ya) * f;
    if (c % 3 === 1 && L.columns > 7) {
      // a short trail of three pellets, following the path from one gap to the next
      for (let i = 0; i < 3; i++) {
        const f = 0.25 + i * 0.25;
        food.push({ x: x0 + (x1 - x0) * f, y: clampY(yAt(f)), r: 14, collected: false, col: -1 });
      }
    } else {
      food.push({ x: mid, y: clampY(yAt(0.5) + (rand() - 0.5) * 80), r: 14, collected: false, col: -1 });
    }
  }
  for (let c = 2; c < cols.length; c += 3) {
    // risky pellet: tucked against the edge of the gap, tempting you toward the rocks
    const col = cols[c], side = rand() < 0.5 ? -1 : 1;
    food.push({ x: col.x, y: col.gapY + side * (col.gap / 2 - 17), r: 11, collected: false, col: col.id, risky: true });
  }

  const length = x - spacing + L.speed * 1.9 + 260;
  const meta = { length, columns: L.columns, spacing };
  food.forEach(f => { f.y0 = f.y; });
  cache.set(n, { cols, rocks, food, meta });
}

/** The cache stays pristine; each play-through gets its own copy to mark pellets collected etc. */
function freshCopy(lv) {
  return {
    cols: lv.cols.map(c => ({ ...c, passed: false })),
    rocks: lv.rocks.map(r => ({ ...r })),
    food: lv.food.map(f => ({ ...f })),
    meta: lv.meta,
  };
}
