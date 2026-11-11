/* input.js - keyboard, mouse, touch and on-screen buttons for desktop, tablet, and mobile.
   THEME: event-driven programming.

   Two ways to steer, both feed the game the same way:
     - up() / down()      : held keys or on-screen buttons  (the fish swims at full speed)
     - pointerTarget()    : the height the player is pointing at; the fish glides to it
                            (touch or mouse drag on the canvas - no dead zones, no guessing)
*/
import { emit } from './events.js';

const held = new Set();
let target = null;        // logical canvas y (0..540) the pointer is pointing at, or null
let logicalH = 540;

const norm = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
const gameOpen = () => document.getElementById('game')?.classList.contains('active');
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');

addEventListener('keydown', e => {
  const k = norm(e);
  if (!typing(e) && gameOpen() && ['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if ((k === 'Escape' || k === 'p') && !e.repeat && !typing(e)) emit('pause-key');
  if (!typing(e)) held.add(k);
});
addEventListener('keyup', e => held.delete(norm(e)));
// never leave a key "stuck down" when the window loses focus or the tab is hidden
const releaseAll = () => { held.clear(); target = null; };
addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

export const up   = () => held.has('ArrowUp')   || held.has('w') || held.has('btn-up');
export const down = () => held.has('ArrowDown') || held.has('s') || held.has('btn-down');
export const pointerTarget = () => target;
/** Used by touch/mouse steering (and by automated tests). Pass null to let go. */
export const setTarget = y => { target = y; };

// on-screen arrow buttons (shown on touch devices)
function holdButton(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); held.add(key); });
  ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture'].forEach(t => el.addEventListener(t, () => held.delete(key)));
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// drag / touch directly on the water: the fish follows your finger
export function initCanvasTouch(canvas, worldHeight = 540) {
  if (!canvas) return;
  logicalH = worldHeight;
  const aim = e => {
    const r = canvas.getBoundingClientRect();
    target = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) * logicalH;
  };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); aim(e); });
  canvas.addEventListener('pointermove', e => { if (e.buttons > 0 || e.pointerType === 'touch') aim(e); });
  const end = () => { target = null; };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => canvas.addEventListener(t, end));
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

holdButton('btn-up', 'btn-up');
holdButton('btn-down', 'btn-down');
