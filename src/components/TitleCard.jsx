import React from "react";
import { Film, Tv, Pencil, Trash2 } from "lucide-react";
import { styles } from "../styles";
import { StarRating } from "./Shared";
import { PosterImage } from "./PosterImage";

function TitleCardImpl({ entry, index, onOpenDetails, onEdit, onRemove }) {
  const isTv = entry.type === "tv";

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenDetails?.();
    }
  }

  return (
    <div
      className={onOpenDetails ? "memora-card" : undefined}
      style={{ ...styles.card, animation: `riseIn 0.35s ease ${Math.min(index * 0.03, 0.3)}s both`, cursor: onOpenDetails ? "pointer" : "default" }}
      onClick={onOpenDetails}
      onKeyDown={onOpenDetails ? handleKeyDown : undefined}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      aria-label={onOpenDetails ? `View details for ${entry.title}` : undefined}
    >
      <div style={styles.cardTear} />
      <div style={styles.cardTop}>
        <PosterImage
          src={entry.posterUrl}
          title={entry.title}
          style={styles.poster}
          badge={isTv ? <Tv size={13} style={styles.posterTypeIcon} /> : <Film size={13} style={styles.posterTypeIcon} />}
        />
        <div style={styles.cardHeadInfo}>
          <h3 style={styles.cardTitle}>{entry.title}</h3>
          {entry.genre && <span style={styles.genreTag}>{entry.genre}</span>}
          {isTv && (entry.currentSeason || entry.currentEpisode) ? (
            <p style={styles.progressText}>
              S{entry.currentSeason || 1} · E{entry.currentEpisode || 0}
              {entry.totalEpisodes ? ` / ${entry.totalEpisodes}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      {entry.notes && <p style={styles.notes}>{entry.notes}</p>}

      <div style={styles.cardFooter}>
        <StarRating value={entry.rating || 0} readOnly />
        <div style={styles.cardActions}>
          <button
            style={styles.iconBtn}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label={`Edit ${entry.title}`}
          >
            <Pencil size={14} />
          </button>
          <button
            style={styles.iconBtn}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove ${entry.title}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Memoized: the main grid can render dozens of these, and only the
// entry that actually changed (or its position) needs to re-render.
export const TitleCard = React.memo(TitleCardImpl);
