# Product Requirements Document (PRD): Siftarr

## 1. Product Vision & Overview
Siftarr is a stateful **"ARR Review Layer"** designed to gamify and simplify self-hosted library curation. Centering around a **Review Inbox** dashboard, Siftarr helps users quickly audit their existing media collection, upgrade or downgrade quality profiles based on actual usage, and prune unwanted files. Using a Tinder-style swipe interface and desktop hotkeys, curation becomes rapid and secure.

To manage development complexity and deliver immediate value, Siftarr's roadmap is divided into three distinct execution phases.

---

## 2. Roadmap Phases & Features

### Phase 1: Core Curation Utility (MVP)
The MVP establishes a stable curation loop for Movies, integrating Radarr and Tautulli watch history.

*   **Review Inbox Dashboard**: A single management feed displaying active Movies in the Radarr library. 
*   **Media Detail Cards**: Displays movie poster, title, year, runtime, active file metadata (resolution, size, and source format e.g. REMUX, BluRay, WEBDL), active Custom Format (CF) scores, and Tautulli Plex watch statistics.
*   **Tautulli Usage Indicators**: Displays play count (e.g. `▶ 12 plays`), last played time (e.g. `🕒 3 weeks ago`), and cumulative watch time. Highlights candidates for deletion (e.g., 0 plays, added >30 days ago).
*   **Curation Actions**:
    *   **Dynamic Quality Upgrades/Downgrades (Left, Right, Up Swipes)**: Instead of hardcoded source types, users map Left, Right, and Up swipes dynamically in Settings to their actual Radarr/Sonarr Quality Profiles (e.g., Left = "HD-1080p", Right = "Ultra-HD", Up = "Remux-2160p").
    *   **Keep / Skip Action**: Press Spacebar/K to bypass the active card instantly. Bypasses the buffer and advances to the next card, logging a "skipped" activity.
    *   **Unmonitor Action**: Tap the Unmonitor button on the back of the card to keep the file on disk but set `monitored: false` in Radarr/Sonarr, preventing future search actions.
    *   **Deletion Action**: A simple swipe down or keyboard hotkey (S/ArrowDown) stages the item for deletion without added friction (e.g., no long-press or double-tap required), since it merely routes the item to a queue for final review before execution.
*   **Sorting & Filtering**: A dashboard control bar allowing users to sort the review stack by: File Size (Largest first for space reclamation), Tautulli Play Count (Least played first for pruning), Custom Format Score, or Date Added.
*   **Safety Undo Buffer**: A configurable safety feature (disabled by default, managed under General Settings). When enabled, performing a swipe profile modification or deletion action triggers a 7-second buffer and a floating bottom toast with a countdown ring and `[ UNDO ]` button. Clicking undo returns the card to the stack immediately. If disabled (default), actions are executed immediately.
*   **Deletion Queue**: A dedicated review screen listing all staged deletions. Items can be individually restored ("Keep") or deleted in bulk sequentially to prevent overloading the server.
*   **Centralized Configuration & Auth**: All application configuration, SQLite database (`siftarr.db`), and log files are stored in a centralized `/config` directory. On first startup, Siftarr generates a unique 32-character API key; all frontend-to-backend communication requires this API key via `X-Api-Key` headers or `?apikey=` query strings.
*   **Dry Run Mode**: A safety toggle (via `dry_run` setting or `SIFTARR_DRY_RUN=true` environment variable). When enabled, Siftarr intercepts all profile writes and file deletion mutations, logging the action but preventing actual filesystem or API updates. The frontend UI conditionally displays a prominent warning banner *only* when Dry Run is active.
*   **File Deletion Settings Behavior**:
    *   **Delete old file when upgrading**: If enabled, Siftarr deletes the active file from disk before triggering the *arr search command, forcing a clean download.
    *   **Delete old file when downgrading**: If enabled, Siftarr deletes the active file from disk before triggering the *arr search command, ensuring the *arr instance grabs a lower-quality release immediately.

---

### Phase 2: Sonarr & Quality Explainability
Phase 2 expands curation to TV series and integrates advanced TRaSH Guides explainability.

*   **Sonarr TV Series Curation**: Adds TV Shows mode.
    *   **Series Scope Safety Warning**: Because modifying a TV show's quality profile in Sonarr affects all episodes in that series, cards show a prominent safety warning: `⚠️ Affects Series: X Seasons, Y Episodes`.
*   **TRaSH Score Explainability UI**: Displays active custom formats (e.g. HDR10, DV, Atmos) and the exact custom format score calculated by Sonarr/Radarr. Displays the expected score/quality gain before triggering an upgrade/downgrade swipe.
*   **Custom Library Profiles**: Allows users to configure multiple custom libraries (e.g., "Movies", "Kids Movies", "Documentaries") that filter the curation feed by specific Radarr/Sonarr root folder paths and Plex/Tautulli section IDs.

---



## 3. UI/UX Design Goals
*   **Aesthetics**: OLED-fatigue prevention theme. Uses soft, dark charcoal/glass panels (`rgba(15, 15, 15, 0.7)`) instead of high-contrast pitch-black blocks.
*   **Tactile Feedback**: Responsive outlines and glows that scale dynamically during card drags.
*   **Friction and Safety**: Curation and deletion actions are designed to be friction-free. High-risk actions (Delete) do not require long-press or confirmation gestures because they route to a Deletion Queue for subsequent review. An optional 7-second undo buffer can be enabled in settings (disabled by default).
*   **Toast Nav Offset**: The safety undo toast bottom positioning is offset above the fixed bottom navigation bar to prevent visual overlaps on mobile devices.
*   **Desktop Hotkey Isolation**: Keyboard hotkeys (W/A/S/D and Arrow Keys) are isolated and disabled whenever focus is in input fields or settings panels.

---

## 4. Technical Architecture
*   **Frontend**: React, Vite, TypeScript, Vanilla CSS, TanStack React Query (for server state synchronization), Framer Motion (for physics-based gestures).
*   **Backend**: Node.js, Express, TypeScript, SQLite (`better-sqlite3` with startup SQL migration engine), Winston (with structured multi-level log files).
*   **State & Caching**: Siftarr operates a local SQLite cache for API results (`arr_cache` and `tautulli_cache`) to speed up loading and prevent API rate-limiting or network delays.
*   **Data Integrity**: Siftarr uses a complete GET-modify-PUT pipeline when communicating quality profile changes to Radarr/Sonarr APIs, guaranteeing that no metadata fields are dropped.

---

## 5. Success Criteria & Verification
1.  **Phase 1 MVP Curation Loop**: Fetching Radarr/Tautulli data, displaying cards, executing 7-second delayed profile updates or deletion queuing, and executing sequential deletions.
2.  **State Management**: Accurate configuration saving/loading in SQLite, settings verification handshakes, and local cache synchronization.
3.  **UI Fluidity**: Zero keyboard shortcut collisions, smooth card physics, and robust desktop keydown input isolation.

---

## 6. Backlog & Future Enhancements
*   **Gamified Library Progress**: A persistent header progress bar displaying `X of Y items curated` and active streak statistics to gamify the curation loop (moved from Phase 1 MVP).
*   **Personalized Discovery & Request Integration**: A potential future discovery feed and swipe-to-add engine to request new content, postponed to the backlog to avoid direct workflow overlap/conflicts with Overseerr/Seerr stacks.
