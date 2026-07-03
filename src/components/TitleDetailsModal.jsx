import React, { useEffect, useState } from "react";
import { X, Film, Tv, Star } from "lucide-react";
import { styles } from "../styles";
import { StarRating, colorForTitle } from "./Shared";
import { PosterImage } from "./PosterImage";
import { ErrorBanner } from "./StateViews";

const STATUS_OPTIONS = [
  { key: "watchlist", label: "Watchlist" },
  { key: "watching", label: "Watching" },
  { key: "watched", label: "Watched" },
];

/**
 * Rich, read-plus-edit view of a single library entry. Opened when a
 * TitleCard is clicked (as opposed to TitleForm's pencil icon, which
 * stays as the quick-edit shortcut). This component never talks to a
 * service or supabase directly — `onSave` is `useUserLibrary.updateEntry`,
 * threaded down from App.jsx, same as everywhere else in the app.
 *
 * @param {{
 *   entry: import('../types').LibraryEntry,
 *   onClose: () => void,
 *   onSave: (id: string, patch: Partial<import('../types').LibraryEntryInput>) => Promise<boolean>,
 *   saving: boolean,
 *   error: string|null,
 * }} props
 */
export function TitleDetailsModal({ entry, onClose, onSave, saving, error }) {
  const [status, setStatus] = useState(entry.status);
  const [rating, setRating] = useState(entry.rating);
  const [notes, setNotes] = useState(entry.notes);
  const [currentSeason, setCurrentSeason] = useState(entry.currentSeason);
  const [currentEpisode, setCurrentEpisode] = useState(entry.currentEpisode);
  const [backdropLoaded, setBackdropLoaded] = useState(false);

  // Re-sync local draft if the underlying entry changes (e.g. after a
  // save, or if it was edited elsewhere) — keeps this in step with
  // useUserLibrary's state without owning a separate source of truth.
  useEffect(() => {
    setStatus(entry.status);
    setRating(entry.rating);
    setNotes(entry.notes);
    setCurrentSeason(entry.currentSeason);
    setCurrentEpisode(entry.currentEpisode);
  }, [entry.id, entry.status, entry.rating, entry.notes, entry.currentSeason, entry.currentEpisode]);

  const isTv = entry.type === "tv";
  const color = colorForTitle(entry.title);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(entry.id, {
      status,
      rating,
      notes: notes.trim(),
      currentSeason: isTv ? Number(currentSeason) || 1 : undefined,
      currentEpisode: isTv ? Number(currentEpisode) || 0 : undefined,
    });
  }

  return (
    <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.detailsCard} className="memora-modal-in">
        <div style={styles.detailsBackdropWrap}>
          {entry.backdropUrl ? (
            <img
              src={entry.backdropUrl}
              alt=""
              loading="lazy"
              onLoad={() => setBackdropLoaded(true)}
              onError={() => setBackdropLoaded(false)}
              style={{ ...styles.detailsBackdropImg, opacity: backdropLoaded ? 1 : 0, transition: "opacity 0.4s ease" }}
            />
          ) : null}
          {!entry.backdropUrl || !backdropLoaded ? (
            <div style={{ ...styles.detailsBackdropFallback, background: `linear-gradient(160deg, ${color}, #12121A)` }} />
          ) : null}
          <div style={styles.detailsBackdropGradient} />
          <button type="button" style={styles.detailsCloseBtn} onClick={onClose} aria-label="Close details">
            <X size={16} />
          </button>
          <div style={styles.detailsPosterWrap}>
            <PosterImage src={entry.posterUrl} title={entry.title} style={{ width: "100%", height: "100%" }} initialsSize={20} />
          </div>
        </div>

        <form style={styles.detailsScrollBody} className="memora-scroll" onSubmit={handleSubmit}>
          <h2 style={styles.detailsTitle}>{entry.title}</h2>

          <div style={styles.detailsMetaRow}>
            <span style={styles.detailsBadge}>
              {isTv ? <Tv size={12} /> : <Film size={12} />}
              {isTv ? "TV show" : "Movie"}
            </span>
            <span style={styles.detailsBadge}>{entry.releaseYear || "Year unknown"}</span>
            {entry.titleStatus && <span style={styles.detailsBadge}>{entry.titleStatus}</span>}
            {entry.voteAverage != null && (
              <span style={styles.detailsBadge}>
                <Star size={12} fill="#E8A33D" color="#E8A33D" />
                {entry.voteAverage.toFixed(1)}
              </span>
            )}
          </div>

          {entry.overview && <p style={styles.detailsOverviewText}>{entry.overview}</p>}

          <p style={styles.detailsSectionTitle}>Your tracking</p>

          <label style={styles.label}>
            Status
            <select style={styles.input} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Your rating
            <div style={{ marginTop: 4 }}>
              <StarRating value={rating} onChange={setRating} />
            </div>
          </label>

          {isTv && (
            <div style={styles.row}>
              <label style={styles.label}>
                Season
                <input type="number" min="1" style={styles.input} value={currentSeason} onChange={(e) => setCurrentSeason(e.target.value)} />
              </label>
              <label style={styles.label}>
                Episode
                <input type="number" min="0" style={styles.input} value={currentEpisode} onChange={(e) => setCurrentEpisode(e.target.value)} />
              </label>
            </div>
          )}

          <label style={styles.label}>
            Notes
            <textarea
              style={{ ...styles.input, minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thoughts, quotes, why you loved it..."
            />
          </label>

          <ErrorBanner message={error} />

          <div style={styles.formActions}>
            <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={saving}>
              Close
            </button>
            <button type="submit" style={styles.addBtn} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
