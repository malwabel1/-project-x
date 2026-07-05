import { supabase } from "../lib/supabaseClient";
import { traceLog } from "../utils/traceLog"; // TEMPORARY trace

/**
 * TEMPORARY DIAGNOSTIC VERSION of fetchDetails.
 *
 * supabase.functions.invoke() is bypassed entirely. In its place, a
 * controlled experiment of four raw browser fetch() probes runs, in
 * order, with every input and outcome pushed to the on-screen
 * TraceOverlay. No interpretation is applied - raw evidence only.
 *
 *   PROBE A: GET, zero custom headers -> tmdb-details
 *            (a request the browser sends WITHOUT a CORS preflight)
 *   PROBE B: GET, zero custom headers -> tmdb-search   (control)
 *   PROBE C: POST + authorization/apikey/content-type -> tmdb-details
 *            (byte-equivalent to what invoke() sends; preflight forced)
 *   PROBE D: same POST -> tmdb-search                  (control)
 *
 * The return value is built from PROBE C so the app keeps working
 * if C succeeds. searchMulti is untouched.
 */
export const TMDBRepository = {
  /**
   * @param {string} query
   */
  async searchMulti(query) {
    return supabase.functions.invoke("tmdb-search", { body: { query } });
  },

  /**
   * @param {number} tmdbId
   * @param {'movie'|'tv'} type
   */
  async fetchDetails(tmdbId, type) {
    const base = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    const detailsUrl = base + "/functions/v1/tmdb-details";
    const searchUrl = base + "/functions/v1/tmdb-search";

    // The same bearer token invoke() would attach: the session token
    // when signed in, else the anon key.
    let bearer = anonKey;
    try {
      const { data } = await supabase.auth.getSession();
      if (data && data.session && data.session.access_token) bearer = data.session.access_token;
    } catch (e) {
      traceLog.push("DIAG getSession threw", e);
    }

    const body = JSON.stringify({ tmdb_id: tmdbId, type });
    const fullHeaders = {
      "Authorization": "Bearer " + bearer,
      "apikey": anonKey,
      "Content-Type": "application/json",
    };

    traceLog.push("DIAG start", {
      detailsUrl,
      searchUrl,
      body,
      headerNames: Object.keys(fullHeaders),
      bearerKind: bearer === anonKey ? "anon" : "session",
      pageOrigin: window.location.origin,
    });

    await probe("A GET no-headers tmdb-details", detailsUrl, { method: "GET" });
    await probe("B GET no-headers tmdb-search", searchUrl, { method: "GET" });
    const c = await probe("C POST full-headers tmdb-details", detailsUrl, { method: "POST", headers: fullHeaders, body });
    await probe("D POST full-headers tmdb-search", searchUrl, { method: "POST", headers: fullHeaders, body: JSON.stringify({ query: "diagnostic" }) });

    // Feed PROBE C's outcome back to the app in invoke()'s shape.
    if (c && c.ok) return { data: c.json, error: null };
    return { data: null, error: new Error(c && c.errorSummary ? c.errorSummary : "diagnostic probe C failed (see overlay)") };
  },
};

async function probe(label, url, init) {
  try {
    const res = await fetch(url, init);
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    let text = "";
    try {
      text = await res.text();
    } catch (e) {
      text = "(body read failed: " + e.message + ")";
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (_e) {
      /* not json */
    }
    traceLog.push("DIAG " + label + " -> RESPONSE", {
      status: res.status,
      statusText: res.statusText,
      type: res.type,
      url: res.url,
      headers,
      body: text.slice(0, 400),
    });
    return { ok: res.ok, status: res.status, json, errorSummary: "HTTP " + res.status + ": " + text.slice(0, 200) };
  } catch (err) {
    traceLog.push("DIAG " + label + " -> FETCH THREW (no Response exists)", {
      name: err && err.name,
      message: err && err.message,
      stack: err && err.stack ? String(err.stack).slice(0, 300) : "(none)",
    });
    return { ok: false, status: null, json: null, errorSummary: (err && err.name) + ": " + (err && err.message) };
  }
}
