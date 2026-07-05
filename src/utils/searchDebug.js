// TEMPORARY -- search debugging aid. Delete this file (and the
// three `searchDebug.set(...)` lines referencing it) once the
// tmdb-search issue is resolved.
//
// A tiny observable key/value store. Layers that can't render UI
// (repository, service, hook) write facts into it; the DebugPanel
// component subscribes and renders them live. This adds NO behavior
// to the search flow itself -- every `.set()` call is fire-and-forget
// bookkeeping around the existing, unchanged logic.

const state = {};
const listeners = new Set();

export const searchDebug = {
  set(key, value) {
    state[key] = value;
    listeners.forEach((fn) => fn({ ...state }));
  },
  subscribe(fn) {
    listeners.add(fn);
    fn({ ...state });
    return () => listeners.delete(fn);
  },
};

// Serializes anything (including Error objects, which JSON.stringify
// renders as "{}") into something readable on screen.
export function debugFormat(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Error) {
    return `Error: ${value.name}: ${value.message}${value.cause ? ` | cause: ${debugFormat(value.cause)}` : ""}`;
  }
  try {
    const s = JSON.stringify(value, null, 1);
    return s.length > 1200 ? s.slice(0, 1200) + " …[truncated]" : s;
  } catch {
    return String(value);
  }
}
