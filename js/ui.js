import { TOTAL_LEVELS } from './levels.js';
import { SYMBOLS } from './art.js';

export const $ = s => document.querySelector(s);
export const show = id => document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === id));
export const setText = (sel, t) => { $(sel).textContent = t; };

export function hearts(sel, n) {
  $(sel).innerHTML = Array.from({ length: 3 }, (_, i) =>
    `<svg class="${i < n ? '' : 'off'}"><use href="#heart"/></svg>`).join('');
}

export function renderHud({ level, pct, lives, score }) {
  setText('#hud-level', `Level ${level}/${TOTAL_LEVELS}`);
  $('#hud-bar').style.width = pct + '%';
  setText('#hud-pct', pct + '%');
  hearts('#hud-hearts', lives);
  setText('#hud-score', 'Score: ' + score.toLocaleString());
}

export function renderMenu(user, p) {
  setText('#m-welcome', `Welcome, ${user.username}!`);
  setText('#m-level', `${p.current_level}/${TOTAL_LEVELS}`);
  setText('#m-best', p.highest_score.toLocaleString());
  setText('#m-games', p.games_played);
  setText('#a-lvl', `${p.current_level}/${TOTAL_LEVELS}`);
  setText('#a-best', p.highest_score.toLocaleString());
  setText('#a-games', p.games_played);
  document.querySelectorAll('.nav-user-name').forEach(el => { el.textContent = user.username; });
  document.querySelectorAll('.nav-user .av').forEach(el => { el.textContent = initial(user.username); });
}

const AV_COLORS = [['#38bdf8', '#0284c7'], ['#a78bfa', '#6d28d9'], ['#fb7185', '#e11d48'], ['#34d399', '#059669'], ['#fbbf24', '#d97706'], ['#22d3ee', '#0e7490']];
const initial = n => (String(n || '?').trim()[0] || '?').toUpperCase();
function avatar(name) {
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = AV_COLORS[h % AV_COLORS.length];
  return `<i class="av" style="background:linear-gradient(135deg,${a},${b})">${escHtml(initial(name))}</i>`;
}

