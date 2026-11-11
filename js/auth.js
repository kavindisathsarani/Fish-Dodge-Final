/* auth.js - register / login / logout and session persistence. THEME: virtual identity.
   Supabase mode: Supabase Auth (email = username@fishdodge.app, password hashed by Supabase).
   Local mode (fallback / offline): salted hash stored in localStorage.
   Both modes keep the username in a cookie so the player is recognised on reload.
*/
import { sb, useSupabase, ready } from './supabase.js';
import { syncLocalToCloud } from './progress.js';
import { usernameRules, passwordRules, firstError } from './validation.js';

let user = null; // { id, username }
export const currentUser = () => user;

// ---- cookie ----
const setCookie = (v, days) => {
  document.cookie = `fd_user=${encodeURIComponent(v)};max-age=${days * 86400};path=/;SameSite=Lax`;
};
const getCookie = () => {
  const m = document.cookie.match(/fd_user=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};
/** The username remembered in the cookie. Only used to pre-fill the login box - it never logs anyone in. */
export const rememberedUsername = getCookie;

// ---- local session: proof that THIS browser really logged in (password checked), not just a name in a cookie ----
const SESSION_KEY = 'fd_session';
function startLocalSession(key) {
  const all = localUsers(), token = makeSalt();
  if (all[key]) { all[key].session = token; localStorage.setItem('fd_users', JSON.stringify(all)); }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ k: key, t: token }));
}
const endLocalSession = () => localStorage.removeItem(SESSION_KEY);

// ---- helpers ----
const emailOf = n => `${n.toLowerCase()}@fishdodge.app`;
const localUsers = () => JSON.parse(localStorage.getItem('fd_users') || '{}');

function makeSalt() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID(); } catch (e) {}
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function hash(pw, salt) {
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pw));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {}
  }
  // Safe fallback hash when crypto.subtle is unavailable in non-secure HTTP contexts
  let h = 0x811c9dc5;
  const str = salt + pw;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8) +
         ('0000000' + (Math.imul(h, 31) >>> 0).toString(16)).slice(-8);
}

function check(username, pw) {
  const u = firstError(usernameRules, username);
  if (u) throw new Error('Username: ' + u);
  const p = firstError(passwordRules, pw);
  if (p) throw new Error('Password: ' + p);
}

export async function restoreSession() {
  await ready;
  if (useSupabase && sb) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Session timeout')), 2200));
      const getSessionPromise = (async () => {
        const { data } = await sb.auth.getSession();
        if (!data?.session) return null;
        let username = 'Player';
        try {
          const { data: p } = await sb.from('profiles').select('username').eq('id', data.session.user.id).maybeSingle();
          if (p?.username) username = p.username;
        } catch (_) {}
        return { id: data.session.user.id, username };
      })();
      user = await Promise.race([getSessionPromise, timeout]);
    } catch (e) {
      console.warn('Supabase session restore note:', e.message);
      user = null;
    }
  }

  // Local mode: only trust a session that was created by a real, password-checked login.
  // (A username cookie alone is NOT enough - that is what used to let you skip the password.)
  if (!user) {
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      const rec = sess && localUsers()[sess.k];
      if (rec && rec.session && rec.session === sess.t) user = { id: sess.k, username: rec.username };
    } catch (_) {}
  }

  if (user) setCookie(user.username, 7);
  return user;
}

export async function register(username, pw, pw2) {
  check(username, pw);
  if (pw !== pw2) throw new Error('Passwords do not match');
  await ready;

  const key = username.toLowerCase();
  const all = localUsers();
  const salt = makeSalt();
  const localHash = await hash(pw, salt);

  if (useSupabase && sb) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Signup timeout')), 4000));
      const signUpPromise = sb.auth.signUp({ email: emailOf(username), password: pw, options: { data: { username } } });
      const { data, error } = await Promise.race([signUpPromise, timeout]);
      if (error) {
        if (/registered|already|taken/i.test(error.message)) throw new Error('That username is already taken. Please choose another.');
        throw new Error(error.message);
      }
      if (data?.user) {
        // "Confirm email" ON in Supabase => no session yet. Try to sign straight in; if that fails the
        // account can't save scores to the cloud, so say so instead of silently playing local-only.
        let session = data.session;
        if (!session) {
          const r = await sb.auth.signInWithPassword({ email: emailOf(username), password: pw });
          session = r.data?.session;
        }
        if (!session) throw new Error('CONFIRM: Account created, but Supabase still requires email confirmation. In Supabase go to Authentication > Providers > Email and turn off "Confirm email", then log in.');
        const { error: pErr } = await sb.from('profiles').upsert({ id: data.user.id, username });
        if (pErr) console.warn('profile upsert failed (the DB trigger from supabase/fix_new_players.sql will cover it):', pErr.message);
        user = { id: data.user.id, username };
      }
    } catch (err) {
      console.warn('Supabase signup note:', err.message);
      if (/taken|^CONFIRM/i.test(err.message)) throw new Error(err.message.replace(/^CONFIRM: /, ''));
      if (all[key]) throw new Error('That username is already taken. Please choose another.');
      all[key] = { username, salt, hash: localHash };
      localStorage.setItem('fd_users', JSON.stringify(all));
      user = { id: key, username };
    }
  } else {
    if (all[key]) throw new Error('That username is already taken. Please choose another.');
    all[key] = { username, salt, hash: localHash };
    localStorage.setItem('fd_users', JSON.stringify(all));
    user = { id: key, username };
  }

  // Save local copy for offline support
  all[key] = { username, salt, hash: localHash };
  localStorage.setItem('fd_users', JSON.stringify(all));

  if (!user) {
    user = { id: key, username };
  }

  startLocalSession(key);
  setCookie(user.username, 7);
  return user;
}

