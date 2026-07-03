// supabase/functions/tmdb-search/index.ts
//
// Proxies TMDB's /search/multi endpoint. This is the ONLY place the
// TMDB API key exists — it's read from a Supabase secret
// (TMDB_API_KEY), never sent to or stored in the browser. The client
// calls this function via supabase.functions.invoke("tmdb-search"),
// which authenticates as the logged-in user but never sees the key.
//
// Client-facing response shape is UNCHANGED from the previous
// version — { results: [...] } on success, { error: "..." } on
// failure — so TMDBRepository/TMDBService need no changes. A
// `request_id` field is additive; existing clients ignore it safely.
//
// Deploy:
//   supabase functions deploy tmdb-search
//   supabase secrets set TMDB_API_KEY=your-tmdb-v4-read-access-token
//   supabase secrets set ALLOWED_ORIGINS=https://yourapp.com,https://staging.yourapp.com
//
// TMDB_API_KEY should be a "API Read Access Token" (v4 auth, a long
// JWT-looking string) from https://www.themoviedb.org/settings/api —
// used below as a Bearer token. If you only have a v3 "API Key"
// instead, swap the Authorization header for `?api_key=...` on the
// request URL.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

const TMDB_API_KEY = Deno.env.get("TMDB_API_KEY");
const TMDB_BASE = "https://api.themoviedb.org/3";

// ------------------------------------------------------------------
// 6. CORS — restricted to a configured allow-list instead of "*".
// Set ALLOWED_ORIGINS as a comma-separated secret before production;
// falls back to "*" only when unset, so local development still
// works out of the box (tighten this before shipping).
// ------------------------------------------------------------------
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowAll = ALLOWED_ORIGINS.length === 0; // dev fallback only

  const allowOrigin = allowAll
    ? "*"
    : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ""; // no match → omit the header, browser blocks the response

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

// ------------------------------------------------------------------
// 2. Basic rate limiting.
// In-memory, per warm isolate — NOT distributed. Edge functions can
// scale to multiple isolates with no shared memory, so this caps
// abuse from a single hot instance rather than guaranteeing a global
// limit. For a hard global guarantee, back this with Supabase
// Postgres (a `rate_limits` table + an atomic increment) or a
// key-value store like Upstash Redis instead of this Map — the
// identifier/window logic below carries over unchanged.
// ------------------------------------------------------------------
const RATE_LIMIT_MAX = 20; // requests
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60s
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string): { limited: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(identifier);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return { limited: true, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { limited: false };
}

/**
 * Best-effort caller identity for rate limiting: the authenticated
 * user's id (decoded from the JWT `sub` claim — safe to read
 * without re-verifying, since Supabase's gateway already verified
 * this token before invoking the function) or, failing that, the
 * caller's IP.
 */
function identifyCaller(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (payload) {
    try {
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      if (decoded?.sub) return `user:${decoded.sub}`;
    } catch {
      // fall through to IP-based identity
    }
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

// ------------------------------------------------------------------
// 3. request_id — attached to every response (success or failure)
// so a person reporting an issue can hand back one id that's
// greppable in the function's logs.
// ------------------------------------------------------------------
function json(body: Record<string, unknown>, status: number, req: Request, requestId: string) {
  return new Response(JSON.stringify({ ...body, request_id: requestId }), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json", "x-request-id": requestId },
  });
}

// ------------------------------------------------------------------
// 4. Response shape validation — don't trust TMDB's payload blindly.
// ------------------------------------------------------------------
function isValidTmdbResult(r: unknown): r is { id: number; media_type: string } {
  return (
    !!r &&
    typeof r === "object" &&
    typeof (r as { id?: unknown }).id === "number" &&
    typeof (r as { media_type?: unknown }).media_type === "string"
  );
}

serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeadersFor(req), "x-request-id": requestId } });
  }

  if (!TMDB_API_KEY) {
    console.error(`[${requestId}] TMDB_API_KEY is not configured`);
    return json({ error: "Search is temporarily unavailable." }, 500, req, requestId);
  }

  const identifier = identifyCaller(req);
  const rateLimit = checkRateLimit(identifier);
  if (rateLimit.limited) {
    console.warn(`[${requestId}] rate limited: ${identifier}`);
    return json(
      { error: "Too many search requests. Please slow down and try again shortly." },
      429,
      req,
      requestId
    );
  }

  let query: string | undefined;
  try {
    const body = await req.json();
    query = body?.query;
  } catch {
    return json({ error: "Expected a JSON body with a `query` string." }, 400, req, requestId);
  }

  if (!query || typeof query !== "string" || !query.trim()) {
    return json({ results: [] }, 200, req, requestId);
  }

  // ------------------------------------------------------------
  // 1. Timeout — never let a slow/hung TMDB request hold the
  // function (and the user's UI) open indefinitely.
  // ------------------------------------------------------------
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query.trim())}&include_adult=false&page=1`;
    const tmdbRes = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_API_KEY}`, accept: "application/json" },
      signal: controller.signal,
    });

    if (!tmdbRes.ok) {
      console.error(`[${requestId}] TMDB request failed: ${tmdbRes.status}`);
      return json({ error: "Search is temporarily unavailable." }, 502, req, requestId);
    }

    const data = await tmdbRes.json().catch(() => null);

    // 4. Shape validation: bail out cleanly rather than forwarding
    // something malformed for the client to choke on.
    if (!data || !Array.isArray(data.results)) {
      console.error(`[${requestId}] unexpected TMDB response shape`);
      return json({ error: "Search is temporarily unavailable." }, 502, req, requestId);
    }

    const results = data.results.filter(
      (r: unknown) => isValidTmdbResult(r) && (r.media_type === "movie" || r.media_type === "tv")
    );

    return json({ results }, 200, req, requestId);
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    // 5. No `detail: String(err)` in the client-facing response —
    // the full error still goes to the function's own logs, tagged
    // with the same request_id, for debugging.
    console.error(`[${requestId}] ${isTimeout ? "TMDB request timed out" : "unexpected error"}:`, err);
    return json(
      { error: isTimeout ? "Search timed out. Please try again." : "Search is temporarily unavailable." },
      isTimeout ? 504 : 500,
      req,
      requestId
    );
  } finally {
    clearTimeout(timeout);
  }
});
