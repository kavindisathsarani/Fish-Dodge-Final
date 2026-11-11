/* supabase.js - creates the Supabase client ONLY if config.js has a URL and key.
   THEME: interoperability / virtual identity (Supabase Auth + database).

   The Supabase library comes from a CDN. It is loaded in the background with a time limit,
   so a slow or blocked network can never freeze the game: the app starts straight away and,
   if Supabase can't be reached, simply runs in local mode.
   Other modules `await ready` before using `sb` / `useSupabase` (live bindings, they update when ready).
*/
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export let useSupabase = false;
export let sb = null;

const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after ' + ms + 'ms')), ms))]);

export const ready = (async () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    const { createClient } = await within(import(CDN), 5000);
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    useSupabase = true;
  } catch (err) {
    console.warn('Could not connect to Supabase CDN, running in local mode:', err.message);
  }
})();
