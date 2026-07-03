import { useEffect } from "react";

/**
 * Calls `onIntersect` when the element behind `ref` scrolls into
 * view. Used to trigger `loadMore()` from a sentinel div at the
 * bottom of a paginated list instead of a manual "Load more" click
 * handler — drop the sentinel in, wire this up, done.
 * @param {import('react').RefObject<Element>} ref
 * @param {() => void} onIntersect
 * @param {{ enabled?: boolean, rootMargin?: string }} [options]
 */
export function useInfiniteScroll(ref, onIntersect, { enabled = true, rootMargin = "200px" } = {}) {
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, onIntersect, enabled, rootMargin]);
}
