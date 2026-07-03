/**
 * Centralized error handling. Every repository call is wrapped by a
 * service, and every service throws AppError instead of letting a
 * raw PostgrestError leak into hooks/components. This is the one
 * place that decides what an error message looks like and the one
 * place you'd wire up Sentry/Bugsnag/etc. later.
 */

export class AppError extends Error {
  /**
   * @param {string} message  user-facing message
   * @param {{ code?: string, cause?: unknown }} [options]
   */
  constructor(message, { code = "UNKNOWN", cause } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Normalizes a Supabase/Postgrest error (or anything else thrown)
 * into an AppError with a message safe to show a user.
 * @param {unknown} error
 * @param {string} fallbackMessage
 * @returns {AppError}
 */
export function toAppError(error, fallbackMessage) {
  if (error instanceof AppError) return error;

  const code = error?.code || "UNKNOWN";
  const message = humanizeSupabaseError(error) || fallbackMessage;
  return new AppError(message, { code, cause: error });
}

function humanizeSupabaseError(error) {
  if (!error) return null;
  // 23505 = unique_violation. UserLibraryService.addTitle checks for
  // this case explicitly and throws a more specific AppError before
  // a raw insert error would ever reach here — this is the fallback
  // for any other unique-constraint hit (e.g. the titles table).
  if (error.code === "23505") return "This title is already in your library.";
  // PGRST301 / 401-ish = RLS / auth rejected the request
  if (error.code === "PGRST301" || error.status === 401) {
    return "Your session expired. Please sign in again.";
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You're offline. Changes will sync once you're back online.";
  }
  return error.message || null;
}

/**
 * Single funnel for logging errors. Swap the console.error for a
 * reporting SDK call when one is added — nothing upstream changes.
 * @param {unknown} error
 * @param {string} [context]
 */
export function logError(error, context = "") {
  // eslint-disable-next-line no-console
  console.error(`[Memora]${context ? ` ${context}:` : ""}`, error);
}
