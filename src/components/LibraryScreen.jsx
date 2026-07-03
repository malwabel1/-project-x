import React, { useRef, useState } from "react";
import { Bookmark, Play, CheckCircle2, Search, Plus, ArrowLeft } from "lucide-react";
import { useUserLibrary } from "../hooks/useUserLibrary";
import { useLibraryCounts } from "../hooks/useLibraryCounts";
import { useInfiniteScroll } from "../utils/useInfiniteScroll";
import { TitleCard } from "./TitleCard";
import { TitleForm } from "./TitleForm";
import { TitleDetailsModal } from "./TitleDetailsModal";
import { EmptyState } from "./EmptyState";
import { LoadingState, ErrorBanner } from "./StateViews";
import { styles } from "../styles";

const STATUS = {
  watchlist: { label: "Watchlist", icon: Bookmark },
  watching: { label: "Watching", icon: Play },
  watched: { label: "Watched", icon: CheckCircle2 },
};

/**
 * The full, original tabbed library browser (paginated, searchable,
 * infinite-scroll grid) — unchanged in behavior from before Milestone
 * 2, just relocated: it's no longer the default Home view, it's what
 * "View All" from the Watchlist Preview opens. Fully self-contained,
 * including its own Add/Edit form and Details modal, both wired to
 * this screen's own useUserLibrary instance for immediate optimistic
 * updates in its grid.
 *
 * @param {{ userId: string, initialTab?: 'watchlist'|'watching'|'watched', onBack: () => void }} props
 */
export function LibraryScreen({ userId, initialTab = "watching", onBack }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);

  const library = useUserLibrary({ userId, status: tab, search: query });
  const counts = useLibraryCounts(userId, version);

  const sentinelRef = useRef(null);
  useInfiniteScroll(sentinelRef, library.loadMore, { enabled: library.hasMore && !library.loading });

  const bumpVersion = () => setVersion((v) => v + 1);
  const detailsEntry = detailsId ? library.items.find((it) => it.id === detailsId) || null : null;

  async function handleSave(entry) {
    setSaving(true);
    const ok = editingEntry ? await library.updateEntry(editingEntry.id, entry) : await library.addTitle(entry);
    setSaving(false);
    if (ok) {
      setFormOpen(false);
      setEditingEntry(null);
      bumpVersion();
    }
  }

  async function handleAddFromTmdb(result) {
    setSaving(true);
    const ok = await library.addTitleFromTmdb(result, { status: tab });
    setSaving(false);
    if (ok) {
      setFormOpen(false);
      bumpVersion();
    }
  }

  async function handleDetailsSave(id, patch) {
    setDetailsSaving(true);
    const ok = await library.updateEntry(id, patch);
    setDetailsSaving(false);
    if (ok) bumpVersion();
  }

  async function handleRemove(entry) {
    const ok = await library.removeEntry(entry.id);
    if (ok) bumpVersion();
  }

  return (
    <div>
      <button type="button" style={styles.viewAllLink} onClick={onBack} aria-label="Back to Home">
        <ArrowLeft size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
        Back to Home
      </button>

      <nav style={{ ...styles.tabs, marginTop: 14 }}>
        {Object.entries(STATUS).map(([key, { label, icon: Icon }]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...styles.tabBtn, ...(tab === key ? styles.tabBtnActive : {}) }}>
            <Icon size={15} strokeWidth={2} />
            {label}
            <span style={styles.tabCount}>{counts[key]}</span>
          </button>
        ))}
      </nav>

      <ErrorBanner message={library.error} onRetry={library.refresh} />

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={15} color="#8A8798" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this list"
            style={styles.searchInput}
            aria-label={`Search your ${STATUS[tab].label.toLowerCase()}`}
          />
        </div>
        <button
          type="button"
          style={styles.addBtn}
          onClick={() => {
            setEditingEntry(null);
            setFormOpen(true);
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          Add title
        </button>
      </div>

      {library.loading ? (
        <LoadingState />
      ) : library.items.length === 0 ? (
        <EmptyState tab={tab} onAdd={() => setFormOpen(true)} hasQuery={!!query} />
      ) : (
        <>
          <div style={styles.grid}>
            {library.items.map((entry, i) => (
              <TitleCard
                key={entry.id}
                entry={entry}
                index={i}
                onOpenDetails={() => setDetailsId(entry.id)}
                onEdit={() => {
                  setEditingEntry(entry);
                  setFormOpen(true);
                }}
                onRemove={() => handleRemove(entry)}
              />
            ))}
          </div>
          <div ref={sentinelRef} style={{ height: 1 }} />
          {library.loadingMore && <LoadingState label="Loading more…" />}
        </>
      )}

      {formOpen && (
        <TitleForm
          initial={editingEntry}
          saving={saving}
          onCancel={() => {
            setFormOpen(false);
            setEditingEntry(null);
          }}
          onSave={handleSave}
          onAddFromTmdb={handleAddFromTmdb}
        />
      )}

      {detailsEntry && (
        <TitleDetailsModal
          entry={detailsEntry}
          saving={detailsSaving}
          error={library.error}
          onClose={() => setDetailsId(null)}
          onSave={handleDetailsSave}
        />
      )}
    </div>
  );
}
