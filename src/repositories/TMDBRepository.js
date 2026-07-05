import { supabase } from "../lib/supabaseClient";
import { searchDebug, debugFormat } from "../utils/searchDebug"; // TEMPORARY debug
/**
 * Repository layer for TMDB access. Notably, this does NOT call
 * api.themoviedb.org — it calls Memora's own `tmdb-search` Supabase
 * Edge Function, which holds the TMDB API key as a server-side
 * secret. This file, and therefore the client bundle, never contains
 * a TMDB credential. See supabase/functions/tmdb-search/index.ts.
 */
export const TMDBRepository = {
  /**
   * @param {string} query
   * @returns {Promise<{ data: { results: any[] }|null, error: Error|null }>}
   */
  async searchMulti(query) {
  const result = await supabase.functions.invoke("tmdb-search", {
    body: { query },
  });

  searchDebug.set("repoReturned", result);
  searchDebug.set(
    "invokeError",
    result.error ? debugFormat(result.error) : "null"
  );

  return result;
},
};