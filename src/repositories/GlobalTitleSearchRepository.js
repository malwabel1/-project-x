import { supabase } from "../lib/supabaseClient";

/**
 * Repository for searching the *catalogue* (all titles anyone has
 * ever added), as opposed to UserLibraryRepository which searches
 * one user's tracked subset. This is "search mode 2" from the
 * architecture: global catalogue search. It's the offline/fallback
 * path now that TMDBService is the primary provider — see
 * GlobalTitleSearchService, which tries TMDB first and falls back to
 * this when TMDB is unavailable.
 */
export const GlobalTitleSearchRepository = {
  /**
   * Searches titles already known to Memora (added by any user, via
   * TMDB import or manual entry).
   * @param {string} query
   * @param {{ limit?: number }} [options]
   */
  async searchLocalCatalogue(query, { limit = 20 } = {}) {
    return supabase
      .from("titles")
      .select(
        "id, tmdb_id, title, type, genre, total_episodes, poster_url, backdrop_url, overview, release_year, runtime, popularity, original_title, language, status, vote_average"
      )
      .ilike("title", `%${query}%`)
      .order("popularity", { ascending: false, nullsFirst: false })
      .limit(limit);
  },
};
