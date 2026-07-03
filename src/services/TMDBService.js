import { TMDBRepository } from "../repositories/TMDBRepository";
import { toAppError } from "../utils/errors";

const POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

/**
 * Service layer for TMDB. Hooks/components never call TMDBRepository
 * directly — only this. Owns the one thing specific to TMDB: turning
 * its /search/multi response shape into Memora's `Title` shape so
 * every other layer (TitlesService, UserLibraryService, components)
 * works with one consistent object regardless of where a title came
 * from (manual entry, TMDB, or — later — another provider).
 */
export const TMDBService = {
  /**
   * Searches movies and TV shows (TMDB's multi-search also returns
   * people, which are filtered out both here and in the edge
   * function, belt-and-suspenders).
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

    const results = Array.isArray(data?.results) ? data.results : [];
    return results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, limit)
      .map(toTitle);
  },
};

/**
 * @param {any} r  a raw TMDB /search/multi result item
 * @returns {import('../types').Title}
 */
function toTitle(r) {
  const isMovie = r.media_type === "movie";
  return {
    // No `id` yet — this title may not exist in our `titles` table.
    // TitlesService.findOrCreateFromTmdb resolves a real id from
    // tmdbId before anything is written.
    id: null,
    tmdbId: r.id,
    title: isMovie ? r.title : r.name,
    originalTitle: (isMovie ? r.original_title : r.original_name) || null,
    type: isMovie ? "movie" : "tv",
    // Multi-search returns genre_ids (numbers), not names, and
    // TMDB's genre list needs a separate lookup to resolve them —
    // left null here; wiring that lookup is a follow-up, not
    // required for search/add to work.
    genre: null,
    // Episode count isn't in search results either — only on the
    // /tv/{id} details endpoint. Left null until a details call is
    // added.
    totalEpisodes: null,
    posterUrl: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : null,
    backdropUrl: r.backdrop_path ? `${BACKDROP_BASE}${r.backdrop_path}` : null,
    overview: r.overview || null,
    releaseYear: extractYear(isMovie ? r.release_date : r.first_air_date),
    runtime: null, // details-endpoint-only, same as totalEpisodes
    popularity: typeof r.popularity === "number" ? r.popularity : null,
    voteAverage: typeof r.vote_average === "number" ? r.vote_average : null,
    language: r.original_language || null,
    status: null, // details-endpoint-only
    imdbId: null, // TMDB's /find or /movie(tv)/{id}/external_ids, not multi-search
  };
}

function extractYear(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}
