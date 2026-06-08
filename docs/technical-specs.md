# Technical Specifications: Siftarr

This document outlines the system architecture, database design, API integrations, and scheduling pipelines for Siftarr. The design implements safety guardrails, caching architectures, and transaction flows to ensure application stability and responsiveness.

---

## 1. Application Paths & Configuration

Siftarr stores all user data in a single directory to support simple Docker volume mounting:
*   **Docker Container Path**: `/config`
*   **Local Host Default**: `~/.config/siftarr`
*   **Environment Override**: `SIFTARR_CONFIG_DIR`

The `/config` directory contains:
*   `siftarr.db`: The SQLite database.
*   `logs/`: Folder containing Winston log rotation output:
    *   `siftarr.log`: standard information-level logs.
    *   `siftarr.debug.log`: diagnostic debug-level logs.
    *   `siftarr.trace.log`: granular tracing of HTTP requests, API payloads, and query execution.

### 1.1. API Authentication & Security
On first startup, if no API key exists, Siftarr generates a random 32-character hex string (e.g., using `crypto.randomBytes(16).toString('hex')`) and saves it to the `settings` table. 
*   All requests to the backend server must present this key in the `X-Api-Key` HTTP header or as an `apikey` query parameter.
*   If invalid or missing, the server responds with `401 Unauthorized`.

---

## 2. Database Schema & Migration Engine

Siftarr uses SQLite (`better-sqlite3`) to store settings, cache external API responses, manage the deletion review queue, and log curation activities.
Instead of raw schema creation, Siftarr uses a sequential migration engine running on application startup. Migrations are saved as SQL files in `server/src/db/migrations/` and run within a transaction.

