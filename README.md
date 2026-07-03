# Memora — layered architecture

Same app, same dark premium UI, restructured into clean layers so it
can grow without turning into a pile of components that each know how
to talk to Supabase. Nothing about the visual design changed — this
is purely a plumbing refactor.

> **Looking for the file map or a quick-reference architecture
> diagram?** See `ARCHITECTURE.md`. **Looking for what changed
> recently?** See `CHANGELOG.md`. This file is the narrative version —
> the reasoning behind each decision, in the order those decisions
> were made.

## 1. Layers

```
src/
├── App.jsx              UI shell — screens/layout only
├── components/          Presentational components (unchanged look & feel)
├── hooks/                React state glue — call services, never supabase
├── services/             Business logic — the only callers of repositories
├── repositories/         The ONLY files that import the supabase client
├── utils/                Cross-cutting: errors, cache, debounce, infinite scroll
└── types/                JSDoc typedefs shared across all layers
```

The dependency direction is one-way:

```
components → hooks → services → repositories → supabase
                 ↘ utils (errors, cache) ↗
```

A component never imports `supabaseClient`. A hook never imports a
repository. If you're ever unsure where new code goes, ask "does this
know about Postgres/Supabase specifics?" — if yes, repository; "does
this decide what a good outcome looks like (dedupe, caching, error
messages)?" — service; "does this hold React state?" — hook.

### Why split repositories from services
`TitlesRepository` / `UserLibraryRepository` return raw
`{ data, error, count }`, exactly what `supabase-js` gives back — no
opinions. `TitlesService` / `UserLibraryService` are where the actual
rules live: find-or-create a title, map a DB row into the
`LibraryEntry` shape components expect, turn a Postgres error into a
message a user can read, decide what gets cached. Swapping Supabase
for a different backend later means rewriting the repositories only;
every service, hook, and component is unaffected.

## 2. TitlesService and UserLibraryService

- **`TitlesService`** — everything about the shared `titles`
  catalogue. Today that's one method, `findOrCreateTitleId`, which
  the Add form uses so the same show isn't duplicated across users.
- **`UserLibraryService`** — everything about a user's personal
  tracking state: paginated + searchable fetching (`getPage`),
  unpaginated fetching for Stats (`getAllForStats`), tab-badge counts
  (`getCounts`), and all mutations (`addTitle`, `updateEntry`,
  `updateStatus`, `updateRating`, `removeEntry`).

Neither service is ever called from a component directly — always
through a hook.

## 3. Pagination

`UserLibraryRepository.fetchPage` takes `{ limit, offset }` and uses
Supabase's `.range()`, requesting an exact count alongside the rows.
`UserLibraryService.getPage` turns `(page, pageSize)` into that
offset and returns `{ items, hasMore, total }`.

`useUserLibrary` keeps `page`/`hasMore` in state and exposes
`loadMore()`. `App.jsx` wires a 1px sentinel `<div>` at the bottom of
the grid to `useInfiniteScroll`, which uses an `IntersectionObserver`
to call `loadMore()` automatically as the user scrolls — no "Load
more" button needed, though one would just call `loadMore()` too if
you'd rather have an explicit control.

Page size is `20`, set as a constant in `useUserLibrary.js`.

## 4. Server-side search

`UserLibraryRepository.fetchPage` accepts a `search` string and
applies it as `.ilike("titles.title", "%term%")` **on the server**,
against the `titles!inner` join — nothing is fetched into memory and
filtered client-side. `useUserLibrary` debounces the search input
300ms (`useDebouncedValue`) before it becomes a query, so typing
doesn't fire a request per keystroke.

## 5. Optimistic UI updates

`useUserLibrary.updateEntry` (which `updateStatus` and `updateRating`
call) follows this sequence:

1. Snapshot current `items`.
2. Apply the patch to local state immediately — the star rating or
   status badge updates with zero latency.
3. Call `UserLibraryService.updateEntry`.
4. On success: if the patch moved the item to a different status than
   the tab currently being viewed, remove it from the local list
   (only now — not before the write is confirmed).
5. On failure: restore the snapshot and surface the error via
   `ErrorBanner`.

