import { injectSprites } from './art.js';
import * as game from './game.js';
import * as fishCount from './fish-count.js';
import * as auth from './auth.js';
import { loadProgress, saveLevelDone, saveRun, loadGlobalLeaderboard } from './progress.js';
import { on } from './events.js';
import { TOTAL_LEVELS } from './levels.js';
import { FISH_POINTS } from './scoring.js';
import { usernameRules, passwordRules, matchRule } from './validation.js';
import {
  $, show, setText, hearts, toast, liveHints,
  renderHud, renderMenu, renderGlobalLeaderboard, renderPersonalLeaderboard, decorate
} from './ui.js';
import './input.js';

injectSprites();   // the fish, corals, hearts... used by every screen (drawn once, from code)

let user = null, banked = 0, nextLevel = 1, howtoFrom = 'menu', runSaved = false;
const gameActive = () => $('#game').classList.contains('active');
const overlay = (id, on_) => $(id).classList.toggle('on', on_);

// Clean SVG eye icons for toggling password visibility
const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_CLOSED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// Initialize all eye toggles with SVG and toggle action
document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.innerHTML = EYE_OPEN;
  btn.addEventListener('click', e => {
    e.preventDefault();
    const target = document.getElementById(btn.dataset.for);
    if (!target) return;
    const isShowing = target.type === 'text';
    target.type = isShowing ? 'password' : 'text';
    btn.innerHTML = isShowing ? EYE_OPEN : EYE_CLOSED;
    btn.setAttribute('aria-label', isShowing ? 'Show password' : 'Hide password');
  });
});

// Developer mode: Shift+D on the menu screen toggles level jump
let devMode = false;
document.addEventListener('keydown', e => {
  if (e.shiftKey && e.key === 'D' && $('#menu').classList.contains('active')) {
    devMode = !devMode;
    const sel = $('#dev-level-select');
    if (sel) sel.style.display = devMode ? 'flex' : 'none';
    toast(devMode ? '🔧 Dev mode ON — jump to any level' : 'Dev mode off');
  }
});

function showGlobalLb() {
  $('#tab-btn-global')?.classList.add('active');
  $('#tab-btn-personal')?.classList.remove('active');
  const gv = $('#lb-view-global');
  const pv = $('#lb-view-personal');
  if (gv) gv.style.display = 'flex';
  if (pv) pv.style.display = 'none';
}

function showPersonalLb() {
  $('#tab-btn-personal')?.classList.add('active');
  $('#tab-btn-global')?.classList.remove('active');
  const gv = $('#lb-view-global');
  const pv = $('#lb-view-personal');
  if (gv) gv.style.display = 'none';
  if (pv) pv.style.display = 'flex';
}

async function goMenu() {
  let p = { current_level: 1, highest_level: 0, highest_score: 0, games_played: 0 };
  try {
    const res = await loadProgress(user);
    if (res?.p) p = res.p;
  } catch (err) {
    console.warn('goMenu progress note:', err);
  }
  renderMenu(user || { username: 'Player' }, p);
  show('menu');
}

async function goLeaderboard() {
  show('leaderboard');
  showGlobalLb();

  // Load and render personal best runs
  try {
    const { p, runs } = await loadProgress(user);
    renderPersonalLeaderboard(p, runs);
  } catch (err) {
    console.error('Personal progress error:', err);
  }

  // Load and render global leaderboard
  $('#glb-body').innerHTML = '<tr><td colspan="4" class="lab" style="padding:24px">Loading rankings…</td></tr>';
  setText('#glb-your-rank', '');
  try {
    const { rows, totalPlayers, userRank } = await loadGlobalLeaderboard(user?.id);
    renderGlobalLeaderboard(rows, totalPlayers, user?.id);
    setText('#glb-your-rank', userRank ? `Your rank: #${userRank} of ${totalPlayers}` : 'Play a game to appear on the leaderboard!');
  } catch (e) {
    $('#glb-body').innerHTML = '<tr><td colspan="4" class="lab" style="color:#ef4444;padding:24px">Could not load global rankings. Check your connection or Supabase settings.</td></tr>';
  }
}

async function startGame(level) {
  overlay('#pause-overlay', false);
  overlay('#ol-overlay', false);
  show('game');
  try {
    await game.startLevel(level, banked, 0);
  } catch (err) {
    console.error(err);
    toast('Could not start the game - please reload the page', 'bad');
  }
}

