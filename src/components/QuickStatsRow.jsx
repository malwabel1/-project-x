import React from "react";
import { Trophy, Sparkles, Bookmark, Clock } from "lucide-react";
import { styles } from "../styles";

const DEFAULT_MOVIE_MINUTES = 120;
const DEFAULT_EPISODE_MINUTES = 45;

/**
 * Home dashboard's "Quick Stats" — four numbers computed from the
 * same `titles` array the full Entertainment Passport (StatsView,
 * now living on the Profile screen) uses. No separate fetch: whoever
 * renders this passes down the result of the same useLibraryStats
 * call already needed for the Profile screen's numbers, so opening
 * Home never pays for two stats queries.
 */
export function QuickStatsRow({ titles, onViewProfile }) {
  const watched = titles.filter((t) => t.status === "watched").length;
  const watching = titles.filter((t) => t.status === "watching").length;
  const watchlist = titles.filter((t) => t.status === "watchlist").length;
  const hours = Math.round(
    titles
      .filter((t) => t.status === "watched")
      .reduce((sum, t) => {
        if (t.type === "movie") return sum + (t.runtimeMinutes || DEFAULT_MOVIE_MINUTES) / 60;
        return sum + ((t.currentEpisode || 0) * (t.runtimeMinutes || DEFAULT_EPISODE_MINUTES)) / 60;
      }, 0)
  );

  const cards = [
    { icon: Trophy, label: "Watched", value: watched },
    { icon: Sparkles, label: "Watching", value: watching },
    { icon: Bookmark, label: "Watchlist", value: watchlist },
    { icon: Clock, label: "Hours", value: hours },
  ];

  return (
    <section style={styles.continueWrap} aria-label="Quick stats">
      <div style={styles.sectionHeadingRow}>
        <h2 style={styles.continueHeading}>Quick Stats</h2>
        {onViewProfile && (
          <button type="button" style={styles.viewAllLink} onClick={onViewProfile}>
            View Profile
          </button>
        )}
      </div>
      <div style={styles.statsGrid}>
        {cards.map(({ icon: Icon, label, value }) => (
          <div key={label} style={styles.statCard}>
            <Icon size={16} color="#E8A33D" strokeWidth={2} />
            <span style={styles.statValue}>{value}</span>
            <span style={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
