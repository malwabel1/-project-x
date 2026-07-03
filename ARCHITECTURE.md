# Memora — Architecture

This is the reference doc for how the codebase is put together. The
narrative version of most of this (with the reasoning behind each
decision) lives in `README.md`; this file is the quick-lookup version.

## Layers

```
components/   Presentational + screen composition. Never import supabase.
hooks/        React state glue. Call services. Own loading/error/optimistic state.
services/     Business logic. The only callers of repositories. May call other services.
repositories/ The ONLY files that import the supabase client. Raw { data, error } in/out.
utils/        Cross-cutting: errors, cache, debounce, infinite scroll, media query.
types/        JSDoc typedefs shared by every layer above.
```

Dependency direction is one-way:

```
components → hooks → services → repositories → supabase
                 ↘ utils (errors, cache) ↗
```

## Screens (Milestone 2)

As of Milestone 2, `App.jsx` is a thin shell: it holds only
`screen` state (`'home' | 'library' | 'search' | 'profile' |
'settings'`) and renders `<BottomNav>` plus whichever screen is
active. It owns no data hooks itself.

Every screen component is **self-contained** — it owns whichever
hooks it needs and, where relevant, its own copy of the shared
`TitleForm` / `TitleDetailsModal` modals:

| Screen | File | Owns |
|---|---|---|
| Home | `components/HomeScreen.jsx` | `useUserLibrary` ×3 (Continue Watching, Recently Added, Watchlist Preview), `useLibraryStats`, `useRecentActivity`, `useLibraryMutations` |
| Library (via "View All") | `components/LibraryScreen.jsx` | `useUserLibrary` (tab-scoped), `useLibraryCounts` |
| Search | `components/SearchScreen.jsx` | `useGlobalTitleSearch`, `useLibraryMutations` |
| Profile | `components/ProfileScreen.jsx` | `useLibraryStats`, `useUserLibrary` (watching, for the Continue Watching count) |
| Settings | `components/SettingsScreen.jsx` | nothing — pure props (`onSignOut`) |

This means each screen's data only loads while that screen is
mounted, and switching screens can't leave one screen reading another
screen's stale hook state. The trade-off, made deliberately rather
than by accident: Home's several `useUserLibrary` instances each
fetch independently, so there's no single "dashboard" query — see
`README.md` §16 for why, and what the natural follow-up service
method would look like if that ever becomes worth it.

`LibraryScreen` is not a bottom-nav destination. It's reached via
"View All" (from the Watchlist Preview) and is given a fresh React
`key` on every entry so it always remounts — and refetches — rather
than ever showing a stale grid from a previous visit.

## Write path

Two ways a component gets to a mutation, depending on whether the
screen already has a relevant `useUserLibrary` instance:

- **Screen already has one** (LibraryScreen): call that hook's own
  `addTitle` / `updateEntry` / `removeEntry` directly — these apply
  an **optimistic** local update to that screen's own list before the
  network call resolves, and roll back on failure.
- **Screen doesn't need a paginated list of its own** (Home's
  cross-cutting Add/Details actions; the Search screen): use
  `hooks/useLibraryMutations.js` instead — a write-only hook with no
  `items`/fetch, wrapping the same `UserLibraryService` calls. After
  a successful write, the screen calls `.refresh()` on whichever read
  hooks it owns to pick up the change (a real refetch, not an
  optimistic patch, since there's no local array to patch).

Either path ends up calling the same `UserLibraryService` functions —
this is a UI-layer choice about *feedback*, not a second business-logic
path.

## Activity logging

`UserLibraryService`'s `addTitle`, `addTitleFromTmdb`, `updateEntry`,
and `removeEntry` each call `ActivityService.log(...)` after a
successful write — a service calling another service, the same
composition pattern already used for `TitlesService`. Logging is
best-effort: a failure there is reported via `logError` but never
thrown, so it can never roll back the mutation it's describing. See
`supabase/schema.sql`'s `activity_log` table.

## Full file map

```
src/
├── App.jsx                          Screen switcher + bottom nav shell
├── main.jsx                         Vite/React entry point
├── styles.js                        Every design token, one file
├── types/
│   └── index.js                     JSDoc typedefs (Title, LibraryEntry, ActivityItem, ...)
├── lib/
│   └── supabaseClient.js            Supabase client singleton
├── utils/
│   ├── errors.js                    AppError, toAppError, logError
│   ├── cache.js                     localStorage read-through cache abstraction
│   ├── useDebouncedValue.js
│   ├── useInfiniteScroll.js
│   └── (useMediaQuery lives in hooks/, not utils/ — see below)
├── repositories/
│   ├── TitlesRepository.js          titles table
│   ├── UserLibraryRepository.js     user_titles table
│   ├── ActivityRepository.js        activity_log table
│   ├── GlobalTitleSearchRepository.js  local-catalogue fallback search
│   └── TMDBRepository.js            calls the tmdb-search edge function only
├── services/
│   ├── TitlesService.js
│   ├── UserLibraryService.js
│   ├── ActivityService.js
│   ├── AuthService.js
│   ├── TMDBService.js               maps TMDB → Title shape
│   └── GlobalTitleSearchService.js  TMDB first, local catalogue fallback
├── hooks/
│   ├── useAuth.js
│   ├── useUserLibrary.js            paginated + searchable + optimistic
│   ├── useLibraryMutations.js       write-only counterpart (Milestone 2)
│   ├── useLibraryCounts.js
│   ├── useLibraryStats.js
│   ├── useRecentActivity.js         (Milestone 2)
│   ├── useGlobalTitleSearch.js
│   └── useMediaQuery.js             (Milestone 2)
└── components/
    ├── App-level: AuthScreen, BottomNav
    ├── Screens: HomeScreen, LibraryScreen, SearchScreen, ProfileScreen, SettingsScreen
    ├── Home sections: ContinueWatchingRow, RecentlyAddedRow, WatchlistPreviewRow,
    │                  PosterCardRow (shared by the latter two), QuickStatsRow,
    │                  RecentActivityFeed
    ├── Title UI: TitleCard, TitleForm, TitleDetailsModal, GlobalSearchTab,
    │             StatsView (now embedded in ProfileScreen)
    └── Shared: PosterImage, Shared.jsx (icons/avatar helpers), StateViews, EmptyState

supabase/
├── schema.sql                       titles, user_titles, activity_log + RLS
└── functions/tmdb-search/index.ts   TMDB proxy edge function (key never reaches the client)
```