async function endRun(level) {
  const st = game.getState();
  const total = banked + (st.running ? st.levelScore : 0);
  if (runSaved || total <= 0) return;
  runSaved = true;
  try {
    await saveRun(user, { level, score: total });
  } catch (e) {
    console.error(e);
    toast('Could not save your run', 'bad');
  }
}

async function logoutNow() {
  game.stop();
  await auth.logout();
  user = null;
  $('#l-pass').value = '';
  show('login');
  toast('You have been logged out');
}

function openPwModal() {
  $('#pw-modal').classList.add('on');
  $('#pw-modal-form').reset();
  pwModalHints.forEach(f => f());
  setText('#pm-err', '');
  setText('#pm-ok', '');
}
function closePwModal() {
  $('#pw-modal').classList.remove('on');
}

const actions = {
  goRegister: () => {
    setText('#r-err', '');
    $('#register-form').reset();
    regHints.forEach(f => f());
    show('register');
  },
  goLogin: () => {
    setText('#l-err', '');
    setText('#l-ok', '');
    show('login');
  },
  menu: () => goMenu(),
  leaderboard: () => goLeaderboard(),
  showGlobalLb: () => showGlobalLb(),
  showPersonalLb: () => showPersonalLb(),
  account: () => {
    setText('#a-user', user?.username || 'player');
    $('#a-del').value = '';
    setText('#a-del-err', '');
    show('account');
  },
  openPwModal: () => openPwModal(),
  closePwModal: () => closePwModal(),
  howto: () => { howtoFrom = 'menu'; show('howto'); },
  howtoPause: () => { howtoFrom = 'game'; show('howto'); },
  howtoBack: () => (howtoFrom === 'game' ? show('game') : goMenu()),
  logout: () => logoutNow(),
  play: async () => {
    const { p } = await loadProgress(user);
    banked = 0;
    runSaved = false;
    startGame(p.current_level || 1);
  },
  pause: () => { if (!$('#ol-overlay').classList.contains('on')) togglePause(); },
  resume: () => { overlay('#pause-overlay', false); game.resume(); },
  restart: () => startGame(game.getState().level),
  toMenu: async () => {
    await endRun(game.getState().level);
    game.stop();
    overlay('#pause-overlay', false);
    overlay('#ol-overlay', false);
    await goMenu();
    toast('Back at the main menu');
  },
  quit: async () => {
    await endRun(game.getState().level);
    await logoutNow();
  },
  countfish: () => {
    overlay('#ol-overlay', false);
    fishCount.resetAttempts();
    fishCount.setScore(game.getState().total);
    show('fishcount');
    fishCount.startChallenge();
  },
  tryAgain: () => {
    fishCount.setScore(game.getState().total);
    show('fishcount');
    fishCount.startChallenge();
  },
  restartAfterCorrect: () => {
    overlay('#pause-overlay', false);
    overlay('#ol-overlay', false);
    show('game');
    game.startLevel(game.getState().level, banked, FISH_POINTS).catch(console.error);
  },
  nextLevel: () => startGame(nextLevel),
  playAgain: () => actions.play(),
  devPlay: () => {
    const inp = $('#dev-level-input');
    if (!inp) return;
    const lvl = Math.max(1, Math.min(TOTAL_LEVELS, parseInt(inp.value, 10) || 1));
    banked = 0;
    runSaved = false;
    startGame(lvl);
  },
  deleteAccount: async () => {
    setText('#a-del-err', '');
    if ($('#a-del').value.trim() !== 'DELETE') {
      return setText('#a-del-err', 'Type DELETE (capital letters) to confirm');
    }
    try {
      game.stop();
      await auth.deleteAccount();
      user = null;
      $('#a-del').value = '';
      setText('#l-ok', 'Your account has been deleted.');
      show('login');
      toast('Account deleted', 'good');
    } catch (err) {
      setText('#a-del-err', err.message);
    }
  },
};

document.addEventListener('click', e => {
  const a = e.target.closest('[data-action]');
  if (a) actions[a.dataset.action]?.();
});

function togglePause() {
  if ($('#pause-overlay').classList.contains('on')) return actions.resume();
  game.pause();
  overlay('#pause-overlay', true);
}

