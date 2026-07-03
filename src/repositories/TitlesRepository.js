import { supabase } from "../lib/supabaseClient";

/**
 * Repository layer: the ONLY place that talks to Supabase for the
 * `titles` table. Returns raw { data, error } like the client does —
 * no domain mapping, no thrown errors. TitlesService is responsible
 * for turning this into domain objects and AppErrors. Keeping this
 * layer "dumb" is what makes it trivial to swap Supabase for another
 * backend later: rewrite this file, touch nothing else.
 */
export const TitlesRepository = {
  /**
   * @param {string} title
   * @param {import('../types').TitleType} type
   */
  async findByTitleAndType(title, type) {
    return supabase.from("titles").select("id").eq("title", title).eq("type", type).maybeSingle();
  },

  /**
   * Looks up a title by its TMDB id — the primary dedupe key for
   * anything imported from TMDB (see idx_titles_tmdb_id in schema.sql).
   * @param {number} tmdbId
   */
  async findByTmdbId(tmdbId) {
    return supabase.from("titles").select("id").eq("tmdb_id", tmdbId).maybeSingle();
  },

  /**
   * Accepts either a bare manual-entry payload or a full TMDB-sourced
   * payload with the metadata columns from the v2 schema — all of
   * those are optional/nullable, so one insert covers both cases.
   * @param {{
   *   title: string, type: string, genre?: string|null, total_episodes?: number|null, created_by: string,
   *   tmdb_id?: number|null, imdb_id?: string|null, poster_url?: string|null, backdrop_url?: string|null,
   *   overview?: string|null, release_year?: number|null, runtime?: number|null, popularity?: number|null,
   *   original_title?: string|null, language?: string|null, status?: string|null
   * }} payload
   */
  async create(payload) {
    return supabase.from("titles").insert(payload).select("id").single();
  },
};
