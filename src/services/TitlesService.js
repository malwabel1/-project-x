import { TitlesRepository } from "../repositories/TitlesRepository";
import { toAppError } from "../utils/errors";

/**
 * Service layer for the `titles` catalogue. Hooks and other services
 * call this — never TitlesRepository or supabase directly.
 */
export const TitlesService = {
  /**
   * Returns the id of an existing (title, type) row, creating one if
   * it doesn't exist yet. This is the manual-entry "find-or-create"
   * the Add form relies on so the same show isn't duplicated across
   * users.
   * @param {{ title: string, type: import('../types').TitleType, genre?: string, totalEpisodes?: number, userId: string }} params
   * @returns {Promise<string>} titleId
   */
  async findOrCreateTitleId({ title, type, genre, totalEpisodes, userId }) {
    const { data: existing, error: findError } = await TitlesRepository.findByTitleAndType(title, type);
    if (findError) throw toAppError(findError, "Couldn't look up that title.");
    if (existing) return existing.id;

    const { data: created, error: createError } = await TitlesRepository.create({
      title,
      type,
      genre: genre || null,
      total_episodes: totalEpisodes || null,
      created_by: userId,
    });
    if (createError) throw toAppError(createError, "Couldn't add that title to the catalogue.");
    return created.id;
  },

  /**
   * The TMDB-sourced counterpart to findOrCreateTitleId. Dedupes on
   * `tmdb_id` (the reliable key — two different shows can share a
   * title) rather than (title, type). Accepts a `Title`-shaped
   * object as returned by TMDBService.search / GlobalTitleSearchService.
   *
   * If `title.id` is already set (e.g. the caller got this result
   * from the local-catalogue fallback, which only returns titles
   * already in our DB), it's returned as-is — no lookup needed.
   * @param {import('../types').Title & { userId: string }} title
   * @returns {Promise<string>} titleId
   */
  async findOrCreateFromTmdb(title) {
    if (title.id) return title.id;

    const { data: existing, error: findError } = await TitlesRepository.findByTmdbId(title.tmdbId);
    if (findError) throw toAppError(findError, "Couldn't look up that title.");
    if (existing) return existing.id;

    const { data: created, error: createError } = await TitlesRepository.create({
      title: title.title,
      type: title.type,
      genre: title.genre || null,
      total_episodes: title.totalEpisodes || null,
      created_by: title.userId,
      tmdb_id: title.tmdbId,
      imdb_id: title.imdbId || null,
      poster_url: title.posterUrl || null,
      backdrop_url: title.backdropUrl || null,
      overview: title.overview || null,
      release_year: title.releaseYear || null,
      runtime: title.runtime || null,
      popularity: title.popularity ?? null,
      original_title: title.originalTitle || null,
      language: title.language || null,
      status: title.status || null,
      vote_average: title.voteAverage ?? null,
    });

    if (!createError) return created.id;

    // 23505 = unique_violation. Two possible causes, both recoverable:
    //  (a) a race — another request imported the same tmdb_id first
    //  (b) a pre-existing manual entry with the same (title, type)
    //      but no tmdb_id yet (the titles.unique(title, type)
    //      constraint fires). We don't enrich that row with TMDB
    //      metadata here — `titles` has no client-side UPDATE policy
    //      by design (see schema.sql) — we just point the user's
    //      library entry at the existing row.
    if (createError.code === "23505") {
      const { data: byTmdb } = await TitlesRepository.findByTmdbId(title.tmdbId);
      if (byTmdb) return byTmdb.id;

      const { data: byTitleType } = await TitlesRepository.findByTitleAndType(title.title, title.type);
      if (byTitleType) return byTitleType.id;
    }

    throw toAppError(createError, "Couldn't add that title to the catalogue.");
  },
};
