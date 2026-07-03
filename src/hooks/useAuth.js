import { useEffect, useState } from "react";
import { AuthService } from "../services/AuthService";
import { logError } from "../utils/errors";

/**
 * Tracks the current session and exposes sign-in/up/out. Talks only
 * to AuthService — never to supabase.auth directly.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    AuthService.getSession()
      .then((s) => active && setSession(s))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));

    const unsubscribe = AuthService.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    setError(null);
    try {
      await AuthService.signIn(email, password);
      return true;
    } catch (e) {
      setError(e.message);
      logError(e, "signIn");
      return false;
    }
  }

  async function signUp(email, password) {
    setError(null);
    try {
      await AuthService.signUp(email, password);
      return true;
    } catch (e) {
      setError(e.message);
      logError(e, "signUp");
      return false;
    }
  }

  async function signOut() {
    try {
      await AuthService.signOut();
    } catch (e) {
      logError(e, "signOut");
    }
  }

  return { session, user: session?.user ?? null, loading, error, signIn, signUp, signOut };
}
