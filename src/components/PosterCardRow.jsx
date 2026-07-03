import React from "react";
import { Film, Tv } from "lucide-react";
import { styles } from "../styles";
import { PosterImage } from "./PosterImage";

/**
 * Generic horizontal row of poster cards with a section heading and
 * an optional "View All" link. Shared by RecentlyAddedRow and
 * WatchlistPreviewRow so the two don't duplicate the same markup —
 * ContinueWatchingRow stays its own component since it also renders
 * a progress bar per card.
 *
 * @param {{
 *   title: string,
 *   items: import('../types').LibraryEntry[],
 *   onOpenDetails: (entry: import('../types').LibraryEntry) => void,
 *   onViewAll?: () => void,
 *   metaFor?: (entry: import('../types').LibraryEntry) => string,
 * }} props
 */
export function PosterCardRow({ title, items, onOpenDetails, onViewAll, metaFor }) {
  if (!items.length) return null;

  return (
    <section style={styles.continueWrap} aria-label={title}>
      <div style={styles.sectionHeadingRow}>
        <h2 style={styles.continueHeading}>{title}</h2>
        {onViewAll && (
          <button type="button" style={styles.viewAllLink} onClick={onViewAll}>
            View All
          </button>
        )}
      </div>
      <div style={styles.continueRow} className="memora-scroll">
        {items.map((entry) => (
          <PosterCard key={entry.id} entry={entry} onClick={() => onOpenDetails(entry)} metaFor={metaFor} />
        ))}
      </div>
    </section>
  );
}

function PosterCardImpl({ entry, onClick, metaFor }) {
  const isTv = entry.type === "tv";
  return (
    <button type="button" className="memora-card" style={styles.continueCard} onClick={onClick} aria-label={`View details for ${entry.title}`}>
      <PosterImage
        src={entry.posterUrl}
        title={entry.title}
        style={styles.continuePoster}
        initialsSize={26}
        badge={isTv ? <Tv size={12} style={styles.continuePosterIcon} /> : <Film size={12} style={styles.continuePosterIcon} />}
      />
      <p style={styles.continueTitle}>{entry.title}</p>
      <p style={styles.continueMeta}>{metaFor ? metaFor(entry) : entry.releaseYear || "\u2014"}</p>
    </button>
  );
}

const PosterCard = React.memo(PosterCardImpl);
