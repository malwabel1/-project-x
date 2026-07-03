import React from "react";
import { colorForTitle, initials } from "./Shared";
import { StatsView } from "./StatsView";
import { LoadingState } from "./StateViews";
import { useLibraryStats } from "../hooks/useLibraryStats";
import { useUserLibrary } from "../hooks/useUserLibrary";
import { styles } from "../styles";

/**
 * Profile screen (Milestone 2). Display-only — no editing yet, per
 * spec. Self-contained: owns its own useLibraryStats call (same
 * service/hook Home's Quick Stats uses) plus a small useUserLibrary
 * call scoped to status "watching" purely to derive the Continue
 * Watching count — same definition Home's Continue Watching row
 * uses (TV shows currently being watched), just counted instead of
 * rendered as a row. No new service method for either.
 *
 * @param {{ user: { email: string, id: string, user_metadata?: { full_name?: string } } }} props
 */
export function ProfileScreen({ user }) {
  const stats = useLibraryStats(user.id, true, 0);
  const watching = useUserLibrary({ userId: user.id, status: "watching", search: "" });
  const continueWatchingCount = watching.items.filter((it) => it.type === "tv").length;

  const displayName = user.user_metadata?.full_name || user.email;
  const memberSince = stats.titles.reduce((earliest, t) => {
    if (!t.addedAt) return earliest;
    return !earliest || t.addedAt < earliest ? t.addedAt : earliest;
  }, null);
  const color = colorForTitle(displayName);

  return (
    <div>
      <div style={styles.profileHeader}>
        <div style={{ ...styles.profileAvatar, background: `linear-gradient(160deg, ${color}, #12121A)` }}>
          <span style={styles.profileAvatarInitials}>{initials(displayName)}</span>
        </div>
        <h1 style={styles.profileName}>{displayName}</h1>
        <p style={styles.profileMeta}>{user.email}</p>
        {memberSince && (
          <p style={styles.profileMeta}>
            Member since {new Date(memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
        )}
      </div>

      {stats.loading ? (
        <LoadingState label="Loading your passport…" />
      ) : (
        <StatsView titles={stats.titles} continueWatchingCount={continueWatchingCount} />
      )}
    </div>
  );
}
