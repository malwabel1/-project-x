import { supabase } from "../lib/supabaseClient";
import { traceLog } from "../utils/traceLog"; // TEMPORARY trace

/**
 * Repository layer for TMDB access. Notably, this does NOT call
 * api.themoviedb.org -- it calls Memora's own Supabase Edge Functions
 * (`tmdb-search`, `tmdb-details`), which hold the TMDB API key as a
 * server-side secret. This file, and therefore the client bundle,
 * never contains a TMDB credential.
 */
export const TMDBRepository = {
  /**
   * @param {string} query
   * @returns {Promise<{ data: { results: any[] }|null, error: Error|null }>}
   */
  async searchMulti(query) {
    return supabase.functions.invoke("tmdb-search", { body: { query } });
  },

  /**
   * Fetches (and server-side persists) full details for one title
   * via the `tmdb-details` Edge Function. The function itself writes
   * runtime / total_episodes / status into the `titles` row using
   * the service role -- this client call just triggers it and
   * receives the fields back for optional immediate display.
   *
   * @param {number} tmdbId
   * @param {'movie'|'tv'} type
   * @returns {Promise<{ data: { details: object, persisted: boolean }|null, error: Error|null }>}
   */
  async fetchDetails(tmdbId, type) {
    // TEMPORARY trace (step 4) -- remove after tmdb-details 404 is resolved.
    // This is the EXACT URL invoke() will POST to: the functions host
    // derived from VITE_SUPABASE_URL + "/functions/v1/" + the slug.
    const base = import.meta.env.VITE_SUPABASE_URL;
    traceLog.push("4 exact URL", {
      postUrl: base ? base.replace(/\/$/, "") + "/functions/v1/tmdb-details" : "(VITE_SUPABASE_URL EMPTY)",
      projectRef: base ? new URL(base).hostname.split(".")[0] : "(none)",
    });
    return supabase.functions.invoke("tmdb-details", { body: { tmdb_id: tmdbId, type } });
  },
};
