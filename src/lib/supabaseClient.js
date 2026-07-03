import { createClient } from "@supabase/supabase-js";

// Vite-style env vars. If you're on Create React App / Next.js,
// rename these to REACT_APP_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL
// and swap import.meta.env for process.env accordingly.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
