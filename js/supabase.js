// This connects the app to Supabase for login and database access.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export let useSupabase = false;
export let sb = null;

//The Supabase library loads from a CDN in the background with a time limit.
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
