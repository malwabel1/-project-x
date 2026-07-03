import React from "react";
import { Tv } from "lucide-react";
import { styles } from "../styles";
import { PosterImage } from "./PosterImage";

/**
 * Home-screen "Continue Watching" row. Purely presentational — takes
 * an already-filtered list of LibraryEntry objects (TV shows with
 * status "watching") and a click handler; owns no data fetching of
 * its own. Renders nothing if there's nothing to continue.
 */
export function ContinueWatchingRow({ items, onOpenDetails }) {
  if (!items.length) return null;

  return (
    <section style={styles.continueWrap} aria-label="Continue watching">
      <h2 style={styles.continueHeading}>Continue Watching</h2>
      <div style={styles.continueRow} className="memora-scroll">
        {items.map((entry) => (
          <ContinueWatchingCard key={entry.id} entry={entry} onClick={() => onOpenDetails(entry)} />
        ))}
      </div>
    </section>
  );
}

function ContinueWatchingCardImpl({ entry, onClick }) {
  const hasProgress = !!entry.totalEpisodes;
  const percent = hasProgress ? Math.min(100, Math.round(((entry.currentEpisode || 0) / entry.totalEpisodes) * 100)) : null;

  return (
    <button
      type="button"
      className="memora-card"
      style={styles.continueCard}
      onClick={onClick}
      aria-label={`Continue watching ${entry.title}, season ${entry.currentSeason || 1}, episode ${entry.currentEpisode || 0}`}
    >
      <PosterImage
        src={entry.posterUrl}
        title={entry.title}
        style={styles.continuePoster}
        initialsSize={26}
        badge={<Tv size={12} style={styles.continuePosterIcon} />}
      />
      <p style={styles.continueTitle}>{entry.title}</p>
      <p style={styles.continueMeta}>
        S{entry.currentSeason || 1} · E{entry.currentEpisode || 0}
        {hasProgress ? ` / ${entry.totalEpisodes}` : ""}
      </p>
      {hasProgress && (
        <div style={styles.continueProgressTrack}>
          <div style={{ ...styles.continueProgressFill, width: `${percent}%` }} />
        </div>
      )}
    </button>
  );
}

const ContinueWatchingCard = React.memo(ContinueWatchingCardImpl);