`removeEntry` follows the same optimistic-then-rollback pattern.

## 6. Centralized error handling

`utils/errors.js` exports `AppError` and `toAppError()`. Every
repository call inside a service is checked and, on failure, thrown
as an `AppError` with a message safe to show a user (auth expiry,
duplicate title, offline, or a fallback). Hooks catch `AppError` and
put its `.message` into `error` state; `logError()` is the single
funnel for console logging today and the place to wire a reporting
SDK later. Components never see a raw Postgrest error object.

## 7. Types

The project stays JavaScript, but `src/types/index.js` defines every
shared shape (`LibraryEntry`, `LibraryEntryInput`, `Page`,
`LibraryCounts`, etc.) as JSDoc typedefs, and every repository/service
function is annotated with `@param`/`@returns` referencing them.
Editors get full autocomplete, and running `npx tsc --checkJs
--allowJs --noEmit` type-checks the whole project without adding a
build step. Moving to real `.ts` files later is a mechanical
copy-paste of these typedefs into `interface`s.

## 8. Prepared for offline caching

`utils/cache.js` is a tiny abstraction (`get`/`set`/`remove`) over
`localStorage`. `UserLibraryService.getPage` writes the first,
unfiltered page of each status tab through this cache on every
successful fetch, and reads it back as a fallback if the network
request fails — so a user who opens the app offline still sees their
most recent Watchlist/Watching/Watched instead of a blank error
screen. This is a fallback, not full offline sync (writes made while
offline aren't queued yet) — but because nothing outside
`cache.js` knows it's `localStorage`, upgrading to IndexedDB (bigger
quota, structured queries) or wiring in a write queue is contained to
that one file plus the two call sites in `UserLibraryService`.

## 10. TMDB integration

Global search (search mode 2) is now real: it searches TMDB's actual
catalogue instead of only Memora's own `titles` table.

### Keeping the API key off the client

The TMDB API key **never ships to the browser**. Instead:

```
Browser → supabase.functions.invoke("tmdb-search")
            → Supabase Edge Function (Deno, server-side)
                → reads TMDB_API_KEY from a Supabase secret
                → calls api.themoviedb.org
                → returns filtered results
```

`src/repositories/TMDBRepository.js` only ever calls
`supabase.functions.invoke(...)` — it has no knowledge of TMDB's
actual URL or credential. The key lives exclusively in
`supabase/functions/tmdb-search/index.ts`, read via
`Deno.env.get("TMDB_API_KEY")`, set as a secret (not an env var
bundled by Vite, so it can never end up in client JS):

```bash
supabase functions deploy tmdb-search
supabase secrets set TMDB_API_KEY=your-tmdb-v4-read-access-token
```

This is deliberately the *only* safe option for a pure client-side
app with no server of your own — a `VITE_TMDB_API_KEY` would be
compiled straight into the JS bundle and readable by anyone. If you
later add a dedicated backend, the same pattern applies: proxy
through it instead of the edge function, but never through the
client.

### New layers

- **`TMDBRepository`** — transport only, calls the edge function.
- **`TMDBService`** — the only place that knows TMDB's response
  shape. `search()` filters to movies/TV (drops people), and maps
  each result into the app's `Title` shape (`toTitle`), building
  poster/backdrop URLs from TMDB's image CDN and extracting a release
  year from `release_date`/`first_air_date`.
- **`GlobalTitleSearchService`** now composes `TMDBService` as the
  primary provider and falls back to the local `titles` catalogue
  (via `GlobalTitleSearchRepository`) only if TMDB is unreachable —
  edge function down, secret not configured, network error. No caller
  needs to know which path served a given result.
- **`TitlesService.findOrCreateFromTmdb`** — the TMDB-sourced
  counterpart to `findOrCreateTitleId`. Dedupes on `tmdb_id` (the
  reliable key — the manual-entry path dedupes on `(title, type)`,
  which two different shows can share). If a create hits the unique
  constraint (a race, or a pre-existing manual entry for the same
  title), it re-resolves the existing row instead of failing.
