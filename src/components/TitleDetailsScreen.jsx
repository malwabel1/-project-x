import React, { useState } from "react";
import { ArrowLeft, Film, Tv, Star, Play, CheckCircle2, Bookmark, RotateCcw } from "lucide-react";
import { styles } from "../styles";
import { PosterImage } from "./PosterImage";
import { colorForTitle } from "./Shared";

/**
 * Full-page Title Details screen (as opposed to TitleDetailsModal,
 * which remains in the codebase untouched). Purely presentational:
 * receives a LibraryEntry and renders it -- no service, repository,
 * or supabase import, consistent with every other component.
 *
 * The four action buttons are UI-only for now, per spec: they hold
 * a local "selected" highlight (initialized from the entry's current
 * status where one maps cleanly) but persist nothing. Wiring them to
 * UserLibraryService via the owning screen's hook is the documented
 * next step -- the `onAction` prop is already threaded for it.
 *
 * Field notes, stated honestly rather than papered over:
 * - Genres: the schema stores a single `genre` string (set for
 *   manual entries; TMDB search results don't include genre names
 *   without a details-endpoint call). Shown when present, omitted
 *   when null -- no fabricated placeholder chips.
 * - Runtime/Seasons: `runtimeMinutes` shows for movies when known;
 *   TV shows show current progress + total episodes when known.
 *   TMDB-sourced titles won't have runtime until a /movie|tv/{id}
 *   details call is added (documented limitation since the TMDB
 *   integration milestone).
 *
 * @param {{
 *   entry: import('../types').LibraryEntry,
 *   onBack: () => void,
 *   onAction?: (action: 'watching'|'completed'|'plan'|'rewatch') => void,
 * }} props
 */
export function TitleDetailsScreen({ entry, onBack, onAction }) {
  const isTv = entry.type === "tv";
  const color = colorForTitle(entry.title);
  const [selectedAction, setSelectedAction] = useState(initialAction(entry.status));
  const [backdropLoaded, setBackdropLoaded] = useState(false);

  const actions = [
    { key: "watching", label: "Watching", icon: Play },
    { key: "completed", label: "Completed", icon: CheckCircle2 },
    { key: "plan", label: "Plan to Watch", icon: Bookmark },
    { key: "rewatch", label: "Rewatch", icon: RotateCcw },
  ];

  function handleAction(key) {
    setSelectedAction(key); // UI-only highlight for now
    onAction?.(key);
  }

  return (
    <div style={styles.detailsScreenWrap}>
      {/* Hero backdrop */}
      <div style={styles.detailsScreenHero}>
        {entry.backdropUrl ? (
          <img
            src={entry.backdropUrl}
            alt=""
            loading="lazy"
            onLoad={() => setBackdropLoaded(true)}
            onError={() => setBackdropLoaded(false)}
            style={{ ...styles.detailsScreenHeroImg, opacity: backdropLoaded ? 1 : 0 }}
          />
        ) : null}
        {(!entry.backdropUrl || !backdropLoaded) && (
          <div style={{ ...styles.detailsScreenHeroFallback, background: `linear-gradient(160deg, ${color}, #12121A)` }} />
        )}
        <div style={styles.detailsScreenHeroGradient} />
        <button type="button" style={styles.detailsScreenBackBtn} onClick={onBack} aria-label="Go back">
          <ArrowLeft size={17} />
        </button>
      </div>

      {/* Poster + headline, overlapping the hero */}
      <div style={styles.detailsScreenHeadRow}>
        <PosterImage src={entry.posterUrl} title={entry.title} style={styles.detailsScreenPoster} initialsSize={24} />
        <div style={styles.detailsScreenHeadInfo}>
          <h1 style={styles.detailsScreenTitle}>{entry.title}</h1>
          {entry.originalTitle && entry.originalTitle !== entry.title && (
            <p style={styles.detailsScreenOriginalTitle}>{entry.originalTitle}</p>
          )}
        </div>
      </div>

      {/* Meta badges */}
      <div style={{ ...styles.detailsMetaRow, padding: "0 20px", marginTop: 12 }}>
        <span style={styles.detailsBadge}>
          {isTv ? <Tv size={12} /> : <Film size={12} />}
          {isTv ? "TV show" : "Movie"}
        </span>
        <span style={styles.detailsBadge}>{entry.releaseYear || "Year unknown"}</span>
        {entry.voteAverage != null && (
          <span style={styles.detailsBadge}>
            <Star size={12} fill="#E8A33D" color="#E8A33D" />
            {entry.voteAverage.toFixed(1)}
          </span>
        )}
        {!isTv && entry.runtimeMinutes ? <span style={styles.detailsBadge}>{formatRuntime(entry.runtimeMinutes)}</span> : null}
        {isTv && (
          <span style={styles.detailsBadge}>
            S{entry.currentSeason || 1} · E{entry.currentEpisode || 0}
            {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""}
          </span>
        )}
        {entry.titleStatus && <span style={styles.detailsBadge}>{entry.titleStatus}</span>}
        {entry.language && <span style={styles.detailsBadge}>{entry.language.toUpperCase()}</span>}
        {entry.genre && <span style={{ ...styles.detailsBadge, color: "#4FB3A9" }}>{entry.genre}</span>}
      </div>

      {/* Action buttons -- UI only for now */}
      <div style={styles.detailsScreenActions}>
        {actions.map(({ key, label, icon: Icon }) => {
          const active = selectedAction === key;
          return (
            <button
              key={key}
              type="button"
              style={{ ...styles.detailsScreenActionBtn, ...(active ? styles.detailsScreenActionBtnActive : {}) }}
              onClick={() => handleAction(key)}
              aria-pressed={active}
            >
              <Icon size={15} strokeWidth={2.2} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {entry.overview && (
        <div style={styles.detailsScreenSection}>
          <p style={styles.detailsSectionTitle}>Overview</p>
          <p style={{ ...styles.detailsOverviewText, marginTop: 8 }}>{entry.overview}</p>
        </div>
      )}

      {/* Personal notes, when present */}
      {entry.notes && (
        <div style={styles.detailsScreenSection}>
          <p style={styles.detailsSectionTitle}>Your notes</p>
          <p style={{ ...styles.detailsOverviewText, marginTop: 8 }}>{entry.notes}</p>
        </div>
      )}
    </div>
  );
}

function initialAction(status) {
  if (status === "watching") return "watching";
  if (status === "watched") return "completed";
  if (status === "watchlist") return "plan";
  return null;
}

function formatRuntime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
