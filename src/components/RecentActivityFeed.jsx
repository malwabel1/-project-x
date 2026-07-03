import React from "react";
import { Plus, ArrowRightLeft, Star, Trash2 } from "lucide-react";
import { styles } from "../styles";

const STATUS_LABEL = { watchlist: "Watchlist", watching: "Watching", watched: "Watched" };

function describe(item) {
  switch (item.action) {
    case "added":
      return { text: <>Added <strong>{item.titleName}</strong></>, Icon: Plus, color: "#4FB3A9" };
    case "removed":
      return { text: <>Removed <strong>{item.titleName}</strong></>, Icon: Trash2, color: "#8A8798" };
    case "rated":
      return {
        text: (
          <>
            Rated <strong>{item.titleName}</strong>
            <span style={styles.activityStars}>{"\u2605".repeat(item.detail?.rating || 0)}</span>
          </>
        ),
        Icon: Star,
        color: "#E8A33D",
      };
    case "status_changed": {
      const to = item.detail?.to;
      if (to === "watched") return { text: <>Finished <strong>{item.titleName}</strong></>, Icon: ArrowRightLeft, color: "#E8A33D" };
      return {
        text: (
          <>
            Moved <strong>{item.titleName}</strong> to {STATUS_LABEL[to] || to}
          </>
        ),
        Icon: ArrowRightLeft,
        color: "#4FB3A9",
      };
    }
    default:
      return { text: <strong>{item.titleName}</strong>, Icon: ArrowRightLeft, color: "#8A8798" };
  }
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Home dashboard's "Recent Activity" timeline. Fed by useRecentActivity
 * (→ ActivityService.getRecent), newest first (the query already
 * orders by created_at desc). Renders nothing if there's no history
 * yet, same pattern as the other Home sections.
 */
export function RecentActivityFeed({ items }) {
  if (!items.length) return null;

  return (
    <section style={styles.continueWrap} aria-label="Recent activity">
      <h2 style={styles.continueHeading}>Recent Activity</h2>
      <div style={styles.activityList}>
        {items.map((item) => {
          const { text, Icon, color } = describe(item);
          return (
            <div key={item.id} style={styles.activityRow}>
              <div style={styles.activityIconWrap}>
                <Icon size={13} color={color} />
              </div>
              <div>
                <p style={styles.activityText}>{text}</p>
                <p style={styles.activityTime}>{timeAgo(item.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
