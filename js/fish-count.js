/* fish-count.js - the Fish Count mini-game: loads a challenge, 60s countdown, checks the answer.
   THEME: event-driven programming (button click, Enter key, timer ticks, API response)
   and interoperability (uses api.js). It announces results with 'fc-correct', 'fc-wrong', 'fc-timeout'.
*/
import { fetchChallenge } from './api.js';
import { emit } from './events.js';

const $ = id => document.getElementById(id);
const SECONDS = 60;
let solution = null, left = SECONDS, timer = 0, attempt = 0, ready = false;

export function resetAttempts() { attempt = 0; }
export const setScore = n => { $('fc-score').textContent = 'Score: ' + n; };

/** Load a NEW picture from the API and start the 60-second countdown. */
export async function startChallenge() {
  clearInterval(timer); ready = false; solution = null; left = SECONDS; attempt++;
  $('fc-attempt').textContent = 'Challenge ' + attempt;
  $('fc-img').hidden = true; $('fc-reload').hidden = true;
  $('fc-msg').hidden = false; $('fc-msg').textContent = 'Loading picture…';
  $('fc-input').value = ''; showTime();
  try {
    const c = await fetchChallenge();
    solution = c.solution; $('fc-img').src = c.image;
    $('fc-img').hidden = false; $('fc-msg').hidden = true;
    ready = true; $('fc-input').focus();
    timer = setInterval(tick, 1000);                       // timer event every second
  } catch (e) {
    $('fc-msg').textContent = 'Could not load the picture: ' + e.message; $('fc-reload').hidden = false;
  }
}

const showTime = () => { $('fc-timer').textContent = left + 's'; };
function tick() { left--; showTime(); if (left <= 0) { clearInterval(timer); ready = false; emit('fc-timeout'); } }
function submit() {
  if (!ready) return;
  const v = parseInt($('fc-input').value, 10);
  if (Number.isNaN(v)) return;
  clearInterval(timer); ready = false;
  emit(v === solution ? 'fc-correct' : 'fc-wrong');
}

$('fc-submit').addEventListener('click', submit);
$('fc-input').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
$('fc-reload').addEventListener('click', startChallenge);
