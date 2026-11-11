/* events.js - tiny event bus. THEME: event-driven programming + low coupling.
   Modules announce what happened (emit) and other modules react (on) without importing each other.
*/
const bus = new EventTarget();
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));
