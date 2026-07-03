/**
 * Central type definitions for Memora. Plain JSDoc typedefs so the
 * project stays JavaScript, but every service/repository function
 * below is annotated with these — editors get full autocomplete and
 * `tsc --checkJs` can type-check the project without a build step
 * change. Swap to real .ts files later by copy-pasting these shapes
 * into interfaces; nothing else about the architecture has to move.
 */

/** @typedef {'movie'|'tv'} TitleType */
/** @typedef {'watchlist'|'watching'|'watched'} LibraryStatus */

/**
 * A row from the shared `titles` catalogue. The metadata fields
 * (tmdbId through status) are nullable — manually-added titles won't
 * have them until a remote provider (e.g. TMDB) backs GlobalTitle-
 * SearchService and populates them on import.
 * @typedef {Object} Title
 * @property {string|null} id                  null for a TMDB result not yet imported into `titles`
 * @property {string} title
 * @property {TitleType} type
 * @property {string|null} genre
 * @property {number|null} totalEpisodes
 * @property {number|null} [tmdbId]             present for anything sourced from TMDB; the dedupe key
 * @property {string|null} [imdbId]
 * @property {string|null} [posterUrl]
 * @property {string|null} [backdropUrl]
 * @property {string|null} [overview]
 * @property {number|null} [releaseYear]
 * @property {number|null} [runtime]          minutes
 * @property {number|null} [popularity]
 * @property {string|null} [originalTitle]
 * @property {string|null} [language]         ISO 639-1, e.g. "en"
 * @property {string|null} [status]           e.g. "Released", "Ended"
 * @property {number|null} [voteAverage]      TMDB's own audience rating, 0-10
 */

/**
 * Which pool a search runs against — a user's own tracked titles, or
 * the full shared catalogue. Kept explicit so hooks/UI can be clear
 * about which UserLibraryService/GlobalTitleSearchService method
 * they mean instead of overloading a single "search" concept.
 * @typedef {'library'|'catalogue'} SearchScope
 */

/**
 * A flattened, UI-ready row: one user's tracking state for one title.
 * This is the shape every component in src/components expects.
 * @typedef {Object} LibraryEntry
 * @property {string} id              user_titles.id — use for update/delete
 * @property {string} titleId         titles.id
 * @property {string} title
 * @property {TitleType} type
 * @property {string|null} genre
 * @property {number|null} totalEpisodes
 * @property {LibraryStatus} status   the USER's tracking status — not to be confused with titleStatus
 * @property {number} rating          the USER's own rating, 0-5
 * @property {string} notes
 * @property {number} currentSeason
 * @property {number} currentEpisode
 * @property {string} addedAt         ISO timestamp
 * @property {string|null} posterUrl
 * @property {string|null} backdropUrl
 * @property {string|null} overview
 * @property {number|null} releaseYear
 * @property {string|null} titleStatus  TMDB's status for the title itself (e.g. "Released"), distinct from `status` above
 * @property {number|null} voteAverage  TMDB's audience rating, 0-10, distinct from the user's own `rating`
 * @property {number|null} runtimeMinutes  movie runtime, or a TV show's average episode runtime, in minutes
 */

/**
 * Payload the Add/Edit form produces. Services turn this into the
 * two writes (titles + user_titles) a new entry needs.
 * @typedef {Object} LibraryEntryInput
 * @property {string} title
 * @property {TitleType} type
 * @property {LibraryStatus} status
 * @property {number} [rating]
 * @property {string} [genre]
 * @property {string} [notes]
 * @property {number} [currentSeason]
 * @property {number} [currentEpisode]
 * @property {number} [totalEpisodes]
 */

/**
 * @typedef {Object} Page
 * @property {LibraryEntry[]} items
 * @property {boolean} hasMore
 * @property {number} total
 */

/**
 * @typedef {Object} LibraryCounts
 * @property {number} watchlist
 * @property {number} watching
 * @property {number} watched
 */

/**
 * A row from the Recent Activity feed.
 * @typedef {Object} ActivityItem
 * @property {string} id
 * @property {string|null} titleId
 * @property {string} titleName
 * @property {'added'|'status_changed'|'rated'|'removed'} action
 * @property {Object} detail   e.g. {from,to} for status_changed, {rating} for rated
 * @property {string} createdAt  ISO timestamp
 */

export {}; // keeps this a module under plain JS tooling