export function renderGlobalLeaderboard(rows, totalPlayers, currentUserId) {
  const tbody = $('#glb-body');
  const totalEl = $('#glb-total');
  const podium = $('#glb-podium');
  if (totalEl) totalEl.textContent = `${totalPlayers} registered player${totalPlayers !== 1 ? 's' : ''}`;

  if (!rows || rows.length === 0) {
    if (podium) podium.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="4" class="lab" style="padding:24px">No scores yet. Be the first to play!</td></tr>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  if (podium) podium.innerHTML = rows.slice(0, 3).map((r, i) => `<div class="pod p${i + 1} ${r.user_id === currentUserId ? 'me' : ''}">
      <span class="medal">${medals[i]}</span>${avatar(r.username)}
      <div class="nm">${escHtml(r.username)}</div>
      <div class="sc">⭐ ${Number(r.highest_score).toLocaleString()}</div>
      <div class="lv">Level ${r.highest_level}/${TOTAL_LEVELS}</div></div>`).join('');

  tbody.innerHTML = rows.map((r, i) => {
    const rank = i + 1;
    const isMe = r.user_id === currentUserId;
    const medal = rank <= 3 ? medals[rank - 1] : '';
    const topCls = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '';
    const meCls = isMe ? 'rank-me' : '';
    return `<tr class="${topCls} ${meCls}">
      <td><span class="rank-num">${medal || rank}</span></td>
      <td><span class="who">${avatar(r.username)}<span class="lb-username">${escHtml(r.username)}${isMe ? ' <span class="you-badge">YOU</span>' : ''}</span></span></td>
      <td>⭐ ${Number(r.highest_score).toLocaleString()}</td>
      <td>Lvl ${r.highest_level}/${TOTAL_LEVELS}</td>
    </tr>`;
  }).join('');
}

export function renderPersonalLeaderboard(p, runs) {
  setText('#lb-best', p.highest_score.toLocaleString());
  setText('#lb-level', `${p.highest_level}/${TOTAL_LEVELS}`);
  setText('#lb-games', p.games_played);

  const newest = runs.reduce((a, r) => (!a || new Date(r.played_at) > new Date(a.played_at) ? r : a), null);
  $('#lb-body').innerHTML = runs.length ? runs.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${new Date(r.played_at).toLocaleDateString()}${i === 0 && r === newest ? '<span class="badge">NEW BEST</span>' : ''}</td>
    <td>Level ${r.level_reached}/${TOTAL_LEVELS}<span class="mini"><i style="width:${(r.level_reached / TOTAL_LEVELS) * 100}%"></i></span></td>
    <td>⭐ ${r.score.toLocaleString()}</td>
  </tr>`).join('')
  : '<tr><td colspan="4" class="lab" style="padding:24px">No personal runs recorded yet. Complete a game to see your history!</td></tr>';
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── The coral reef along the bottom of every menu screen ─────────────────── */
const ratio = id => { const v = SYMBOLS[id].viewBox; return v[3] / v[2]; };
// one sprite: id, which side + % from that side, width (px at full size), height above the floor (px), extra classes
const piece = (id, side, pct, w, b, cls = '', delay = 0) =>
  `<svg class="c ${cls}" style="${side}:${pct}%;--w:${w};--h:${Math.round(w * ratio(id))};--b:${b};animation-delay:-${delay}s" aria-hidden="true"><use href="#${id}"/></svg>`;

const REEF_BACK = [   // hazy, far away
  ['coral-fan-b', 'left', 4, 170, 74], ['coral-branch-c', 'left', 17, 150, 70],
  ['coral-fan-a', 'right', 5, 165, 74], ['coral-branch-b', 'right', 18, 150, 70],
].map(a => piece(...a, 'far')).join('');

const REEF_FRONT = [
  ['kelp-a', 'left', 0.5, 64, 40, 'sway', 0], ['coral-branch-a', 'left', 3.5, 152, 42, '', 0], ['coral-brain-a', 'left', 14, 118, 36, '', 0],
  ['coral-tube-a', 'left', 21, 110, 38, '', 0], ['coral-anemone-a', 'left', 27, 92, 34, 'sway', 2], ['rock', 'left', 18.5, 66, 14, '', 0],
  ['starfish', 'left', 9.5, 34, 12, '', 0], ['shell', 'left', 25, 30, 8, '', 0],
  ['kelp-b', 'right', 0.5, 64, 40, 'sway', 1.4], ['coral-tube-b', 'right', 3.5, 118, 40, '', 0], ['coral-branch-b', 'right', 12, 148, 38, '', 0],
  ['coral-brain-b', 'right', 23, 112, 34, '', 0], ['coral-anemone-b', 'right', 28.5, 90, 32, 'sway', 3], ['rock', 'right', 9, 60, 12, '', 0],
  ['shell', 'right', 19, 30, 10, '', 0], ['starfish', 'right', 26, 30, 7, '', 0],
].map(a => piece(...a)).join('');

const BUBBLES = [[8, 9, 14], [19, 12, 9], [33, 8, 16], [47, 14, 8], [62, 10, 12], [74, 13, 10], [88, 9, 15], [95, 11, 7]]
  .map(([x, d, z], i) => `<i class="bub" style="left:${x}%;--d:${d}s;--z:${z}px;animation-delay:-${i * 1.7}s"></i>`).join('');

const SAND = (cls, d) => `<svg class="sand ${cls}" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">${d}</svg>`;

const ICON_USER = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
const ICON_OUT = '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>';
const BRAND = '<div class="nav-brand"><svg aria-hidden="true"><use href="#fish"/></svg><b>FISH DODGE</b></div>';
function navHtml(active) {
  const tab = (act, label) => `<button data-action="${act}" class="${act === active ? 'on' : ''}">${label}</button>`;
  return `<header class="nav">${BRAND}
    <nav class="nav-tabs">${tab('menu', 'Main Menu')}${tab('play', 'Play')}${tab('leaderboard', 'Leaderboard')}</nav>
    <div class="nav-right"><span class="nav-user"><i class="av">?</i><span class="nav-user-name"></span></span>
      <button class="nav-icon" data-action="account" aria-label="Account" title="Account">${ICON_USER}</button>
      <button class="nav-icon" data-action="logout" aria-label="Log out" title="Log out">${ICON_OUT}</button></div></header>`;
}
const navBack = () => `<header class="nav minimal">${BRAND}<div class="nav-right"><button class="nav-back" data-action="howtoBack">← Back</button></div></header>`;

export function decorate() {
  // top navigation: full bar on home / leaderboard / account, a simple back bar on How to Play
  // (How to Play can be opened from the pause menu, so it only offers "back")
  document.querySelectorAll('.screen[data-nav]').forEach(sc => {
    const k = sc.dataset.nav;
    sc.insertAdjacentHTML('afterbegin', k === 'howto' ? navBack() : navHtml(k === 'account' ? '' : k));
  });

  const deco = '<div class="deco" aria-hidden="true">' +
    `<svg class="swimmer" style="--top:20%;--dur:46s"><use href="#fish"/></svg>` +
    `<svg class="swimmer back" style="--top:46%;--dur:70s;animation-delay:-30s"><use href="#fish"/></svg>` +
    `<svg class="sea jelly" style="left:7%;top:30%;--dur:7s"><use href="#jelly-a"/></svg>` +
    `<svg class="sea jelly" style="right:8%;top:50%;--dur:9s"><use href="#jelly-b"/></svg>` +
    `<svg class="sea horse" style="right:16%;bottom:calc(150px * var(--s))"><use href="#seahorse"/></svg>` +
    `<svg class="sea crab" style="left:38%"><use href="#crab"/></svg>` +
    BUBBLES +
    SAND('back', '<path d="M0 52C180 22 330 62 560 44S930 14 1200 46L1200 120L0 120Z" fill="url(#sandBack)"/>') +
    REEF_BACK +
    SAND('front', '<path d="M0 46C150 18 330 62 540 42S900 8 1200 40L1200 120L0 120Z" fill="url(#sandGrad)"/>' +
      '<path d="M120 70Q230 56 330 70M640 80Q760 64 880 80M960 60Q1040 52 1120 62" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>') +
    REEF_FRONT + '</div>';
  document.querySelectorAll('.screen:not(#game)').forEach(sc => sc.insertAdjacentHTML('beforeend', deco));
}

export function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toast').append(el);
  setTimeout(() => el.remove(), 3500);
}

export function liveHints(inputSel, listSel, rules, watch = []) {
  const inp = $(inputSel), ul = $(listSel);
  const run = () => {
    const v = inp.value;
    ul.innerHTML = rules.map(r => `<li class="${v ? (r.test(v) ? 'good' : 'bad') : ''}">${r.text}</li>`).join('');
    const ok = rules.every(r => r.test(v));
    inp.classList.toggle('valid', !!v && ok);
    inp.classList.toggle('invalid', !!v && !ok);
  };
  [inp, ...watch.map(w => $(w))].forEach(el => el.addEventListener('input', run));
  run();
  return run;
}
