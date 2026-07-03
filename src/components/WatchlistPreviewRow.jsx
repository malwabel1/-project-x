import React from "react";
import { PosterCardRow } from "./PosterCardRow";

/**
 * Home dashboard's "Watchlist Preview" — first 10 items with
 * status "watchlist". `onViewAll` hands off to the full Library
 * screen's Watchlist tab (the existing paginated, searchable grid),
 * which is unchanged and still where the complete list lives.
 */
export function WatchlistPreviewRow({ items, onOpenDetails, onViewAll }) {
  return <PosterCardRow title="Your Watchlist" items={items} onOpenDetails={onOpenDetails} onViewAll={onViewAll} />;
}
