import React from "react";
import { Film, Tv, Clock, Star, Sparkles, Trophy, Play } from "lucide-react";
import { styles } from "../styles";
import { FilmstripIcon } from "./Shared";

// Fallbacks used only when a title has no runtime on record yet
// (e.g. added manually, or before TMDB metadata was wired up).
const DEFAULT_MOVIE_MINUTES = 120;
const DEFAULT_EPISODE_MINUTES = 45;

/**
 * "Entertainment Passport" — everything here is computed client-side
 * from the LibraryEntry[] already fetched by useLibraryStats (which
 * itself just calls the existing UserLibraryService.getAllForStats).
 * No new service method, no new table, no direct Supabase call —
 * this component only ever receives a plain array of entries.
 *
 * Now embedded in the Profile screen (Milestone 2) rather than being
 * its own top-level tab; `continueWatchingCount`, when passed, adds
 * one more stat card — the one number Profile needs that isn't
 * derivable from `titles` alone (it's a live count from a second
 * useUserLibrary instance, same as Home's Continue Watching row).
 */
export function StatsView({ titles, continueWatchingCount }) {
  const watched = titles.filter((t) => t.status === "watched");
  const watching = titles.filter((t) => t.status === "watching");
  const watchlist = titles.filter((t) => t.status === "watchlist");

  const totalHours = watched.reduce((sum, t) => {
    if (t.type === "movie") return sum + (t.runtimeMinutes || DEFAULT_MOVIE_MINUTES) / 60;
    const episodeMinutes = t.runtimeMinutes || DEFAULT_EPISODE_MINUTES;
    return sum + ((t.currentEpisode || 0) * episodeMinutes) / 60;
  }, 0);

  const rated = watched.filter((t) => t.rating > 0);
  const avgRating = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length).toFixed(1) : null;

  const genreCounts = {};
  titles.forEach((t) => {
    if (!t.genre) return;
    genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
  });
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

  const movieCount = titles.filter((t) => t.type === "movie").length;
  const tvCount = titles.filter((t) => t.type === "tv").length;
  const totalTracked = titles.length;
  const moviePct = totalTracked ? Math.round((movieCount / totalTracked) * 100) : 0;
  const tvPct = totalTracked ? 100 - moviePct : 0;
  const topType = movieCount === tvCount ? "Even split" : movieCount > tvCount ? "Movies" : "TV shows";

  const memberSince = titles.reduce((earliest, t) => {
    if (!t.addedAt) return earliest;
    return !earliest || t.addedAt < earliest ? t.addedAt : earliest;
  }, null);
  const memberSinceLabel = memberSince
    ? new Date(memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  const statCards = [
    { icon: Trophy, label: "Watched", value: watched.length },
    { icon: Sparkles, label: "Watching", value: watching.length },
    { icon: Film, label: "Watchlist", value: watchlist.length },
    { icon: Clock, label: "Hours logged", value: Math.round(totalHours) },
    { icon: Star, label: "Average rating", value: avgRating ? `${avgRating} / 5` : "—" },
    { icon: topType === "TV shows" ? Tv : Film, label: "Top type", value: totalTracked ? topType : "—" },
  ];
  if (continueWatchingCount !== undefined) {
    statCards.push({ icon: Play, label: "Continue Watching", value: continueWatchingCount });
  }

  return (
    <div style={styles.passportWrap}>
      <div style={styles.passportCard}>
        <div style={styles.passportTopRow}>
          <p style={styles.passportEyebrow}>Entertainment Passport</p>
          <div style={styles.passportStamp}>
            <FilmstripIcon />
          </div>
        </div>

        {totalTracked === 0 ? (
          <p style={styles.passportEmpty}>
            Your passport is unstamped. Add a title to start building your entertainment history.
          </p>
        ) : (
          <>
            <div style={styles.passportHeadlineRow}>
              <span style={styles.passportHeadline}>{totalTracked}</span>
              <span style={styles.passportHeadlineLabel}>title{totalTracked === 1 ? "" : "s"} in your collection</span>
            </div>
            {memberSinceLabel && <p style={styles.passportMetaRow}>Tracking since {memberSinceLabel}</p>}
          </>
        )}
      </div>

      {totalTracked > 0 && (
        <>
          <div style={styles.statsGrid}>
            {statCards.map(({ icon: Icon, label, value }) => (
              <div key={label} style={styles.statCard}>
                <div style={styles.statCardIconRow}>
                  <Icon size={16} color="#E8A33D" strokeWidth={2} />
                </div>
                <span style={styles.statValue}>{value}</span>
                <span style={styles.statLabel}>{label}</span>
              </div>
            ))}
          </div>

          <div style={styles.insightsCard}>
            <p style={styles.insightsTitle}>Insights</p>

            <div>
              <div style={styles.splitLabelsRow}>
                <span>
                  <span style={{ ...styles.splitLabelDot, background: "#E8A33D" }} />
                  Movies {moviePct}%
                </span>
                <span>
                  TV {tvPct}%
                  <span style={{ ...styles.splitLabelDot, background: "#4FB3A9", marginRight: 0, marginLeft: 5 }} />
                </span>
              </div>
              <div style={{ ...styles.splitTrack, marginTop: 6 }}>
                <div style={{ width: `${moviePct}%`, background: "#E8A33D" }} />
                <div style={{ width: `${tvPct}%`, background: "#4FB3A9" }} />
              </div>
            </div>

            {topGenre && (
              <div style={styles.insightRow}>
                <div style={styles.insightIconWrap}>
                  <Sparkles size={14} />
                </div>
                <p style={styles.insightText}>
                  <strong>{topGenre[0]}</strong> is your most-tracked genre, appearing in {topGenre[1]} title
                  {topGenre[1] === 1 ? "" : "s"}.
                </p>
              </div>
            )}

            {avgRating && (
              <div style={styles.insightRow}>
                <div style={styles.insightIconWrap}>
                  <Star size={14} />
                </div>
                <p style={styles.insightText}>
                  You rate what you watch an average of <strong>{avgRating} out of 5</strong> stars.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