export async function login(username, pw) {
  if (!username || !username.trim()) throw new Error('Please enter your username');
  if (!pw) throw new Error('Please enter your password');
  await ready;

  // 1. Try Supabase first if available
  if (useSupabase && sb) {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 3500));
      const authPromise = sb.auth.signInWithPassword({ email: emailOf(username), password: pw });
      const { data, error } = await Promise.race([authPromise, timeout]);
      if (!error && data?.user) {
        let profileName = username;
        try {
          const { data: p } = await sb.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
          if (p?.username) profileName = p.username;
        } catch (_) {}
        user = { id: data.user.id, username: profileName };
        // make sure a profile row exists (needed for the global leaderboard) and push any progress that was
        // saved on this device while the account was local-only
        sb.from('profiles').upsert({ id: data.user.id, username: profileName }).then(() => {}, () => {});
        syncLocalToCloud(user, username.toLowerCase()).catch(() => {});
        const all = localUsers(), salt = makeSalt();     // (one salt: the stored hash must match the salt stored with it)
        all[username.toLowerCase()] = { username: profileName, salt, hash: await hash(pw, salt) };
        localStorage.setItem('fd_users', JSON.stringify(all));
        startLocalSession(username.toLowerCase());
        setCookie(user.username, 7);
        return user;
      }
      if (error) {
        console.warn('Supabase signIn note:', error.message);
      }
    } catch (err) {
      console.warn('Supabase signIn note:', err.message);
    }
  }

  // 2. Check local users fallback
  const rec = localUsers()[username.toLowerCase()];
  if (rec) {
    const pwHash = await hash(pw, rec.salt);
    if (rec.hash === pwHash) {
      user = { id: username.toLowerCase(), username: rec.username };
      startLocalSession(username.toLowerCase());
      setCookie(user.username, 7);
      return user;
    }
    throw new Error('Incorrect password. Please try again.');
  }

  throw new Error('Account not found. Click "Create New Account" below to get started!');
}

export async function logout() {
  await ready;
  if (useSupabase && sb) {
    try { await sb.auth.signOut(); } catch (e) {}
  }
  setCookie('', 0);
  endLocalSession();
  user = null;
}

export async function changePassword(current, next, next2) {
  if (!user) throw new Error('You are not logged in');
  await ready;
  const e = firstError(passwordRules, next);
  if (e) throw new Error('New password must have: ' + e.toLowerCase());
  if (next !== next2) throw new Error('The new passwords do not match');

  let updated = false;

  if (useSupabase && sb) {
    try {
      const { error: e1 } = await sb.auth.signInWithPassword({ email: emailOf(user.username), password: current });
      if (e1) throw new Error('Your current password is wrong');
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
      updated = true;
    } catch (err) {
      if (/current password is wrong/i.test(err.message)) throw err;
      console.warn('Supabase changePassword fallback:', err);
    }
  }

  const all = localUsers();
  const rec = all[user.id] || all[user.username.toLowerCase()];
  if (rec) {
    if (!updated && rec.hash !== await hash(current, rec.salt)) {
      throw new Error('Your current password is wrong');
    }
    rec.salt = makeSalt();
    rec.hash = await hash(next, rec.salt);
    localStorage.setItem('fd_users', JSON.stringify(all));
  }
}

export async function deleteAccount() {
  if (!user) throw new Error('You are not logged in');
  await ready;
  if (useSupabase && sb) {
    try {
      await sb.rpc('delete_my_account');
      await sb.auth.signOut();
    } catch (e) {
      console.warn('Remote delete failed, deleting locally:', e);
    }
  }
  const all = localUsers();
  delete all[user.id];
  delete all[user.username.toLowerCase()];
  localStorage.setItem('fd_users', JSON.stringify(all));
  localStorage.removeItem('fd_progress_' + user.id);
  setCookie('', 0);
  endLocalSession();
  user = null;
}
