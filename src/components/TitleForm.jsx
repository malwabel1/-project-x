import React, { useState } from "react";
import { X } from "lucide-react";
import { styles } from "../styles";
import { StarRating } from "./Shared";
import { GlobalSearchTab } from "./GlobalSearchTab";

const STATUS_OPTIONS = [
  { key: "watchlist", label: "Watchlist" },
  { key: "watching", label: "Watching" },
  { key: "watched", label: "Watched" },
];

// onSave receives a plain entry object for manual entries; the parent
// decides whether that means an insert (addTitle) or an update
// (updateTitle). onAddFromTmdb receives a `Title`-shaped search
// result directly and is only used in "search" mode, only when
// adding (never editing).
export function TitleForm({ initial, onCancel, onSave, onAddFromTmdb, saving }) {
  const [mode, setMode] = useState("search"); // "search" | "manual" — editing always behaves like manual
  const [title, setTitle] = useState(initial?.title || "");
  const [type, setType] = useState(initial?.type || "movie");
  const [status, setStatus] = useState(initial?.status || "watchlist");
  const [rating, setRating] = useState(initial?.rating || 0);
  const [genre, setGenre] = useState(initial?.genre || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [currentSeason, setCurrentSeason] = useState(initial?.currentSeason || 1);
  const [currentEpisode, setCurrentEpisode] = useState(initial?.currentEpisode || 0);
  const [totalEpisodes, setTotalEpisodes] = useState(initial?.totalEpisodes || "");
  const [formError, setFormError] = useState(null);

  const isEditing = !!initial;
  const showSearch = !isEditing && mode === "search";

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Give the title a name first.");
      return;
    }
    onSave({
      title: title.trim(),
      type,
      status,
      rating,
      genre: genre.trim(),
      notes: notes.trim(),
      currentSeason: type === "tv" ? Number(currentSeason) || 1 : undefined,
      currentEpisode: type === "tv" ? Number(currentEpisode) || 0 : undefined,
      totalEpisodes: type === "tv" && totalEpisodes ? Number(totalEpisodes) : undefined,
    });
  }

  return (
    <div style={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={styles.formCard} className="memora-modal-in">
        <div style={styles.formHeader}>
          <h2 style={styles.formTitle}>{isEditing ? "Edit title" : "Add a title"}</h2>
          <button type="button" style={styles.iconBtn} onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {!isEditing && (
          <div style={styles.modeToggle}>
            <button
              type="button"
              style={{ ...styles.modeToggleBtn, ...(mode === "search" ? styles.modeToggleBtnActive : {}) }}
              onClick={() => setMode("search")}
            >
              Search
            </button>
            <button
              type="button"
              style={{ ...styles.modeToggleBtn, ...(mode === "manual" ? styles.modeToggleBtnActive : {}) }}
              onClick={() => setMode("manual")}
            >
              Manual
            </button>
          </div>
        )}

        {showSearch ? (
          <GlobalSearchTab adding={saving} onAdd={(result) => onAddFromTmdb(result)} />
        ) : (
          <form style={{ display: "flex", flexDirection: "column", gap: 14 }} onSubmit={handleSubmit}>
            <label style={styles.label}>
              Title
              <input
                autoFocus
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. The Bear"
                required
                disabled={isEditing} // title/type identify the catalogue row — lock on edit
              />
            </label>

            <div style={styles.row}>
              <label style={styles.label}>
                Type
                <select style={styles.input} value={type} onChange={(e) => setType(e.target.value)} disabled={isEditing}>
                  <option value="movie">Movie</option>
                  <option value="tv">TV show</option>
                </select>
              </label>
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
            </div>

            {type === "tv" && (
              <div style={styles.row}>
                <label style={styles.label}>
                  Season
                  <input type="number" min="1" style={styles.input} value={currentSeason} onChange={(e) => setCurrentSeason(e.target.value)} />
                </label>
                <label style={styles.label}>
                  Episode
                  <input type="number" min="0" style={styles.input} value={currentEpisode} onChange={(e) => setCurrentEpisode(e.target.value)} />
                </label>
                <label style={styles.label}>
                  Total eps
                  <input type="number" min="0" style={styles.input} value={totalEpisodes} onChange={(e) => setTotalEpisodes(e.target.value)} placeholder="optional" />
                </label>
              </div>
            )}

            <label style={styles.label}>
              Genre
              <input style={styles.input} value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. Drama, Sci-fi" disabled={isEditing} />
            </label>

            <label style={styles.label}>
              Your rating
              <div style={{ marginTop: 4 }}>
                <StarRating value={rating} onChange={setRating} />
              </div>
            </label>

            <label style={styles.label}>
              Notes
              <textarea
                style={{ ...styles.input, minHeight: 64, resize: "vertical", fontFamily: "inherit" }}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thoughts, quotes, why you loved it..."
              />
            </label>

            {formError && <p style={styles.errorText}>{formError}</p>}

            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={onCancel} disabled={saving}>
                Cancel
              </button>
              <button type="submit" style={styles.addBtn} disabled={saving}>
                {saving ? "Saving…" : isEditing ? "Save changes" : "Add title"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
