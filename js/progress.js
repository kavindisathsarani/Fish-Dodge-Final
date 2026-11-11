/* progress.js - saves player progress, highest score and runs per user. THEME: virtual identity.
   Supabase mode: tables player_progress + game_runs (protected by Row Level Security).
   Local mode: localStorage, keyed by the user id. Other files never know which mode is used.
*/
import { sb, useSupabase, ready } from './supabase.js';

const blank = () => ({ current_level: 1, highest_level: 0, highest_score: 0, games_played: 0 });
const lkey = u => 'fd_progress_' + (u?.id || 'guest');
const lread = u => JSON.parse(localStorage.getItem(lkey(u)) || 'null') || { p: blank(), runs: [] };
const top10 = r => [...(r || [])].sort((a, b) => b.score - a.score).slice(0, 10);

export async function loadProgress(u) {
  if (!u) return { p: blank(), runs: [] };
  await ready;
  if (!useSupabase || !sb) {
    const s = lread(u);
    return { p: s.p || blank(), runs: top10(s.runs) };
  }
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Progress timeout')), 2500));
    const query = (async () => {
      let { data: p, error } = await sb.from('player_progress').select('*').eq('user_id', u.id).maybeSingle();
      if (error || !p) {
        p = { ...blank(), user_id: u.id };
        await sb.from('player_progress').upsert(p).catch(() => {});
      }
      const { data: runs } = await sb.from('game_runs').select('*').eq('user_id', u.id).order('score', { ascending: false }).limit(10);
      return { p: p || blank(), runs: runs || [] };
    })();
    return await Promise.race([query, timeout]);
  } catch (err) {
    console.warn('loadProgress fallback to local mode:', err);
    const s = lread(u);
    return { p: s.p || blank(), runs: top10(s.runs) };
  }
}

async function writeProgress(u, p) {
  if (!u) return;
  await ready;
  if (useSupabase && sb) {
    try {
      const { error } = await sb.from('player_progress').upsert({ ...p, user_id: u.id, updated_at: new Date().toISOString() });
      if (error) { console.warn('writeProgress: Supabase rejected the save:', error.message); throw error; }
      return;
    } catch (err) {
      console.warn('writeProgress fallback to local storage:', err);
    }
  }
  const s = lread(u);
  s.p = p;
  localStorage.setItem(lkey(u), JSON.stringify(s));
}

export async function saveLevelDone(u, doneLevel, nextLevel) {
  if (!u) return;
  const { p } = await loadProgress(u);
  p.current_level = nextLevel;
  p.highest_level = Math.max(p.highest_level || 0, doneLevel);
  await writeProgress(u, p);
}

export async function saveRun(u, { level, score }) {
  if (!u) return;
  await ready;
  const { p } = await loadProgress(u);
  p.games_played = (p.games_played || 0) + 1;
  p.highest_score = Math.max(p.highest_score || 0, score);
  if (useSupabase && sb) {
    try {
      const { error } = await sb.from('game_runs').insert({ user_id: u.id, level_reached: level, score });
      if (error) console.warn('saveRun: could not save run to Supabase:', error.message);
    } catch (err) {
      console.warn('saveRun Supabase insert error:', err);
    }
  }
  const s = lread(u);
  s.runs.push({ id: Date.now(), played_at: new Date().toISOString(), level_reached: level, score });
  localStorage.setItem(lkey(u), JSON.stringify(s));
  await writeProgress(u, p);
}

export async function loadGlobalLeaderboard(currentUserId) {
  await ready;
  if (!useSupabase || !sb) {
    return { rows: [], totalPlayers: 0, userRank: null };
  }
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Leaderboard timeout')), 4000));
    const rpcPromise = sb.rpc('get_leaderboard');
    const { data, error } = await Promise.race([rpcPromise, timeout]);
    if (error) throw error;
    const rows = data || [];
    const totalPlayers = rows.length;
    const idx = rows.findIndex(r => r.user_id === currentUserId);
    const userRank = idx >= 0 ? idx + 1 : null;
    return { rows, totalPlayers, userRank };
  } catch (err) {
    console.warn('loadGlobalLeaderboard error:', err);
    throw new Error('Could not load leaderboard');
  }
}

/* Accounts that were created while Supabase was unreachable (or needed email confirmation) kept their scores
   only in this browser, under a local id. When the same player later logs in to Supabase, copy that progress up. */
export async function syncLocalToCloud(u, localKey) {
  await ready;
  if (!useSupabase || !sb || !u || !localKey || localKey === u.id) return;
  const raw = localStorage.getItem('fd_progress_' + localKey);
  if (!raw) return;
  const s = JSON.parse(raw), lp = s.p || blank();
  if (!lp.games_played && !lp.highest_score) return;
  const { data: cp } = await sb.from('player_progress').select('*').eq('user_id', u.id).maybeSingle();
  const c = cp || blank();
  const merged = {
    current_level: Math.max(c.current_level || 1, lp.current_level || 1), highest_level: Math.max(c.highest_level || 0, lp.highest_level || 0),
    highest_score: Math.max(c.highest_score || 0, lp.highest_score || 0), games_played: (c.games_played || 0) + (lp.games_played || 0),
  };
  const { error } = await sb.from('player_progress').upsert({ ...merged, user_id: u.id, updated_at: new Date().toISOString() });
  if (error) { console.warn('syncLocalToCloud failed:', error.message); return; }
  const runs = (s.runs || []).map(r => ({ user_id: u.id, level_reached: r.level_reached, score: r.score, played_at: r.played_at }));
  if (runs.length) await sb.from('game_runs').insert(runs);
  localStorage.removeItem('fd_progress_' + localKey);     // done: avoid double counting next login
}
