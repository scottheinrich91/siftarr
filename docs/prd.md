# Product Requirements Document (PRD): Siftarr

## 1. Product Vision & Overview
Siftarr is a stateful **"ARR Review Layer"** designed to gamify and simplify self-hosted library curation. Centering around a **Review Inbox** dashboard, Siftarr helps users quickly audit their existing media collection, upgrade or downgrade quality profiles based on actual usage, and prune unwanted files. Using a Tinder-style swipe interface, card tap buttons, and desktop hotkeys, curation becomes rapid and secure.

To manage development complexity and deliver immediate value, Siftarr's roadmap is divided into three distinct execution phases.

---

## 2. Roadmap Phases & Features

### Phase 1: Core Curation Utility (MVP)
The MVP establishes a stable curation loop for Movies, integrating Radarr and Tautulli watch history.

*   **Review Inbox Dashboard**: A single management feed displaying active Movies in the Radarr library. 
*   **Media Detail Cards**: Displays movie poster, title, year, runtime, active file metadata (resolution, size, and source format e.g. REMUX, BluRay, WEBDL), and Tautulli Plex watch statistics.
*   **Tautulli Usage Indicators**: Displays play count, last played time, and cumulative watch duration. Highlights candidates for deletion (e.g., 0 plays, added >30 days ago).
*   **Curation Actions**:
    *   **Downgrade to WebDL**: Swipe Left or tap the WebDL button.
    *   **Upgrade to BluRay**: Swipe Right or tap the BluRay button.
    *   **Upgrade to Remux**: Swipe Up or tap the Remux button.
    *   **Queue for Deletion**: Swipe Down or tap the Delete button.
    *   **Keep / Skip as-is**: Tap the Skip/Keep button (checkmark icon) or use a neutral skip action to advance to the next card without making any modifications.
*   **Safety Undo Buffer**: A 7-second undo window. When a curation action is taken, it is staged temporarily, and a floating toast with an `[ UNDO ]` button appears. The actual database/API updates are committed only after the 7-second buffer expires.
*   **Deletion Queue**: A dedicated review screen listing all staged deletions. Items can be individually restored ("Keep") or deleted in bulk.
*   **SQLite Settings Store**: Configuration for Radarr and Tautulli credentials, default profiles, mapping tables, and behavior flags are stored directly in the SQLite database. This includes user-toggleable checkboxes:
    *   **Delete old file when upgrading**: If enabled, Siftarr deletes the active file from disk before triggering the *arr search command, forcing a clean download.
    *   **Delete old file when downgrading**: If enabled, Siftarr deletes the active file from disk before triggering the *arr search command, ensuring the *arr instance grabs a lower-quality release immediately.

---

### Phase 2: Sonarr & Quality Explainability
Phase 2 expands curation to TV series and integrates advanced TRaSH Guides explainability.

*   **Sonarr TV Series Curation**: Adds TV Shows mode.
    *   **Series Scope Safety Warning**: Because modifying a TV show's quality profile in Sonarr affects all episodes in that series, cards show a prominent safety warning: `⚠️ Affects: Entire Series (X Seasons, Y Episodes)`.
*   **TRaSH Score Explainability UI**: Displays active custom formats (e.g. HDR10, DV, Atmos) and the exact custom format score calculated by Sonarr/Radarr. Displays the expected score/quality gain before triggering an upgrade/downgrade swipe.
*   **Custom Library Profiles**: Allows users to configure multiple custom libraries (e.g., "Movies", "Kids Movies", "Documentaries") that filter the curation feed by specific Radarr/Sonarr root folder paths and Plex/Tautulli section IDs.

---

### Phase 3: Personalized Discovery
Phase 3 adds recommendations, enabling users to explore new media and add them to their download queues.

*   **Discovery Mode**: Browse media not present in the library (pulled from TMDB trending, popular, and genre lists).
*   **Swipe to Add**: Swipe Right to add a movie/show to the download queue, or Swipe Left to skip (saving to a local skip list).
*   **Personalized Taste Profile**: A local recommendation engine that updates weight profiles (based on genres, release decades, directors, and actors) from swiping behavior and frequent Tautulli playback indicators.

---

## 3. UI/UX Design Goals
*   **Aesthetics**: OLED-fatigue prevention theme. Uses soft, dark charcoal/glass panels (`rgba(15, 15, 15, 0.7)`) instead of high-contrast pitch-black blocks. 
*   **Tactile Feedback**: Responsive outlines and glows that scale dynamically during card drags.
*   **Tap Buttons**: Layout includes clear tap buttons below the card stack for quick, one-handed touch navigation.
*   **Safety Toast**: A persistent bottom toast showing a countdown timer (e.g. `Undoing in 5s...`) and a prominent `UNDO` button.
*   **Desktop Hotkey Isolation**: Keyboard hotkeys (W/A/S/D and Arrow Keys) are isolated and disabled whenever focus is in input fields or settings panels.

---

## 4. Technical Architecture
*   **Frontend**: React, Vite, TypeScript, TailwindCSS/Vanilla CSS, Framer Motion.
*   **Backend**: Node.js, Express, TypeScript, SQLite (`better-sqlite3`).
*   **State & Caching**: Siftarr operates a local SQLite cache for API results (`arr_cache` and `tautulli_cache`) to speed up loading and prevent API rate-limiting or network delays.
*   **Data Integrity**: Siftarr uses a complete GET-modify-PUT pipeline when communicating quality profile changes to Radarr/Sonarr APIs, guaranteeing that no metadata fields are dropped.

---

## 5. Success Criteria & Verification
1.  **Phase 1 MVP Curation Loop**: Fetching Radarr/Tautulli data, displaying cards, executing 7-second delayed profile updates or deletion queuing, and executing sequential deletions.
2.  **State Management**: Accurate configuration saving/loading in SQLite, settings verification handshakes, and local cache synchronization.
3.  **UI Fluidity**: Zero keyboard shortcut collisions, smooth card physics, and robust desktop keydown input isolation.
