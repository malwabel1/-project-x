import { supabase } from "../lib/supabaseClient";
import { traceLog } from "../utils/traceLog"; // TEMPORARY trace

/**
 * TEMPORARY DIAGNOSTIC VERSION - round 2: preflight isolation.
 *
 * Evidence so far: identical POSTs -> search 200, details throws
 * before any Response. The differentiator must be the preflight
 * exchange. Two limits of browser JS shape this round, stated
 * honestly up front:
 *
 *  - A page CANNOT send a real preflight manually (the browser owns
 *    it), and fetch(url, {method:"OPTIONS"}) is itself preflighted.
 *  - Cross-origin response headers are only readable by JS if the
 *    server lists them in Access-Control-Expose-Headers. So probe H
 *    below prints whatever headers the browser EXPOSES - if the
 *    access-control-* values do not appear there, that is a browser
 *    privacy rule, not the server omitting them.
 *
 * So in addition to dumping OPTIONS response headers (your request),
 * this round adds a HEADER BISECTION - probes E/F/G send the same
 * POST with different subsets of request headers. Each subset still
 * forces a preflight (JSON content-type is non-simple), but changes
 * what Access-Control-Request-Headers asks permission for. Whichever
 * header's presence flips the result from "HTTP response" to
 * "TypeError: Load failed" is, by elimination, the header Safari is
 * being denied in the tmdb-details preflight.
 *
 *   E: POST details - Content-Type only          (no auth headers)
 *   F: POST details - Content-Type + apikey
 *   G: POST details - Content-Type + Authorization
 *   C: POST details - all three (reference, from round 1)
 *   D: POST search  - all three (control)
 *   H: OPTIONS details - dump every exposed response header
 *   I: OPTIONS search  - dump every exposed response header
 */
export const TMDBRepository = {
  async searchMulti(query) {
    return supabase.functions.invoke("tmdb-search", { body: { query } });
  },

  async fetchDetails(tmdbId, type) {
    const base = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    const detailsUrl = base + "/functions/v1/tmdb-details";
    const searchUrl = base + "/functions/v1/tmdb-search";

    let bearer = anonKey;
    try {
      const { data } = await supabase.auth.getSession();
      if (data && data.session && data.session.access_token) bearer = data.session.access_token;
    } catch (e) {
      traceLog.push("DIAG getSession threw", e);
    }

    const body = JSON.stringify({ tmdb_id: tmdbId, type });
    const H_CT = { "Content-Type": "application/json" };
    const H_CT_KEY = { ...H_CT, "apikey": anonKey };
    const H_CT_AUTH = { ...H_CT, "Authorization": "Bearer " + bearer };
    const H_ALL = { ...H_CT, "apikey": anonKey, "Authorization": "Bearer " + bearer };

    traceLog.push("DIAG2 start", { detailsUrl, pageOrigin: window.location.origin });

    await probe("E POST details CT-only", detailsUrl, { method: "POST", headers: H_CT, body });
    await probe("F POST details CT+apikey", detailsUrl, { method: "POST", headers: H_CT_KEY, body });
    await probe("G POST details CT+Authorization", detailsUrl, { method: "POST", headers: H_CT_AUTH, body });
    const c = await probe("C POST details ALL headers", detailsUrl, { method: "POST", headers: H_ALL, body });
    await probe("D POST search ALL headers (control)", searchUrl, { method: "POST", headers: H_ALL, body: JSON.stringify({ query: "diagnostic" }) });
    await probe("H OPTIONS details header dump", detailsUrl, { method: "OPTIONS" });
    await probe("I OPTIONS search header dump", searchUrl, { method: "OPTIONS" });

    if (c && c.ok) return { data: c.json, error: null };
    return { data: null, error: new Error(c && c.errorSummary ? c.errorSummary : "diagnostic probe C failed (see overlay)") };
  },
};

const WANTED = ["access-control-allow-origin", "access-control-allow-methods", "access-control-allow-headers", "access-control-max-age", "vary", "x-memora-version", "x-request-id", "content-type"];

async function probe(label, url, init) {
  try {
    const res = await fetch(url, init);
    const exposed = {};
    res.headers.forEach((v, k) => (exposed[k] = v));
    const wanted = {};
    for (const k of WANTED) wanted[k] = res.headers.get(k) === null ? "(not exposed to JS or absent)" : res.headers.get(k);
    let text = "";
    try { text = await res.text(); } catch (e) { text = "(body read failed: " + e.message + ")"; }
    let json = null;
    try { json = JSON.parse(text); } catch (_e) { /* not json */ }
    traceLog.push("DIAG2 " + label + " -> RESPONSE", {
      status: res.status,
      wantedHeaders: wanted,
      allExposedHeaders: exposed,
      body: text.slice(0, 250),
    });
    return { ok: res.ok, status: res.status, json, errorSummary: "HTTP " + res.status + ": " + text.slice(0, 200) };
  } catch (err) {
    traceLog.push("DIAG2 " + label + " -> FETCH THREW (no Response)", {
      name: err && err.name,
      message: err && err.message,
    });
    return { ok: false, status: null, json: null, errorSummary: (err && err.name) + ": " + (err && err.message) };
  }
}
