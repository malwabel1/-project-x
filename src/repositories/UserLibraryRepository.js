import { supabase } from "../lib/supabaseClient";

const SELECT_COLUMNS =
  "id, status, rating, notes, current_season, current_episode, added_at, titles!inner(id, title, type, genre, total_episodes, poster_url, backdrop_url, overview, release_year, status, vote_average, runtime)";

/**
 * Repository layer for `user_titles`. Same rule as TitlesRepository:
 * raw Supabase in, raw { data, error, count } out. UserLibraryService
 * is the only caller.
 */
export const UserLibraryRepository = {
  /**
   * Paginated, optionally status-filtered, optionally server-side
   * searched fetch. `titles!inner` makes the join required, which is
   * what lets `.ilike("titles.title", ...)` filter on the joined
   * table instead of the client filtering in memory.
   * @param {{ userId: string, status?: string, search?: string, limit: number, offset: number }} params
   */
  async fetchPage({ userId, status, search, limit, offset }) {
    let query = supabase
      .from("user_titles")
      .select(SELECT_COLUMNS, { count: "exact" })
      .eq("user_id", userId);

    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("titles.title", `%${search}%`);

    return query.order("added_at", { ascending: false }).range(offset, offset + limit - 1);
  },

  /**
   * Unpaginated fetch, used only for the Stats screen where every
   * row needs to be aggregated client-side.
   * @param {string} userId
   */
  async fetchAll(userId) {
    return supabase
      .from("user_titles")
      .select(SELECT_COLUMNS)
      .eq("user_id", userId)
      .order("added_at", { ascending: false });
  },

  /**
   * One lightweight count per status, for the tab badges. Three
   * small `head: true` requests are cheaper than pulling rows just
   * to count them, and each is independently cacheable.
   * @param {string} userId
   * @param {import('../types').LibraryStatus} status
   */
  async countByStatus(userId, status) {
    return supabase
      .from("user_titles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", status);
  },

  /**
   * Looks up whether this user is already tracking this title.
   * Used as an existence check before insert, so
   * UserLibraryService can return a friendly error instead of
   * letting a unique-constraint violation surface as a raw DB error.
   * @param {string} userId
   * @param {string} titleId
   */
  async findByUserAndTitle(userId, titleId) {
    return supabase
      .from("user_titles")
      .select("id")
      .eq("user_id", userId)
      .eq("title_id", titleId)
      .maybeSingle();
  },

  /**
   * Single-row lookup by id, with the title name attached. Used by
   * UserLibraryService to know the "before" state when logging
   * Recent Activity (e.g. what status a title is moving *from*), and
   * to get a title name for the log entry right before a delete.
   * @param {string} id
   */
  async findById(id) {
    return supabase.from("user_titles").select("status, rating, title_id, titles(title)").eq("id", id).maybeSingle();
  },

  /**
   * Safe insert: upserts on the (user_id, title_id) unique
   * constraint with `ignoreDuplicates: true` instead of a plain
   * insert. If a duplicate exists this resolves with no row and no
   * error — it never throws a raw 23505 unique-violation — so the
   * only place that decides what "duplicate" means to the user is
   * UserLibraryService (which checks via findByUserAndTitle first
   * and treats an empty upsert result as a belt-and-suspenders
   * fallback for the rare race where two inserts land at once).
   * @param {{ user_id: string, title_id: string, status: string, rating?: number, notes?: string|null, current_season?: number, current_episode?: number }} payload
   */
  async insert(payload) {
    return supabase
      .from("user_titles")
      .upsert(payload, { onConflict: "user_id,title_id", ignoreDuplicates: true })
      .select("id");
  },

  /**
   * @param {string} id
   * @param {Record<string, unknown>} patch
   */
  async update(id, patch) {
    return supabase.from("user_titles").update(patch).eq("id", id);
  },

  /** @param {string} id */
  async remove(id) {
    return supabase.from("user_titles").delete().eq("id", id);
  },
};