- **`UserLibraryService.addTitleFromTmdb`** — same duplicate-safety
  guarantees as `addTitle` (see §"Fixes" below / `insertTrackingRow`),
  just resolving the catalogue row through TMDB instead of by name.

### UI

The Add-title modal now opens with a **Search / Manual** toggle
(same visual language — same modal, same tokens, no new colors).
Search mode shows a text input and a scrollable result list, each row
with a poster thumbnail (or the same initials-avatar fallback used
elsewhere when there's no poster), title, year, and type icon, plus
an Add button. Manual mode is exactly the pre-TMDB form, unchanged,
for anything not on TMDB.

Loading/empty/error states for search live in `GlobalSearchTab.jsx`
via `useGlobalTitleSearch`:
- **Loading** — the same `LoadingState` spinner used elsewhere, shown
  while a debounced (350ms) query is in flight.
- **Empty** — "Start typing…" before a query, or "No matches for…"
  after one that returns nothing.
- **Error** — the same `ErrorBanner` used elsewhere, for a failed
  search request itself. A failure while *adding* a result (e.g.
  "This title is already in your library.") surfaces through the
  existing library `ErrorBanner` above the toolbar, same as manual
  adds.

### Known limitations (by design, not oversights)

- TMDB's `/search/multi` doesn't return genre names (only
  `genre_ids`), episode counts, runtime, or status — those stay
  `null` until a details-endpoint call (`/movie/{id}` or `/tv/{id}`)
  is added. `TMDBService.toTitle` documents each one at the field
  it's missing from.
- `imdb_id` similarly requires a separate `/external_ids` call.
- Duplicate prevention checks `tmdb_id` first; if a title was already
  added manually (no `tmdb_id`) under the same `(title, type)`, the
  TMDB import points the user's library entry at that *existing* row
  rather than creating a duplicate — but it doesn't retroactively
  enrich that row with TMDB metadata, since `titles` intentionally
  has no client-side UPDATE policy.

## 11. Duplicate-safe adds (recap)

Both `addTitle` (manual) and `addTitleFromTmdb` (TMDB) go through the
same private `insertTrackingRow` helper in `UserLibraryService`:
check `UserLibraryRepository.findByUserAndTitle` first for a clear
"This title is already in your library." message, then insert via
`UserLibraryRepository.insert`, which itself is an `upsert(...,
{ onConflict: "user_id,title_id", ignoreDuplicates: true })` — so
even a race between two adds never surfaces a raw Postgres
unique-violation.

## 12. What stayed the same

- Every file in `src/components/` — visual output is identical (the
  Add-form's new Search/Manual toggle uses the same tokens as
  everything else; no new colors or fonts introduced).
- `src/styles.js` — all original color/type tokens untouched (new
  entries only added, nothing changed).
- `lib/supabaseClient.js` — same client setup.

## 13. Title Details page

Clicking anywhere on a `TitleCard` (not the pencil/trash icons, which
still open the quick-edit form and delete respectively) opens
`TitleDetailsModal`: a richer view with the backdrop image, an
overlapping poster, title, release year, type, TMDB's own status and
audience rating (`voteAverage`, shown alongside — not instead of —
the user's own rating), and the overview, followed by an editable
section for status, personal rating, season/episode (TV only), and
notes.

**No new architecture** — `TitleDetailsModal` never imports a service
or `supabase`. `App.jsx` looks the current entry up fresh from
`library.items` each render (so the modal reflects optimistic updates
immediately, and closes itself if a status change moves the item off
the current tab) and passes `library.updateEntry` down as `onSave` —
the exact same hook function the pencil-icon edit flow already uses.
No new hook or service was needed.

Getting the extra display fields (poster, backdrop, overview, TMDB's
status/rating) onto each `LibraryEntry` required widening two existing
functions, not adding new ones:
- `UserLibraryRepository`'s `SELECT_COLUMNS` now also selects those
  columns from the joined `titles` row.
- `UserLibraryService.toLibraryEntry` maps them onto the `LibraryEntry`
  objects every screen already consumes.

This also needed one small schema addition — `titles.vote_average`
(TMDB's audience score, 0–10) — since the previous metadata expansion
didn't include it and the brief asks for a title's own rating
alongside the user's. Same pattern as the rest of §"Metadata
expansion": nullable, `add column if not exists`, safe to re-run.

## 14. Continue Watching

A horizontal row above the tabs, always visible regardless of which
tab is active, showing in-progress TV shows (status "watching") with
poster, title, season/episode, and a thin progress bar when
`totalEpisodes` is known.

**No new service method** — `ContinueWatchingRow` is fed by a second
call to the existing `useUserLibrary` hook, just scoped to
`status: "watching"` instead of whatever tab is selected:

```js
const continueWatching = useUserLibrary({ userId: user.id, status: "watching", search: "" });
const continueWatchingItems = continueWatching.items.filter((it) => it.type === "tv").slice(0, 12);
```

Filtering to TV shows and capping the row length happens in `App.jsx`,
not in a service — `UserLibraryService.getPage` already returns
everything with status "watching"; narrowing that to "and it's a TV
show, and just the first 12" is presentation logic, not a new query
shape worth a repository/service change.

Clicking a card opens the same `TitleDetailsModal` as the main grid.
Because a card can now be opened from *either* `useUserLibrary`
instance, `App.jsx`'s details wiring was widened slightly: the
details lookup checks both instances' `items`, and saving updates
whichever instance actually contains the entry, then refreshes both —
so editing a show from Continue Watching also updates it if it's
visible in the Watching tab's grid, and vice versa.

## 15. Stats — "Entertainment Passport"

Same data source as before (`useLibraryStats` → the existing
`UserLibraryService.getAllForStats`, unpaginated, no new method),
just a redesigned `StatsView` and a widened `LibraryEntry`:

- **Passport header card** — a dashed "stamp" badge, the total
  tracked-title count as a large headline, and "Tracking since
  {month year}" computed from the earliest `addedAt` across the
  user's own titles (real data, not fabricated).
- **Stat cards** — Watched, Watching, Watchlist, Hours logged,
  Average rating, and Top type (Movies vs TV), each with a small
  icon, in the same card grid style as the rest of the app.
- **Insights card** — a Movies/TV split bar (amber vs teal, matching
  the existing palette) plus one or two short sentences: top genre
  (if any title has one) and average rating (if anything's been
  rated).
- **Empty state** — zero tracked titles shows one line ("Your
  passport is unstamped…") instead of a grid of zeros.

All computed client-side in `StatsView` from the `titles` array it's
given — no new service, repository, or Supabase call, same as before.

**One data-accuracy improvement, not just visual:** the hours
estimate previously assumed a flat 2h/movie and 45min/episode.
`titles.runtime` already existed in the schema (added during the
TMDB metadata expansion) but wasn't being selected for library
entries. It's now included in `UserLibraryRepository`'s
`SELECT_COLUMNS` and mapped to `LibraryEntry.runtimeMinutes` in
`UserLibraryService.toLibraryEntry` — the same "widen the existing
mapping" pattern used for the Details page and Continue Watching, not
a new table or column. `StatsView` uses the real runtime when a title
has one (from TMDB) and falls back to the flat estimate only for
manually-added titles that don't.

## 16. Milestone 2 — Core Experience

A full pass across navigation, Home, Search, Profile, Settings,
image/animation/responsive/accessibility/performance polish, and
docs. See `CHANGELOG.md` for the itemized list and `ARCHITECTURE.md`
for the full file map — this section covers the design decisions
that needed real judgment calls, stated plainly rather than buried.

### Screens are now self-contained

`App.jsx` stopped owning data hooks entirely. It's a screen switcher
(`home | library | search | profile | settings`) plus `<BottomNav>`.
Every screen — `HomeScreen`, `LibraryScreen`, `SearchScreen`,
`ProfileScreen`, `SettingsScreen` — owns whichever hooks it needs and
mounts them only while it's the active screen. See
`ARCHITECTURE.md`'s screens table for exactly which hooks each one
owns.

`LibraryScreen` (the original tabbed Watchlist/Watching/Watched grid)
isn't a bottom-nav destination — the bottom nav is exactly Home /
Search / Profile / Settings, per spec. It's reached via "View All"
from the Watchlist Preview, and is given a fresh `key` on every
entry so it fully remounts (fresh hook instance, fresh fetch) instead
of ever showing stale data from a previous visit.

### The Recent Activity feed needed a real table, not a fake one

The brief's examples ("Added Breaking Bad", "Finished Interstellar",
"Rated The Bear ★★★★★", "Moved Dune to Watching") describe a true
event history. `user_titles` only stores *current* state — it has no
memory of what changed, when, or from what. There were two honest
options: fabricate a plausible-looking feed from `added_at`/`updated_at`
(which can't actually distinguish "rated" from "moved to watching,"
or show more than one event per title), or add a real log.

I added `activity_log` — append-only, RLS-scoped to the owning user,
written by `UserLibraryService` alongside its existing mutations
(`ActivityService.log(...)`, best-effort: a logging failure is
reported but never blocks or rolls back the write it's describing).
This is the one schema change in this milestone. Flagging it clearly
because "no new tables" is a real constraint some teams hold to; if
that's a hard rule here, the fallback is a *labeled* best-effort feed
built from `added_at` only ("Added X"), with the "Finished"/"Rated"/
"Moved" event types removed rather than faked.

### Virtualization: recommended, not implemented

The brief asks to "virtualize long lists where appropriate." I did
not add `react-window` (or similar) in this pass. Reasoning: this
environment can't run a browser to actually verify a virtualized grid
renders, scrolls, and resizes correctly — shipping unverified
virtualization code would trade a real (if modest) performance risk
for a real, higher risk of a broken list, which conflicts with "do
not introduce technical debt" more than skipping it does. The existing
pagination + infinite scroll (`useUserLibrary`, `useInfiniteScroll`)
already bounds how many `TitleCard`s exist in the DOM at once — that's
the practical mitigation in place today. `TitleCard` and Continue
Watching's cards are memoized (`React.memo`) so re-renders are cheap
regardless. If/when this is tested in a real browser, `react-window`'s
`FixedSizeGrid` is the natural next step for `LibraryScreen`'s grid.

### Home prefetches on login rather than lazily per-visit

`HomeScreen` mounts several `useUserLibrary` instances (Continue
Watching, Recently Added, Watchlist Preview) plus stats and activity.
Since `HomeScreen` only mounts once per login (screen-switching
doesn't unmount it unless you navigate away and back), these fetch
once up front rather than on every visit — a deliberate prefetch, not
a leak. The cost is a handful of extra requests immediately after
sign-in even if the person heads straight to Settings. Given
`getPage`'s cache fallback and the small payloads involved, this
reads as the right trade for a "feels like Netflix" dashboard that's
already warm by the time someone taps Home.

### Responsive design

Card rows/grids (`styles.grid`, `styles.statsGrid`, `styles.continueRow`,
search results) already used CSS `auto-fill`/`auto-fit` before this
milestone, which is inherently responsive with no JavaScript needed.
The one thing that needed a deliberate decision was overall page
width: `useMediaQuery` (new) widens the header/main content on large
desktop (≥1440px) instead of stretching to full width. Bottom nav
stays centered at the same max width as the header/main for visual
consistency across breakpoints.

### Accessibility touches in this pass

`aria-label`s on icon-only buttons (edit/remove/close/nav items),
`aria-current="page"` on the active bottom-nav item, `aria-expanded`
on Settings' expandable rows, real `alt` text on poster/backdrop
images (`"{title} poster"`, not empty strings, except where an
adjacent visible title makes it decorative), and keyboard activation
(Enter/Space) preserved on clickable cards. Focus-visible styling was
already global from before this milestone and needed no changes.

## Setup

```bash
npm install
cp .env.example .env      # fill in your Supabase project URL + anon key
npm run dev
```

Run `supabase/schema.sql` against your Supabase project (safe to
re-run if you already have the v1 schema — see §"Metadata expansion"
above).

For TMDB search to work, also deploy the edge function and set its
secret (see §10 above):

```bash
supabase functions deploy tmdb-search
supabase secrets set TMDB_API_KEY=your-tmdb-v4-read-access-token
```

Without this, global search automatically falls back to Memora's own
catalogue (titles other users have already added) instead of failing
outright.
