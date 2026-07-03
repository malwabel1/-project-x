import React, { useEffect, useState } from "react";
import { Search as SearchIcon, X, Plus } from "lucide-react";
import { styles } from "../styles";
import { useGlobalTitleSearch } from "../hooks/useGlobalTitleSearch";
import { useLibraryMutations } from "../hooks/useLibraryMutations";
import { LoadingState, ErrorBanner } from "./StateViews";
import { PosterImage } from "./PosterImage";
import { cache } from "../utils/cache";

const RECENT_LIMIT = 8;

function recentSearchesKey(userId) {
  return `recent-searches:${userId}`;
}

/**
 * Main "Search" tab (Milestone 2) — distinct from the Add-title
 * modal's embedded GlobalSearchTab, though both share the same
 * useGlobalTitleSearch hook and GlobalTitleSearchService underneath;
 * this screen just adds recent-search history on top, persisted via
 * the existing cache.js localStorage abstraction (no new storage
 * mechanism), and adds results via its own useLibraryMutations
 * instance (write-only — this screen doesn't render a library list
 * of its own, so a full useUserLibrary fetch would be wasted work).
 * Debouncing, loading, and empty states all come from the shared
 * search hook — nothing new to implement for those here.
 *
 * @param {{ userId: string }} props
 */
export function SearchScreen({ userId }) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(() => cache.get(recentSearchesKey(userId)) || []);
  const { results, loading, error, hasQuery } = useGlobalTitleSearch(query);
  const mutations = useLibraryMutations(userId);

  function commitSearch(term) {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_LIMIT);
      cache.set(recentSearchesKey(userId), next);
      return next;
    });
  }

  // Records a search once it actually returns results, not on every
  // keystroke — so "recent searches" reflects real searches, not
  // partial typing.
  useEffect(() => {
    if (hasQuery && !loading && results.length > 0) commitSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, loading]);

  function clearHistory() {
    setRecent([]);
    cache.remove(recentSearchesKey(userId));
  }

  return (
    <div>
      <div style={styles.searchScreenInputWrap}>
        <SearchIcon size={16} color="#8A8798" />
        <input
          autoFocus
          style={styles.searchScreenInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search movies & TV shows…"
          aria-label="Search movies and TV shows"
        />
        {query && (
          <button type="button" style={styles.iconBtn} onClick={() => setQuery("")} aria-label="Clear search input">
            <X size={15} />
          </button>
        )}
      </div>

      <ErrorBanner message={error} />
      <ErrorBanner message={mutations.error} />

      {!hasQuery && recent.length > 0 && (
        <>
          <div style={styles.recentSearchRow}>
            <p style={styles.settingsSectionTitle}>Recent searches</p>
            <button type="button" style={styles.viewAllLink} onClick={clearHistory}>
              Clear history
            </button>
          </div>
          <div style={styles.recentSearchChips}>
            {recent.map((term) => (
              <button key={term} type="button" style={styles.recentSearchChip} onClick={() => setQuery(term)}>
                {term}
              </button>
            ))}
          </div>
        </>
      )}

      {loading ? (
        <LoadingState label="Searching…" />
      ) : !hasQuery ? (
        recent.length === 0 && <p style={styles.searchHintText}>Search for a movie or TV show to add it to your library.</p>
      ) : results.length === 0 ? (
        <p style={styles.searchHintText}>{`No matches for "${query.trim()}".`}</p>
      ) : (
        <div style={styles.searchResultsList} className="memora-scroll">
          {results.map((result) => (
            <SearchScreenRow
              key={`${result.type}-${result.tmdbId ?? result.id}`}
              result={result}
              onAdd={() => mutations.addTitleFromTmdb(result, { status: "watchlist" })}
              disabled={mutations.saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchScreenRow({ result, onAdd, disabled }) {
  return (
    <div style={styles.searchResultRow}>
      <PosterImage src={result.posterUrl} title={result.title} style={styles.searchResultPoster} initialsSize={13} />
      <div style={styles.searchResultInfo}>
        <p style={styles.searchResultTitle}>{result.title}</p>
        <p style={styles.searchResultMeta}>
          {result.type === "tv" ? "TV show" : "Movie"} · {result.releaseYear || "—"}
        </p>
      </div>
      <button type="button" style={styles.searchResultAddBtn} onClick={onAdd} disabled={disabled} aria-label={`Add ${result.title} to your library`}>
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
