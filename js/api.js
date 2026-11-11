/* api.js - the ONLY file that talks to the Fish Game API. THEME: interoperability.
   Protocol: HTTP GET request, JSON response (docs: https://marcconrad.com/uob/fish/doc.php).
   The API returns a link to an image and the solution. Field names are detected automatically
   (the raw response is also printed to the browser console as "[Fish API] raw response").
*/
import { FISH_API_URL } from './config.js';

async function request(url) {
  const res = await fetch(`${url}?out=json&base64=no`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fish API error (HTTP ${res.status})`);
  return res.json();
}

// turn nested JSON into a flat list of [key, value] pairs
const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flatten(v, p + k + '.') : [[p + k, v]]);

const looksLikeImage = v => typeof v === 'string' &&
  (/^(https?:)?\/\//.test(v) || /^data:image/.test(v) || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(v));
const isNum = v => v !== '' && v !== null && typeof v !== 'boolean' && Number.isFinite(Number(v));

export function parseChallenge(raw) {
  const pairs = flatten(raw);
  let img = pairs.find(([, v]) => looksLikeImage(v))
         || pairs.find(([k, v]) => /question|image|img|url|pic|photo/i.test(k) && typeof v === 'string' && v.length > 20);
  let image = img && img[1];
  if (image && !/^(https?:|data:|\/\/)/.test(image)) {
    image = image.length > 200 ? 'data:image/png;base64,' + image : new URL(image, FISH_API_URL).href; // base64 or relative link
  }
  const nums = pairs.filter(([k, v]) => k !== (img && img[0]) && isNum(v));
  const sol = nums.find(([k]) => /solution|answer|count|fish|result|number/i.test(k)) || nums[0];
  return { image, solution: sol ? Number(sol[1]) : NaN };
}

export async function fetchChallenge() {
  let raw;
  try { raw = await request(FISH_API_URL); }
  catch (e) { raw = await request(FISH_API_URL.replace('https://', 'http://')); } // fall back to http
  console.log('[Fish API] raw response:', JSON.stringify(raw));
  const { image, solution } = parseChallenge(raw);
  if (!image || Number.isNaN(solution)) {
    throw new Error('Could not find the image and the answer in the API response. Open the console, copy the "[Fish API] raw response" line and send it to your assistant.');
  }
  return { image, solution };
}
