import { TMDBRepository } from "../repositories/TMDBRepository";
import { toAppError } from "../utils/errors";

/**
 * Service layer for TMDB. Hooks/components never call TMDBRepository
 * directly -- only this.
 *
 * The `tmdb-search` Edge Function does the heavy lifting: it calls
 * TMDB, filters to movies and TV shows, and maps each result into a
 * row shaped to match Memora's `titles` table columns (tmdb_id,
 * title, type, poster_url, backdrop_url, overview, release_year,
 * popularity, original_title, language, vote_average) -- see
 * supabase/functions/tmdb-search/index.ts. This file's only job is
 * converting that snake_case, schema-shaped row into the app's
 * camelCase `Title` type. No filtering happens here, and no field
 * from TMDB's own raw API response is read here -- everything below
 * reads only the columns the Edge Function already produced.
 */
export const TMDBService = {
  /**
   * @param {string} query
   * @param {{ limit?: number }} [options]
   * @returns {Promise<import('../types').Title[]>}
   */
  async search(query, { limit = 20 } = {}) {
    const trimmed = (query || "").trim();
    if (!trimmed) return [];

    const { data, error } = await TMDBRepository.searchMulti(trimmed);
    if (error) throw toAppError(error, "Couldn't search TMDB right now.");
    if (data?.error) throw toAppError(new Error(data.error), "Couldn't search TMDB right now.");

    const rows = Array.isArray(data?.results) ? data.results : [];
    return rows.slice(0, limit).map(toTitle);
  },

  /**
   * Triggers the `tmdb-details` Edge Function for one title. The
   * function fetches TMDB's /movie/{id} or /tv/{id}, persists
   * runtime / total_episodes / status into the `titles` row
   * server-side (service role -- catalogue curation stays server-side,
   * no client UPDATE policy needed), and returns the fields.
   *
   * Designed to be safe to call fire-and-forget: throws AppError on
   * failure like every other service method, but callers doing
   * best-effort enrichment can simply .catch(logError) -- a failed
   * enrichment must never break adding a title (same philosophy as
   * ActivityService.log).
   *
   * @param {number} tmdbId
   * @param {'movie'|'tv'} type
   * @returns {Promise<{ runtime: number|null, totalEpisodes: number|null, numberOfSeasons: number|null, status: string|null, persisted: boolean }>}
   */
  async fetchAndPersistDetails(tmdbId, type) {
    // TEMPORARY trace (step 3) -- remove after tmdb-details 404 is resolved
    console.log("[TRACE 3] fetchAndPersistDetails called. tmdbId:", tmdbId, "| type:", type);
    if (typeof tmdbId !== "number" || (type !== "movie" && type !== "tv")) {
      console.log("[TRACE 3x] guard REJECTED the input -- execution stops here");
      throw toAppError(new Error("fetchAndPersistDetails: invalid tmdbId/type"), "Couldn't load title details.");
    }

    const { data, error } = await TMDBRepository.fetchDetails(tmdbId, type);
    // TEMPORARY trace (step 5) -- the raw invoke outcome
    console.log("[TRACE 5] invoke returned. data:", data, "| error:", error, "| error.context (Response):", error && error.context);
    if (error) throw toAppError(error, "Couldn't load title details.");
    if (data?.error) throw toAppError(new Error(data.error), "Couldn't load title details.");

    const d = data?.details || {};
    return {
      runtime: typeof d.runtime === "number" ? d.runtime : null,
      totalEpisodes: typeof d.total_episodes === "number" ? d.total_episodes : null,
      numberOfSeasons: typeof d.number_of_seasons === "number" ? d.number_of_seasons : null,
      status: typeof d.status === "string" ? d.status : null,
      persisted: !!data?.persisted,
    };
  },
};

/**
 * @param {any} row  a schema-shaped row from the tmdb-search Edge Function
 * @returns {import('../types').Title}
 */
function toTitle(row) {
  return {
    // No `id` yet -- this title may not exist in our `titles` table.
    // TitlesService.findOrCreateFromTmdb resolves a real id from
    // tmdbId before anything is written.
    id: null,
    tmdbId: row.tmdb_id,
    title: row.title,
    originalTitle: row.original_title || null,
    type: row.type,
    // The search endpoint doesn't return genre names or episode
    // counts -- the tmdb-details Edge Function fills in runtime /
    // total_episodes / status after a title is added (see
    // fetchAndPersistDetails above). Genre names would need a
    // genre-id mapping and remain null for TMDB-sourced titles.
    genre: null,
    totalEpisodes: null,
    posterUrl: row.poster_url || null,
    backdropUrl: row.backdrop_url || null,
    overview: row.overview || null,
    releaseYear: typeof row.release_year === "number" ? row.release_year : null,
    runtime: null,
    popularity: typeof row.popularity === "number" ? row.popularity : null,
    voteAverage: typeof row.vote_average === "number" ? row.vote_average : null,
    language: row.language || null,
    status: null,
    imdbId: null,
  };
}
