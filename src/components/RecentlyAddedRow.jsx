import React from "react";
import { PosterCardRow } from "./PosterCardRow";

/**
 * Home dashboard's "Recently Added" carousel. `items` is expected to
 * already be the last-10-added slice (see HomeScreen, which sources
 * it from a `useUserLibrary({ status: null })` call — no new service
 * method, just the existing paginated fetch with no status filter,
 * naturally ordered newest-first by `added_at`).
 */
export function RecentlyAddedRow({ items, onOpenDetails }) {
  return (
    <PosterCardRow
      title="Recently Added"
      items={items}
      onOpenDetails={onOpenDetails}
      metaFor={(entry) => (entry.type === "tv" ? "TV show" : "Movie")}
    />
  );
}
