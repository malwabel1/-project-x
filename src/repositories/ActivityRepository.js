import { supabase } from "../lib/supabaseClient";

/**
 * Repository layer for `activity_log`. Same rule as every other
 * repository: raw Supabase in, raw { data, error } out. ActivityService
 * is the only caller.
 */
export const ActivityRepository = {
  /**
   * @param {{ user_id: string, title_id: string|null, title_name: string, action: string, detail: object|null }} payload
   */
  async insert(payload) {
    return supabase.from("activity_log").insert(payload);
  },

  /**
   * @param {string} userId
   * @param {number} limit
   */
  async fetchRecent(userId, limit) {
    return supabase
      .from("activity_log")
      .select("id, title_id, title_name, action, detail, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
  },
};
