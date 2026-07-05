// TEMPORARY - enrichment tracing. Delete this file and everything
// marked "TEMPORARY trace" once the tmdb-details issue is resolved.
const entries = [];
const listeners = new Set();

export const traceLog = {
  push(label, value) {
    const time = new Date().toISOString().slice(11, 23);
    entries.push({ time, label, value: format(value) });
    if (entries.length > 40) entries.shift();
    listeners.forEach((fn) => fn([...entries]));
  },
  subscribe(fn) {
    listeners.add(fn);
    fn([...entries]);
    return () => listeners.delete(fn);
  },
  clear() {
    entries.length = 0;
    listeners.forEach((fn) => fn([]));
  },
};

function format(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Error) {
    const ctx = value.context && typeof value.context === "object"
      ? " | context.status: " + value.context.status + " | context.url: " + value.context.url
      : "";
    return "Error " + value.name + ": " + value.message + ctx;
  }
  try {
    const s = JSON.stringify(value);
    return s.length > 600 ? s.slice(0, 600) + "...[cut]" : s;
  } catch (_e) {
    return String(value);
  }
}
