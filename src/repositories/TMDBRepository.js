import { supabase } from "../lib/supabaseClient";

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
    return supabase.functions.invoke("tmdb-details", { body: { tmdb_id: tmdbId, type } });
  },
};
