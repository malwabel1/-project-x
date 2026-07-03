import { ActivityRepository } from "../repositories/ActivityRepository";
import { toAppError, logError } from "../utils/errors";

/**
 * Service layer for the Recent Activity feed. `log()` is called by
 * UserLibraryService alongside its own mutations (add/status-change/
 * rate/remove) — it is deliberately best-effort: a logging failure
 * is reported via logError but never thrown, so it can never roll
 * back or block the mutation it's describing.
 */
export const ActivityService = {
  /**
   * @param {string} userId
   * @param {{ titleId?: string|null, titleName: string, action: 'added'|'status_changed'|'rated'|'removed', detail?: object }} entry
   */
  async log(userId, { titleId, titleName, action, detail }) {
    const { error } = await ActivityRepository.insert({
      user_id: userId,
      title_id: titleId || null,
      title_name: titleName,
      action,
      detail: detail || null,
    });
    if (error) logError(error, "ActivityService.log");
  },

  /**
   * @param {string} userId
   * @param {number} [limit]
   * @returns {Promise<import('../types').ActivityItem[]>}
   */
  async getRecent(userId, limit = 20) {
    const { data, error } = await ActivityRepository.fetchRecent(userId, limit);
    if (error) throw toAppError(error, "Couldn't load recent activity.");
    return data.map(toActivityItem);
  },
};

function toActivityItem(row) {
  return {
    id: row.id,
    titleId: row.title_id,
    titleName: row.title_name,
    action: row.action,
    detail: row.detail || {},
    createdAt: row.created_at,
  };
}
