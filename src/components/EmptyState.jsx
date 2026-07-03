import React from "react";
import { Plus } from "lucide-react";
import { styles } from "../styles";
import { FilmstripIcon } from "./Shared";

export function EmptyState({ tab, onAdd, hasQuery }) {
  const msg = hasQuery
    ? "Nothing here matches your search."
    : tab === "watchlist"
    ? "Nothing queued up yet. Add a title you're planning to watch."
    : tab === "watching"
    ? "Nothing in progress. Move a title here once you start it."
    : "Nothing marked watched yet. Finish something and log it here.";
  return (
    <div style={styles.empty}>
      <FilmstripIcon />
      <p style={styles.emptyText}>{msg}</p>
      {!hasQuery && (
        <button style={styles.addBtn} onClick={onAdd}>
          <Plus size={16} strokeWidth={2.5} />
          Add title
        </button>
      )}
    </div>
  );
}