// Live validation hints on Register and Password Modal
const regHints = [
  liveHints('#r-user',  '#r-user-h',  usernameRules),
  liveHints('#r-pass',  '#r-pass-h',  passwordRules),
  liveHints('#r-pass2', '#r-pass2-h', matchRule(() => $('#r-pass').value), ['#r-pass']),
];
const pwModalHints = [
  liveHints('#pm-new',  '#pm-new-h',  passwordRules),
  liveHints('#pm-new2', '#pm-new2-h', matchRule(() => $('#pm-new').value), ['#pm-new']),
];

// Login form
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  setText('#l-err', '');
  setText('#l-ok', '');
  const uVal = $('#l-user').value.trim();
  const pVal = $('#l-pass').value;
  if (!uVal) return setText('#l-err', 'Please enter your username');
  if (!pVal) return setText('#l-err', 'Please enter your password');
  try {
    user = await auth.login(uVal, pVal);
    $('#l-pass').value = '';
    await goMenu();
    toast(`Welcome back, ${user.username}!`, 'good');
  } catch (err) {
    setText('#l-err', err.message);
  }
});

// Register form
$('#register-form').addEventListener('submit', async e => {
  e.preventDefault();
  setText('#r-err', '');
  try {
    const name = $('#r-user').value.trim();
    const pw = $('#r-pass').value;
    const pw2 = $('#r-pass2').value;
    user = await auth.register(name, pw, pw2);
    $('#register-form').reset();
    regHints.forEach(f => f());
    await goMenu();
    toast(`Welcome to Fish Dodge, ${user.username}! 🎉`, 'good');
  } catch (err) {
    setText('#r-err', err.message);
  }
});

// Password update modal form
$('#pw-modal-form').addEventListener('submit', async e => {
  e.preventDefault();
  setText('#pm-err', '');
  setText('#pm-ok', '');
  try {
    await auth.changePassword($('#pm-cur').value, $('#pm-new').value, $('#pm-new2').value);
    $('#pw-modal-form').reset();
    pwModalHints.forEach(f => f());
    setText('#pm-ok', 'Password updated successfully!');
    setTimeout(closePwModal, 1800);
    toast('Password updated', 'good');
  } catch (err) {
    setText('#pm-err', err.message);
  }
});

// Game events
on('hud', renderHud);
on('pause-key', () => { if (gameActive() && !$('#ol-overlay').classList.contains('on')) togglePause(); });
on('out-of-lives', () => { hearts('#ol-hearts', 0); overlay('#ol-overlay', true); });
on('level-complete', async ({ level, levelScore }) => {
  banked += levelScore;
  try {
    await saveLevelDone(user, level, level >= TOTAL_LEVELS ? 1 : level + 1);
  } catch (e) {
    console.error(e);
  }
  if (level >= TOTAL_LEVELS) {
    if (!runSaved && banked > 0) {
      runSaved = true;
      try {
        await saveRun(user, { level: TOTAL_LEVELS, score: banked });
      } catch (e) {
        console.error(e);
      }
    }
    setText('#gc-score', '⭐ ' + banked.toLocaleString());
    show('gamecomplete');
  } else {
    nextLevel = level + 1;
    setText('#lc-level', `${level}/${TOTAL_LEVELS}`);
    setText('#lc-score', '⭐ +' + levelScore.toLocaleString());
    show('levelcomplete');
  }
});
on('fc-correct', () => { hearts('#co-hearts', 3); show('correct'); });
on('fc-wrong',   () => { hearts('#in-hearts', 0); show('incorrect'); });
on('fc-timeout', () => { hearts('#to-hearts', 0); show('timeout'); });

// ── Start-up ──────────────────────────────────────────────────────────────
// Show a short loading screen while the artwork is prepared and any saved session is checked.
// The login form only appears once that is settled, so a late "session restored" can never
// yank you to the menu while you are typing your username.
show('splash');
decorate();
game.init($('#canvas'));

const showLogin = () => {
  const name = auth.rememberedUsername();
  if (name && !$('#l-user').value) $('#l-user').value = name;   // convenience only - the password is still required
  show('login');
  (name ? $('#l-pass') : $('#l-user')).focus({ preventScroll: true });
};

Promise.all([
  auth.restoreSession().catch(() => null),
  game.ready.catch(() => null),
  new Promise(r => setTimeout(r, 450)),        // keep the loading screen from flashing
]).then(([u]) => {
  user = u;
  return u ? goMenu() : showLogin();
}).catch(showLogin);

// safety net: never leave a player stuck on the loading screen
setTimeout(() => { if ($('#splash').classList.contains('active')) showLogin(); }, 9000);
