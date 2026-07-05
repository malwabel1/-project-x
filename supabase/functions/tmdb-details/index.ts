// supabase/functions/tmdb-details/index.ts
//
// Memora -- TMDB details enrichment.
//
// A SEPARATE function from tmdb-search, deliberately: search stays
// untouched (per requirements), and this one has a different job --
// given a { tmdb_id, type }, it fetches TMDB's details endpoint
// (/movie/{id} or /tv/{id}), extracts the fields Memora's schema can
// hold, WRITES them into the `titles` row server-side, and returns
// them to the caller.
//
// Why the write happens HERE and not on the client: the `titles`
// table intentionally has no client-side UPDATE policy (catalogue
// curation is server-side by design -- see schema.sql). This function
// uses the service-role key, which is only available server-side, to
// perform that curation. No RLS policy change, no schema change.
//
// Field mapping (schema-constrained, stated honestly):
//   movie.runtime            → titles.runtime
//   tv.episode_run_time[0]   → titles.runtime (avg episode length; TMDB
//                              returns an array, often single-element,
//                              sometimes empty → null)
//   tv.number_of_episodes    → titles.total_episodes
//   tv.number_of_seasons     → RETURNED to the caller but NOT persisted:
//                              there is no seasons column and adding one
//                              is not "absolutely necessary" -- the app
//                              tracks the user's current season, and
//                              episode caps use total_episodes.
//   status                   → titles.status (e.g. "Released", "Ended")
//
// Deploy:
//   supabase functions deploy tmdb-details
//   (TMDB_API_KEY -- the short v3 API key, same one tmdb-search uses --
//    and ALLOWED_ORIGINS secrets are shared with tmdb-search; no new
//    secrets needed. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
//    injected automatically by the Supabase runtime.)

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE = "https://api.themoviedb.org/3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowAll = ALLOWED_ORIGINS.length === 0;
  const allowOrigin = allowAll ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

// Lighter rate limit than search -- details fetches happen once per
// title add, not per keystroke. Same per-isolate caveat as tmdb-search.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(identifier: string): boolean {
  const now = Date.now();
  const b = buckets.get(identifier);
  if (!b || now >= b.resetAt) {
    buckets.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (b.count >= RATE_LIMIT_MAX) return true;
  b.count += 1;
  return false;
}

function identifyCaller(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const payload = auth.replace(/^Bearer\s+/i, "").split(".")[1];
  if (payload) {
    try {
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (decoded?.sub) return `user:${decoded.sub}`;
    } catch {
      /* fall through */
    }
  }
  return `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}`;
}

function json(body: Record<string, unknown>, status: number, req: Request, requestId: string) {
  return new Response(JSON.stringify({ ...body, request_id: requestId }), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json", "x-request-id": requestId },
  });
}

serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeadersFor(req), "x-request-id": requestId } });
  }
  if (req.method !== "POST") {
    return json({ error: "Only POST is supported." }, 405, req, requestId);
  }
  if (!TMDB_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(`[${requestId}] missing configuration (TMDB_API_KEY / SUPABASE_URL / SERVICE_ROLE_KEY)`);
    return json({ error: "Details are temporarily unavailable." }, 500, req, requestId);
  }
  if (rateLimited(identifyCaller(req))) {
    return json({ error: "Too many requests. Please try again shortly." }, 429, req, requestId);
  }

  // ---- validate input ----
  let tmdbId: number | undefined;
  let type: string | undefined;
  try {
    const body = await req.json();
    tmdbId = body?.tmdb_id;
    type = body?.type;
  } catch {
    return json({ error: "Expected a JSON body with `tmdb_id` (number) and `type` ('movie'|'tv')." }, 400, req, requestId);
  }
  if (typeof tmdbId !== "number" || !Number.isFinite(tmdbId) || (type !== "movie" && type !== "tv")) {
    return json({ error: "Expected `tmdb_id` (number) and `type` ('movie'|'tv')." }, 400, req, requestId);
  }

  // ---- fetch TMDB details, with timeout ----
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    // v3-style auth: the TMDB_API_KEY secret currently holds the short
    // v3 API key (matching the deployed tmdb-search function), so the
    // key goes in the query string -- NOT an Authorization: Bearer
    // header, which is v4-token-only and would 401 with a v3 key.
    const url = `${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const tmdbRes = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (tmdbRes.status === 404) {
      return json({ error: "Title not found on TMDB." }, 404, req, requestId);
    }
    if (!tmdbRes.ok) {
      console.error(`[${requestId}] TMDB details failed: ${tmdbRes.status}`);
      return json({ error: "Details are temporarily unavailable." }, 502, req, requestId);
    }

    const d = await tmdbRes.json().catch(() => null);
    if (!d || typeof d !== "object") {
      console.error(`[${requestId}] unexpected TMDB details shape`);
      return json({ error: "Details are temporarily unavailable." }, 502, req, requestId);
    }

    // ---- map to schema-compatible fields ----
    const isMovie = type === "movie";
    const runtime = isMovie
      ? typeof d.runtime === "number" && d.runtime > 0
        ? d.runtime
        : null
      : Array.isArray(d.episode_run_time) && typeof d.episode_run_time[0] === "number" && d.episode_run_time[0] > 0
        ? d.episode_run_time[0]
        : null;
    const totalEpisodes = !isMovie && typeof d.number_of_episodes === "number" && d.number_of_episodes > 0 ? d.number_of_episodes : null;
    const numberOfSeasons = !isMovie && typeof d.number_of_seasons === "number" && d.number_of_seasons > 0 ? d.number_of_seasons : null;
    const status = typeof d.status === "string" && d.status ? d.status : null;

    // ---- persist into titles (server-side, service role) ----
    const patch: Record<string, unknown> = {};
    if (runtime !== null) patch.runtime = runtime;
    if (totalEpisodes !== null) patch.total_episodes = totalEpisodes;
    if (status !== null) patch.status = status;

    let persisted = false;
    if (Object.keys(patch).length > 0) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { error: updateError } = await admin.from("titles").update(patch).eq("tmdb_id", tmdbId);
      if (updateError) {
        // Don't fail the whole request -- the caller still gets the
        // fields for display; persistence just didn't stick this time.
        console.error(`[${requestId}] titles update failed:`, updateError.message);
      } else {
        persisted = true;
      }
    }

    return json(
      {
        details: {
          tmdb_id: tmdbId,
          type,
          runtime,
          total_episodes: totalEpisodes,
          number_of_seasons: numberOfSeasons, // returned, not persisted -- no schema column
          status,
        },
        persisted,
      },
      200,
      req,
      requestId
    );
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error(`[${requestId}] ${isTimeout ? "TMDB details timed out" : "unexpected error"}:`, err);
    return json(
      { error: isTimeout ? "Details request timed out. Please try again." : "Details are temporarily unavailable." },
      isTimeout ? 504 : 500,
      req,
      requestId
    );
  } finally {
    clearTimeout(timeout);
  }
});
