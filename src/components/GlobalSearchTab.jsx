import React, { useState } from "react";
import { Film, Tv, Plus } from "lucide-react";
import { styles } from "../styles";
import { useGlobalTitleSearch } from "../hooks/useGlobalTitleSearch";
import { LoadingState, ErrorBanner } from "./StateViews";
import { PosterImage } from "./PosterImage";

/**
 * Rendered inside TitleForm when the person switches to "Search"
 * mode. Every result's Add button calls `onAdd(title)`, where `title`
 * is a `Title`-shaped object (see src/types) — the parent is
 * responsible for turning that into a library entry via
 * useUserLibrary.addTitleFromTmdb.
 */
export function GlobalSearchTab({ onAdd, adding }) {
  const [query, setQuery] = useState("");
  const { results, loading, error, hasQuery } = useGlobalTitleSearch(query);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        autoFocus
        style={styles.input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search movies & TV shows…"
        aria-label="Search movies and TV shows"
      />

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingState label="Searching…" />
      ) : !hasQuery ? (
        <EmptyHint text="Start typing to search for a movie or TV show." />
      ) : results.length === 0 ? (
        <EmptyHint text={`No matches for "${query.trim()}". Try a different title, or switch to Manual.`} />
      ) : (
        <div style={styles.searchResultsList} className="memora-scroll">
          {results.map((result) => (
            <SearchResultRow
              key={`${result.type}-${result.tmdbId ?? result.id}`}
              result={result}
              disabled={adding}
              onAdd={() => onAdd(result)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyHint({ text }) {
  return <p style={styles.searchHintText}>{text}</p>;
}

function SearchResultRow({ result, onAdd, disabled }) {
  return (
    <div style={styles.searchResultRow}>
      <PosterImage src={result.posterUrl} title={result.title} style={styles.searchResultPoster} initialsSize={13} />
      <div style={styles.searchResultInfo}>
        <p style={styles.searchResultTitle}>{result.title}</p>
        <p style={styles.searchResultMeta}>
          {result.type === "tv" ? <Tv size={11} /> : <Film size={11} />}
          {result.releaseYear || "—"}
        </p>
      </div>
      <button type="button" style={styles.searchResultAddBtn} onClick={onAdd} disabled={disabled} aria-label={`Add ${result.title} to your library`}>
        <Plus size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
