import React, { useState } from "react";
import { ArrowLeft, Film, Tv, Star, Play, CheckCircle2, Bookmark, RotateCcw } from "lucide-react";
import { styles } from "../styles";
import { PosterImage } from "./PosterImage";
import { colorForTitle } from "./Shared";
import { useLibraryMutations } from "../hooks/useLibraryMutations";
import { ErrorBanner } from "./StateViews";

/**
 * Full-page Title Details screen (as opposed to TitleDetailsModal,
 * which remains in the codebase untouched).
 *
 * Action buttons are now wired to real status updates, following the
 * same self-contained-screen pattern as every other screen: this
 * component owns its own useLibraryMutations instance (write-only --
 * no list to paginate here) and calls the existing
 * UserLibraryService.updateEntry flow through it. No new service, no
 * schema change.
 *
 * Build-safety / backwards compatibility: `userId` is optional. If
 * it isn't passed (i.e. App.jsx hasn't been updated yet), the
 * buttons behave exactly as before -- local highlight only, no
 * persistence -- so this file can be applied first without breaking
 * anything.
 *
 * Status mapping:
 *   Watching      → status "watching"
 *   Completed     → status "watched"
 *   Plan to Watch → status "watchlist"
 *   Rewatch       → UI-only. The schema's status check constraint
 *                   allows exactly watchlist/watching/watched -- there
 *                   is no "rewatch" state to persist without a schema
 *                   change, which this step explicitly avoids. The
 *                   button still highlights locally so the UI feels
 *                   responsive, and is labeled in-code for the future.
 *
 * @param {{
 *   entry: import('../types').LibraryEntry,
 *   onBack: () => void,
 *   userId?: string,
 *   onStatusChanged?: () => void,
 * }} props
 */
export function TitleDetailsScreen({ entry, onBack, userId, onStatusChanged }) {
  const isTv = entry.type === "tv";
  const color = colorForTitle(entry.title);
  const [selectedAction, setSelectedAction] = useState(initialAction(entry.status));
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const mutations = useLibraryMutations(userId || "");
  const canPersist = !!userId;

  const ACTION_TO_STATUS = {
    watching: "watching",
    completed: "watched",
    plan: "watchlist",
    // rewatch: intentionally absent -- see the doc comment above.
  };

  const actions = [
    { key: "watching", label: "Watching", icon: Play },
    { key: "completed", label: "Completed", icon: CheckCircle2 },
    { key: "plan", label: "Plan to Watch", icon: Bookmark },
    { key: "rewatch", label: "Rewatch", icon: RotateCcw },
  ];

  async function handleAction(key) {
    const previous = selectedAction;
    setSelectedAction(key); // optimistic highlight
    setSavedNotice(false);

    const status = ACTION_TO_STATUS[key];
    if (!status || !canPersist) return; // rewatch, or App not yet passing userId

    const ok = await mutations.updateEntry(entry.id, { status });
    if (ok) {
      setSavedNotice(true);
      onStatusChanged?.();
    } else {
      setSelectedAction(previous); // roll back the highlight on failure
    }
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

      {/* Action buttons -- wired to real status updates (Rewatch UI-only) */}
      <div style={styles.detailsScreenActions}>
        {actions.map(({ key, label, icon: Icon }) => {
          const active = selectedAction === key;
          return (
            <button
              key={key}
              type="button"
              style={{
                ...styles.detailsScreenActionBtn,
                ...(active ? styles.detailsScreenActionBtnActive : {}),
                ...(mutations.saving ? { opacity: 0.6, cursor: "wait" } : {}),
              }}
              onClick={() => handleAction(key)}
              disabled={mutations.saving}
              aria-pressed={active}
            >
              <Icon size={15} strokeWidth={2.2} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Save feedback */}
      <div style={{ padding: "10px 20px 0" }}>
        <ErrorBanner message={mutations.error} />
        {savedNotice && !mutations.error && (
          <p style={{ margin: 0, fontSize: 12.5, color: "#4FB3A9" }} role="status">
            Saved to your library.
          </p>
        )}
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
