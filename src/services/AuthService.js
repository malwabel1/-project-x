import { supabase } from "../lib/supabaseClient";
import { toAppError } from "../utils/errors";

/**
 * Service layer for authentication. Auth doesn't fit the
 * repository/service split as cleanly as data tables (there's no
 * "AuthRepository" table to query), so this wraps supabase.auth
 * directly — but it's still the only file outside lib/supabaseClient.js
 * that touches supabase.auth. Hooks call this, never supabase.auth.
 */
export const AuthService = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw toAppError(error, "Couldn't check your session.");
    return data.session;
  },

  /**
   * @param {(event: string, session: import('@supabase/supabase-js').Session|null) => void} callback
   * @returns {() => void} unsubscribe
   */
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
  },

  /**
   * @param {string} email
   * @param {string} password
   */
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toAppError(error, "Couldn't sign you in. Check your email and password.");
  },

  /**
   * @param {string} email
   * @param {string} password
   */
  async signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw toAppError(error, "Couldn't create your account.");
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw toAppError(error, "Couldn't sign you out.");
  },
};
