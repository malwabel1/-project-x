import { supabase } from "../lib/supabaseClient";

/**
 * Repository layer for TMDB access. Notably, this does NOT call
 * api.themoviedb.org - it calls Memora's own `tmdb-search` Supabase
 * Edge Function, which holds the TMDB API key as a server-side
 * secret. This file, and therefore the client bundle, never contains
 * a TMDB credential.
 *
 * Both operations go through the SAME edge function, routed by the
 * request body. This is deliberate, not an accident of naming:
 * separately-deployed enrichment functions (tmdb-details,
 * tmdb-enrich) were consistently rejected by Safari at the CORS
 * preflight stage despite identical code and settings, while this
 * function's preflight has always been accepted. Enrichment was
 * therefore folded into tmdb-search as a body-routed action
 * ({ action: "enrich", ... }); CORS never inspects request bodies,
 * so this cannot re-trigger the failure. Do not split enrichment
 * back out into its own function without re-testing on iPad Safari.
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
   * Triggers server-side details enrichment for one title: the edge
   * function fetches TMDB's details endpoint and persists
   * runtime / total_episodes / status into the `titles` row using
   * the service role. This call just fires it and receives the
   * fields back.
   *
   * @param {number} tmdbId
   * @param {'movie'|'tv'} type
   * @returns {Promise<{ data: { details: object, persisted: boolean }|null, error: Error|null }>}
   */
  async fetchDetails(tmdbId, type) {
    return supabase.functions.invoke("tmdb-search", { body: { action: "enrich", tmdb_id: tmdbId, type } });
  },
};
