import { useEffect, useState } from "react";

/**
 * @param {string} query  a CSS media query string, e.g. "(min-width: 768px)"
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== "undefined" ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler); // Safari <14 fallback

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [query]);

  return matches;
}

// Shared breakpoints so every component checks the same thresholds.
export const BREAKPOINTS = {
  tablet: "(min-width: 768px)",
  desktop: "(min-width: 1024px)",
  largeDesktop: "(min-width: 1440px)",
};
