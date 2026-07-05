import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, Tv, Star, Play, CheckCircle2, Bookmark, RotateCcw, Plus, Minus, FastForward } from "lucide-react";
import { styles } from "../styles";
import { PosterImage } from "./PosterImage";
import { colorForTitle } from "./Shared";
import { useLibraryMutations } from "../hooks/useLibraryMutations";
import { useDebouncedValue } from "../utils/useDebouncedValue";
import { RatingControl } from "./RatingControl";
import { Toast } from "./Toast";

/**
 * Full-page Title Details screen -- production version.
 *
 * Self-contained (owns its own useLibraryMutations), consistent with
 * every other screen. All writes go through the existing
 * UserLibraryService.updateEntry flow; no new service, no schema
 * change, no auth/search/TMDB changes.
 *
 * Local draft state: the `entry` prop is a snapshot taken when the
 * screen opened, so rating/notes/progress edits are held in local
 * state here (initialized from the snapshot) rather than read back
 * from the prop -- the DB is updated immediately/debounced, and the
 * underlying screens refetch on back-navigation (App remounts them).
 *
 * Save strategies, per control:
 * - Status buttons + rating: save IMMEDIATELY on tap (single,
 *   deliberate gestures).
 * - Notes: auto-save, debounced 900ms after typing stops.
 * - Season/Episode steppers + Next Episode: debounced 700ms, so
 *   tapping "+" five times fast produces one write, not five.
 *
 * Rewatch remains UI-only: the schema's status constraint allows
 * exactly watchlist/watching/watched (documented since the previous
 * step; unchanged because schema changes are out of scope).
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
  const mutations = useLibraryMutations(userId || "");
  const canPersist = !!userId;

  // Runtime field resolution, verified against the actual shapes in
  // this project: LibraryEntry (what this screen receives today)
  // carries `runtimeMinutes` (see UserLibraryService.toLibraryEntry);
  // the Title shape from catalogue/TMDB search carries `runtime`
  // (see GlobalTitleSearchService.toTitle). Prefer the former, fall
  // back to the latter, render nothing when both are absent.
  const runtimeValue =
    typeof entry.runtimeMinutes === "number" && entry.runtimeMinutes > 0
      ? entry.runtimeMinutes
      : typeof entry.runtime === "number" && entry.runtime > 0
        ? entry.runtime
        : null;

  // --- local drafts, seeded from the entry snapshot ---
  const [selectedAction, setSelectedAction] = useState(initialAction(entry.status));
  const [rating, setRating] = useState(entry.rating || 0);
  const [notes, setNotes] = useState(entry.notes || "");
  const [season, setSeason] = useState(entry.currentSeason || 1);
  const [episode, setEpisode] = useState(entry.currentEpisode || 0);

  // --- feedback state ---
  const [toast, setToast] = useState(null); // { message, kind }
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [notesSaveState, setNotesSaveState] = useState("idle"); // idle | saving | saved

  function showToast(message, kind = "success") {
    setToast({ message, kind });
  }

  // ---------------------------------------------------------------
  // Status buttons -- immediate save (unchanged flow from last step,
  // now with toast feedback instead of the inline text).
  // ---------------------------------------------------------------
  const ACTION_TO_STATUS = { watching: "watching", completed: "watched", plan: "watchlist" };
  const actions = [
    { key: "watching", label: "Watching", icon: Play },
    { key: "completed", label: "Completed", icon: CheckCircle2 },
    { key: "plan", label: "Plan to Watch", icon: Bookmark },
    { key: "rewatch", label: "Rewatch", icon: RotateCcw },
  ];

  async function handleAction(key) {
    const previous = selectedAction;
    setSelectedAction(key);
    const status = ACTION_TO_STATUS[key];
    if (!status || !canPersist) return; // rewatch, or userId not wired

    const ok = await mutations.updateEntry(entry.id, { status });
    if (ok) {
      showToast("Status updated");
      onStatusChanged?.();
    } else {
      setSelectedAction(previous);
      showToast(mutations.error || "Couldn't update status", "error");
    }
  }

  // ---------------------------------------------------------------
  // Rating -- immediate save on star tap.
  // ---------------------------------------------------------------
  async function handleRating(storedValue) {
    const previous = rating;
    setRating(storedValue);
    if (!canPersist) return;
    const ok = await mutations.updateEntry(entry.id, { rating: storedValue });
    if (ok) showToast("Rating saved");
    else {
      setRating(previous);
      showToast(mutations.error || "Couldn't save rating", "error");
    }
  }

  // ---------------------------------------------------------------
  // Notes -- debounced auto-save, 900ms after typing stops. The
  // skip-first-run ref prevents a pointless save on mount.
  // ---------------------------------------------------------------
  const debouncedNotes = useDebouncedValue(notes, 900);
  const notesInitialized = useRef(false);
  useEffect(() => {
    if (!notesInitialized.current) {
      notesInitialized.current = true;
      return;
    }
    if (!canPersist) return;
    if (debouncedNotes === (entry.notes || "") && notesSaveState === "idle") return;

    let active = true;
    setNotesSaveState("saving");
    mutations.updateEntry(entry.id, { notes: debouncedNotes }).then((ok) => {
      if (!active) return;
      setNotesSaveState(ok ? "saved" : "idle");
      if (!ok) showToast(mutations.error || "Couldn't save notes", "error");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNotes]);

  // ---------------------------------------------------------------
  // TV progress -- steppers + Next Episode, debounced 700ms so rapid
  // taps coalesce into one write.
  // ---------------------------------------------------------------
  const progress = { season, episode };
  const debouncedProgress = useDebouncedValue(progress, 700);
  const progressInitialized = useRef(false);
  useEffect(() => {
    if (!progressInitialized.current) {
      progressInitialized.current = true;
      return;
    }
    if (!canPersist || !isTv) return;

    let active = true;
    mutations
      .updateEntry(entry.id, { currentSeason: debouncedProgress.season, currentEpisode: debouncedProgress.episode })
      .then((ok) => {
        if (!active) return;
        if (ok) showToast("Progress saved");
        else showToast(mutations.error || "Couldn't save progress", "error");
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedProgress.season, debouncedProgress.episode]);

  const atFinalEpisode = !!entry.totalEpisodes && episode >= entry.totalEpisodes;

  return (
    <div style={styles.detailsScreenWrap}>
      {/* Scoped keyframes for the hero skeleton shimmer -- kept local so
          no global stylesheet change is needed. */}
      <style>{`@keyframes memoraShimmer { from { background-position: 200% 0; } to { background-position: -20% 0; } }`}</style>

      {/* Hero backdrop with skeleton while loading */}
      <div style={styles.detailsScreenHero}>
        {!backdropLoaded && (
          <div style={{ ...styles.heroSkeleton, animation: "memoraShimmer 1.4s ease infinite" }} aria-hidden="true" />
        )}
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
        {!entry.backdropUrl && (
          <div style={{ ...styles.detailsScreenHeroFallback, background: `linear-gradient(160deg, ${color}, #12121A)` }} />
        )}
        <div style={styles.detailsScreenHeroGradient} />
        <button type="button" style={styles.detailsScreenBackBtn} onClick={onBack} aria-label="Go back">
          <ArrowLeft size={17} />
        </button>
      </div>

      {/* Poster + headline */}
      <div style={styles.detailsScreenHeadRow}>
        <PosterImage src={entry.posterUrl} title={entry.title} style={styles.detailsScreenPoster} initialsSize={26} />
        <div style={styles.detailsScreenHeadInfo}>
          <h1 style={styles.detailsScreenTitle}>{entry.title}</h1>
          {entry.originalTitle && entry.originalTitle !== entry.title && (
            <p style={styles.detailsScreenOriginalTitle}>{entry.originalTitle}</p>
          )}
        </div>
      </div>

      {/* Metadata badges: type, year, rating, runtime/progress, status, language, genre */}
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
        {!isTv && runtimeValue ? <span style={styles.detailsBadge}>{formatRuntime(runtimeValue)}</span> : null}
        {isTv && (
          <span style={styles.detailsBadge}>
            S{season} · E{episode}
            {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""}
          </span>
        )}
        {entry.titleStatus && <span style={styles.detailsBadge}>{entry.titleStatus}</span>}
        {entry.language && <span style={styles.detailsBadge}>{entry.language.toUpperCase()}</span>}
        {entry.genre && <span style={{ ...styles.detailsBadge, color: "#4FB3A9" }}>{entry.genre}</span>}
      </div>

      {/* Status buttons */}
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

      {/* Personal rating */}
      <div style={styles.detailsCardSection}>
        <p style={styles.detailsSectionTitle}>Your rating</p>
        <RatingControl value={rating} onSelect={handleRating} disabled={mutations.saving} />
        <p style={styles.ratingScaleHint}>
          {rating ? `${rating * 2} / 10` : "Tap a star to rate"}
        </p>
      </div>

      {/* TV progress -- hidden entirely for movies */}
      {isTv && (
        <div style={styles.detailsCardSection}>
          <p style={styles.detailsSectionTitle}>Your progress</p>
          <div style={styles.progressGrid}>
            <Stepper label="Season" value={season} min={1} onChange={setSeason} />
            <Stepper label="Episode" value={episode} min={0} max={entry.totalEpisodes || undefined} onChange={setEpisode} />
            <button
              type="button"
              style={{ ...styles.nextEpisodeBtn, ...(atFinalEpisode ? { opacity: 0.5, cursor: "default" } : {}) }}
              onClick={() => !atFinalEpisode && setEpisode((e) => e + 1)}
              disabled={atFinalEpisode}
              aria-label="Mark next episode watched"
            >
              <FastForward size={15} strokeWidth={2.4} />
              Next Episode
            </button>
          </div>
        </div>
      )}

      {/* Personal notes -- debounced auto-save */}
      <div style={styles.detailsCardSection}>
        <p style={styles.detailsSectionTitle}>Your notes</p>
        <textarea
          style={styles.notesTextarea}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaveState("idle");
          }}
          placeholder="Thoughts, quotes, why you loved it..."
          aria-label="Your notes"
        />
        <p style={styles.notesSaveHint} aria-live="polite">
          {notesSaveState === "saving" ? "Saving…" : notesSaveState === "saved" ? "Saved" : "\u00A0"}
        </p>
      </div>

      {/* Overview */}
      {entry.overview && (
        <div style={styles.detailsScreenSection}>
          <p style={styles.detailsSectionTitle}>Overview</p>
          <p style={{ ...styles.detailsOverviewText, marginTop: 8 }}>{entry.overview}</p>
        </div>
      )}

      <Toast message={toast?.message || null} kind={toast?.kind || "success"} onDone={() => setToast(null)} />
    </div>
  );
}

function Stepper({ label, value, min = 0, max, onChange }) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <div style={styles.stepperGroup}>
      <span style={styles.stepperLabel}>{label}</span>
      <div style={styles.stepperRow}>
        <button
          type="button"
          style={{ ...styles.stepperBtn, ...(atMin ? { opacity: 0.35, cursor: "default" } : {}) }}
          onClick={() => !atMin && onChange(value - 1)}
          disabled={atMin}
          aria-label={`Decrease ${label.toLowerCase()}`}
        >
          <Minus size={14} />
        </button>
        <span style={styles.stepperValue} aria-live="polite">{value}</span>
        <button
          type="button"
          style={{ ...styles.stepperBtn, ...(atMax ? { opacity: 0.35, cursor: "default" } : {}) }}
          onClick={() => !atMax && onChange(value + 1)}
          disabled={atMax}
          aria-label={`Increase ${label.toLowerCase()}`}
        >
          <Plus size={14} />
        </button>
      </div>
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