### 2.1. Table: `schema_version`
Tracks database schema migrations:
```sql
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2. Table: `settings`
Stores configuration values. Eliminates the need for text-based YAML configuration files.
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
*Standard Keys*: `api_key`, `dry_run`, `enable_undo`, `radarr_url`, `radarr_api_key`, `sonarr_url`, `sonarr_api_key`, `tautulli_url`, `tautulli_api_key`, `tmdb_api_key`, `is_tautulli_enabled`, `swipe_left_profile_id`, `swipe_right_profile_id`, `swipe_up_profile_id`, `delete_file_on_upgrade`, `delete_file_on_downgrade`.

### 2.3. Table: `library_profiles`
Allows users to segment their collections (e.g. Movies vs Kids Movies).
```sql
CREATE TABLE library_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    root_folder TEXT,              -- Optional path filter (e.g. '/data/media/kids-movies/')
    tautulli_section_id INTEGER,   -- Optional Plex Library Section ID from Tautulli
    is_enabled INTEGER DEFAULT 1
);
```

### 2.4. Table: `arr_cache`
Caches fetched *arr media metadata to ensure fast loading times and avoid network delays.
```sql
CREATE TABLE arr_cache (
    id INTEGER PRIMARY KEY,        -- Matches external_id
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    root_folder TEXT NOT NULL,
    quality_profile_id INTEGER NOT NULL,
    quality_format_source TEXT NOT NULL, -- e.g. REMUX, Bluray, WEBDL
    custom_format_score INTEGER NOT NULL DEFAULT 0,
    custom_format_tags TEXT,       -- JSON array of tag strings (e.g. ['HDR', 'Atmos'])
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.5. Table: `tautulli_cache`
Caches Plex playback metrics linked to TMDB/TVDB identifiers.
```sql
CREATE TABLE tautulli_cache (
    external_id INTEGER NOT NULL,  -- TMDB or TVDB ID
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    rating_key INTEGER,            -- Plex rating key
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    total_watch_time INTEGER DEFAULT 0,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (external_id, media_type)
);
```

### 2.6. Table: `review_queue`
Holds items marked for deletion, awaiting confirmation.
```sql
CREATE TABLE review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER NOT NULL,  -- Radarr/Sonarr ID
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    path TEXT NOT NULL,
    library_name TEXT NOT NULL,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_type, external_id)
);
```

### 2.7. Table: `activity_log`
Provides an audit log of all completed curation mutations.
```sql
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    action TEXT NOT NULL,         -- 'upgrade_profile', 'downgrade_profile', 'delete', 'skipped', 'unmonitored'
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. API Pipelines & Curation Logic

### 3.1. API PUT Payload Completeness & File Deletion Logic
When updating a movie's quality profile in Radarr (`PUT /api/v3/movie/{id}`), Siftarr implements a GET-modify-PUT pipeline:
1. **GET**: Retrieve the full, up-to-date movie object from Radarr.
2. **Modify**: Update only the `qualityProfileId` in memory.
3. **Compare**: Compare the rank of the current quality profile with the rank of the target quality profile to classify the action as an **Upgrade** or a **Downgrade**.
4. **Conditional Disk Cleanup**:
   - If Siftarr detects an **Upgrade** and the setting `delete_file_on_upgrade` is active: the backend queries the movie's active file ID and calls Radarr's `DELETE /api/v3/moviefile/{fileId}` endpoint to delete the file before making the profile update.
   - If Siftarr detects a **Downgrade** and the setting `delete_file_on_downgrade` is active: the backend calls Radarr's `DELETE /api/v3/moviefile/{fileId}` to clear the existing file before updating the profile.
5. **PUT**: Send the complete, modified object back to Radarr. This guarantees that custom paths, tags, genres, or metadata are not dropped during execution.
6. **Search Trigger**: Dispatch a search command (`MoviesSearch`) to force Radarr to query indexers and download a fresh file immediately.

### 3.2. Radarr Custom Format Parsing
Siftarr queries Radarr's `GET /api/v3/movie` API and extracts custom format details:
*   Read `movie.movieFile.quality.customFormatScore` to get the current custom format score.
*   Read the `movie.movieFile.customFormats` array to extract active TRaSH tags (e.g., HDR10, Atmos).

### 3.3. Tautulli API Integrations
For active libraries, Siftarr resolves rating keys and pulls playback details:
*   **Lookup**: `GET /api/v2?apikey={key}&cmd=get_library_media_info`
*   **Watch Stats**: `GET /api/v2?apikey={key}&cmd=get_item_watch_time_stats&rating_key={rating_key}`

---

## 4. Curation Operations & Schedulers

### 4.1. Configurable Client-Side 7-Second Undo Buffer & Neutral Skip Routing
1. **Setting Control**: The undo buffer is controlled by the `enable_undo` setting (boolean, default: `false`).
2. **When Disabled (Default)**:
    - Triggering a curation swipe or hotkey immediately dispatches the request payload (`POST /api/v1/curate`) to the backend.
    - The backend processes the change immediately and returns `200 OK`. The UI instantly advances to the next card. No toast or countdown is displayed.
3. **When Enabled**:
    - Triggering a curation action (swipe or hotkey) starts a local 7-second countdown on the client and displays the floating Undo Toast offset from the bottom navigation.
    - **Commit**: If the 7-second countdown reaches 0 without interruption, the client dispatches the curate payload (`POST /api/v1/curate`) to the backend for immediate execution.
    - **Undo**: If the user clicks `[ UNDO ]` during the 7-second window, the client cancels the local timer and returns the active card to the card stack. No API call is made.
    - **Neutral Skip Bypass**: If the user skips (Spacebar/K), the client bypasses the timer entirely, dispatches the skip request (`POST /api/v1/curate/skip`) to the backend immediately to log the action, and advances the card deck.

### 4.2. Serialized Deletion Queue Execution
When confirming deletions in the Review Queue, Siftarr processes deletions sequentially:
*   **Pipeline**: Deletions are processed using an async queue.
*   **Execution**: Each deletion executes sequentially:
    1. Call Radarr/Sonarr `DELETE /api/v3/movie/{id}?deleteFiles=true`.
    2. Remove the row from the local `review_queue` table.
    3. Emit a progress event or update payload to the frontend with the progress (e.g. `3 of 12 items deleted`).
