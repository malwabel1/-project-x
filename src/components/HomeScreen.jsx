import React, { useState } from "react";
import { Plus } from "lucide-react";
import { styles } from "../styles";
import { useUserLibrary } from "../hooks/useUserLibrary";
import { useLibraryStats } from "../hooks/useLibraryStats";
import { useRecentActivity } from "../hooks/useRecentActivity";
import { useLibraryMutations } from "../hooks/useLibraryMutations";
import { ContinueWatchingRow } from "./ContinueWatchingRow";
import { RecentlyAddedRow } from "./RecentlyAddedRow";
import { QuickStatsRow } from "./QuickStatsRow";
import { WatchlistPreviewRow } from "./WatchlistPreviewRow";
import { RecentActivityFeed } from "./RecentActivityFeed";
import { TitleForm } from "./TitleForm";
import { TitleDetailsModal } from "./TitleDetailsModal";
import { LoadingState, ErrorBanner } from "./StateViews";
import { FilmstripIcon } from "./Shared";

/**
 * Home dashboard (Milestone 2). Composes five sections in the
 * required order: Continue Watching, Recently Added, Quick Stats,
 * Watchlist Preview, Recent Activity. Fully self-contained -- owns
 * every hook it needs, same pattern as LibraryScreen/ProfileScreen/
 * SearchScreen, so App.jsx stays a thin screen switcher.
 *
 * @param {{ userId: string, onViewWatchlist: () => void, onViewProfile: () => void, onOpenDetailsScreen?: (entry: import('../types').LibraryEntry) => void }} props
 */
export function HomeScreen({ userId, onViewWatchlist, onViewProfile, onOpenDetailsScreen }) {
  const [formOpen, setFormOpen] = useState(false);
  const [detailsId, setDetailsId] = useState(null);
  const [version, setVersion] = useState(0);

  const continueWatching = useUserLibrary({ userId, status: "watching", search: "" });
  const continueWatchingTv = continueWatching.items.filter((it) => it.type === "tv");

  const recentlyAdded = useUserLibrary({ userId, status: null, search: "" });
  const watchlistPreview = useUserLibrary({ userId, status: "watchlist", search: "" });
  const stats = useLibraryStats(userId, true, version);
  const activity = useRecentActivity(userId, 12, version);
  const mutations = useLibraryMutations(userId);

  function refreshAll() {
    continueWatching.refresh();
    recentlyAdded.refresh();
    watchlistPreview.refresh();
    setVersion((v) => v + 1);
  }

  async function handleAddTitle(entry) {
    const ok = await mutations.addTitle(entry);
    if (ok) {
      setFormOpen(false);
      refreshAll();
    }
  }

  async function handleAddFromTmdb(result) {
    const ok = await mutations.addTitleFromTmdb(result, { status: "watchlist" });
    if (ok) {
      setFormOpen(false);
      refreshAll();
    }
  }

  async function handleDetailsSave(id, patch) {
    const ok = await mutations.updateEntry(id, patch);
    if (ok) refreshAll();
  }

  // Prefer the full-page details screen (Milestone: Title Details)
  // when App provides it; fall back to the in-place modal otherwise,
  // so this component keeps working unchanged if rendered standalone.
  const openDetails = (entry) => (onOpenDetailsScreen ? onOpenDetailsScreen(entry) : setDetailsId(entry.id));

  // A card can come from any of the three rows -- check all three,
  // newest-added first since that's the most likely source.
  const detailsEntry = detailsId
    ? recentlyAdded.items.find((it) => it.id === detailsId) ||
      continueWatching.items.find((it) => it.id === detailsId) ||
      watchlistPreview.items.find((it) => it.id === detailsId) ||
      null
    : null;

  const recentlyAddedTop = recentlyAdded.items.slice(0, 10);
  const watchlistTop = watchlistPreview.items.slice(0, 10);
  const isEmpty = !recentlyAdded.loading && recentlyAdded.items.length === 0;

  return (
    <div>
      <div style={styles.sectionHeadingRow}>
        <p style={styles.homeGreeting}>Welcome back</p>
        <button type="button" style={styles.addBtn} onClick={() => setFormOpen(true)}>
          <Plus size={16} strokeWidth={2.5} />
          Add title
        </button>
      </div>

      <ErrorBanner message={recentlyAdded.error} onRetry={recentlyAdded.refresh} />

      {isEmpty ? (
        <div style={styles.empty}>
          <FilmstripIcon />
          <p style={styles.emptyText}>Your collection is empty. Add your first movie or TV show to get started.</p>
          <button type="button" style={styles.addBtn} onClick={() => setFormOpen(true)}>
            <Plus size={16} strokeWidth={2.5} />
            Add title
          </button>
        </div>
      ) : (
        <>
          <ContinueWatchingRow items={continueWatchingTv} onOpenDetails={openDetails} />

          {recentlyAdded.loading ? (
            <LoadingState label="Loading your library…" />
          ) : (
            <RecentlyAddedRow items={recentlyAddedTop} onOpenDetails={openDetails} />
          )}

          {!stats.loading && <QuickStatsRow titles={stats.titles} onViewProfile={onViewProfile} />}

          <WatchlistPreviewRow items={watchlistTop} onOpenDetails={openDetails} onViewAll={onViewWatchlist} />

          <RecentActivityFeed items={activity.items} />
        </>
      )}

      {formOpen && (
        <TitleForm
          initial={null}
          saving={mutations.saving}
          onCancel={() => setFormOpen(false)}
          onSave={handleAddTitle}
          onAddFromTmdb={handleAddFromTmdb}
        />
      )}

      {detailsEntry && (
        <TitleDetailsModal
          entry={detailsEntry}
          saving={mutations.saving}
          error={mutations.error}
          onClose={() => setDetailsId(null)}
          onSave={handleDetailsSave}
        />
      )}
    </div>
  );
}
