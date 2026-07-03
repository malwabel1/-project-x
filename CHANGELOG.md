# Changelog

## Milestone 2 — Core Experience

### Added
- **Home dashboard** (`HomeScreen.jsx`): Continue Watching → Recently
  Added → Quick Stats → Watchlist Preview → Recent Activity, in that
  order. Replaces the tabbed grid as the default view.
- **Recently Added** carousel — last-10-added titles across every
  status, reusing `useUserLibrary({ status: null })` (no new service
  method).
- **Watchlist Preview** — first 10 watchlist items + "View All" into
  the full Library screen.
- **Recent Activity** feed — new `activity_log` table + `Activity`
  repository/service/hook, written to automatically by
  `UserLibraryService` on add/status-change/rate/remove.
- **Profile screen** — avatar placeholder, display name (from auth
  metadata or email), member since, and the full Entertainment
  Passport stats (reusing `StatsView`) plus a Continue Watching count.
- **Settings screen** — Dark mode / Language / Notifications shown
  honestly as placeholders (not fake toggles), functional Sign out,
  and expandable About / Privacy / Terms sections.
- **Bottom navigation** — Home / Search / Profile / Settings, current
  screen highlighted, fixed with safe-area padding.
- **Search screen** — recent searches (persisted via the existing
  `cache.js` localStorage abstraction), clear history, suggestions
  (recent-search chips), debounced input, loading/empty states.
- **Title Details** — now openable from Home's rows as well as the
  Library grid.
- **Image loading**: new shared `PosterImage` component — instant
  gradient+initials placeholder, lazy-loaded image, opacity fade-in
  on load, silent fallback to the placeholder on error. Applied
  everywhere a poster renders. Backdrop images in the Details modal
  fade in the same way.
- **Animations**: page-transition fade on screen switch, modal
  pop-in on Add/Edit/Details, all respecting `prefers-reduced-motion`
  (already-global rule, unchanged).
- **Responsive**: new `useMediaQuery` hook; header/main content width
  grows on large desktop (≥1440px). Card grids were already
  responsive via CSS `auto-fill`/`auto-fit` — see Architecture notes.
- **`useLibraryMutations`** hook — write-only counterpart to
  `useUserLibrary` for screens (Search, Home's cross-cutting actions)
  that add/edit/remove without paginating a list of their own.

### Changed
- `UserLibraryService.updateEntry` / `removeEntry` now take `userId`
  as an explicit first argument (needed to attribute Activity log
  entries) — internal signature change only; every hook's *exposed*
  API (`library.updateEntry(id, patch)` etc.) is unchanged.
- `UserLibraryRepository`'s `SELECT_COLUMNS` and `fetchPage` now
  support `status: null` for an all-statuses fetch (Recently Added).
- `StatsView` accepts an optional `continueWatchingCount` prop and
  is now rendered inside `ProfileScreen` instead of being its own
  top-level tab.
- `TitleCard` and `ContinueWatchingRow`'s cards are wrapped in
  `React.memo`.

### Fixed / hardened
- None — Milestone 2 was additive on top of a working base; see
  `README.md`'s Milestone 2 section, "Known limitations," for the
  honest caveats that came with this scope of change.

### Database
- New table: `activity_log` (append-only, RLS-scoped to the owning
  user, no update/delete policy). See `supabase/schema.sql`.

---

## Earlier iterations (pre-Milestone 2)

- Production Supabase architecture (Auth, `titles` + `user_titles`,
  RLS) replacing the original in-artifact prototype.
- Layered refactor: Repository → Service → Hook → Component, with
  pagination, server-side search, optimistic updates, centralized
  error handling, JSDoc types, and an offline-cache scaffold.
- TMDB integration via a Supabase Edge Function proxy (API key never
  reaches the client), with duplicate-safe adds.
- Production hardening of the `tmdb-search` edge function: timeout,
  best-effort rate limiting, `request_id` tracing, response-shape
  validation, no leaked error detail, restricted CORS.
- Title Details page/modal with inline editing.
- Poster images on `TitleCard` with graceful fallback.
- Continue Watching row on what was then the Home tab.
- Stats redesigned as the "Entertainment Passport."
