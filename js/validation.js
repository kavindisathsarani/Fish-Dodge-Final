/* validation.js - pure input rules shared by the live hints and by auth.js (no DOM).
   THEME: high cohesion.*/
export const usernameRules = [
  { text: '3-16 characters', test: v => v.length >= 3 && v.length <= 16 },
  { text: 'Letters, numbers and _ only (no spaces)', test: v => /^[A-Za-z0-9_]+$/.test(v) },
];
export const passwordRules = [
  { text: 'At least 8 characters', test: v => v.length >= 8 },
  { text: 'Contains a letter', test: v => /[A-Za-z]/.test(v) },
  { text: 'Contains a number', test: v => /\d/.test(v) },
];
export const matchRule = getOther => [{ text: 'Passwords match', test: v => v.length > 0 && v === getOther() }];
export const firstError = (rules, value) => (rules.find(r => !r.test(value)) || {}).text || null;
