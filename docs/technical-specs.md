# Technical Specifications: Siftarr

This document outlines the system architecture, database design, API integrations, and scheduling pipelines for Siftarr. The design implements safety guardrails, caching architectures, and transaction flows to ensure application stability and responsiveness.

---

## 1. Database Schema (`siftarr.db`)

Siftarr uses SQLite (`better-sqlite3`) to store settings, cache external API responses, manage the deletion review queue, and log curation activities.

### 1.1. Table: `settings`
Stores configuration values. Eliminates the need for text-based YAML configuration files.
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
*Standard Keys*: `radarr_url`, `radarr_api_key`, `sonarr_url`, `sonarr_api_key`, `tautulli_url`, `tautulli_api_key`, `tmdb_api_key`, `is_tautulli_enabled`, `quality_profile_mappings`, `delete_file_on_upgrade`, `delete_file_on_downgrade`.

### 1.2. Table: `library_profiles`
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

### 1.3. Table: `arr_cache`
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

### 1.4. Table: `tautulli_cache`
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

### 1.5. Table: `review_queue`
Holds items swiped down/marked for deletion, awaiting confirmation.
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

### 1.6. Table: `activity_log`
Provides an audit log of all completed curation mutations.
```sql
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    action TEXT NOT NULL,         -- 'upgrade_remux', 'downgrade_webdl', 'delete', etc.
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2. API Pipelines & Curation Logic

### 2.1. API PUT Payload Completeness & File Deletion Logic
When updating a movie's quality profile in Radarr (`PUT /api/v3/movie/{id}`), Siftarr implements a GET-modify-PUT pipeline:
1. **GET**: Retrieve the full, up-to-date movie object from Radarr.
2. **Modify**: Update only the `qualityProfileId` in memory.
3. **Compare**: Compare the rank of the current quality profile with the rank of the target quality profile to classify the action as an **Upgrade** or a **Downgrade**.
4. **Conditional Disk Cleanup**:
   - If Siftarr detects an **Upgrade** and the setting `delete_file_on_upgrade` is active: the backend queries the movie's active file ID and calls Radarr's `DELETE /api/v3/moviefile/{fileId}` endpoint to delete the file before making the profile update.
   - If Siftarr detects a **Downgrade** and the setting `delete_file_on_downgrade` is active: the backend calls Radarr's `DELETE /api/v3/moviefile/{fileId}` to clear the existing file before updating the profile.
5. **PUT**: Send the complete, modified object back to Radarr. This guarantees that custom paths, tags, genres, or metadata are not dropped during execution.
6. **Search Trigger**: Dispatch a search command (`MoviesSearch`) to force Radarr to query indexers and download a fresh file immediately.

### 2.2. Radarr Custom Format Parsing
Instead of re-implementing TRaSH scoring logic, Siftarr queries Radarr's `GET /api/v3/movie` API and extracts the score directly from the movie's active file payload:
* Read `movie.movieFile.quality.customFormatScore` to get the current custom format score.
* Read the `movie.movieFile.customFormats` array to extract active TRaSH tags (e.g. Dolby Vision, HDR10, Atmos, preferred release groups).

### 2.3. Tautulli API Integrations
For active libraries, Siftarr resolves rating keys and pulls playback details:
* **Lookup**: `GET /api/v2?apikey={key}&cmd=get_library_media_info`
  - Filters by `section_id={tautulli_section_id}` to isolate Plex libraries.
  - Matches the item's TMDB ID or TVDB ID to Plex metadata.
* **Watch Stats**: `GET /api/v2?apikey={key}&cmd=get_item_watch_time_stats&rating_key={rating_key}`
  - Fetches play count, watch duration, and last played timestamp.

### 2.4. Recyclarr Integration Compatibility
Siftarr is built to be compatible with **Recyclarr** and automated **TRaSH Guides** setups:
* **Item-Level Assignment**: Siftarr modifies only the `qualityProfileId` field inside individual movie or show entities (the same as changing the profile assignment in the Radarr/Sonarr UI).
* **Profile Definition Safety**: Siftarr does not modify global Quality Profile definitions or Custom Format scoring lists. Since Recyclarr only synchronizes global definitions and scores, scheduled Recyclarr runs will not overwrite Siftarr's per-item profile changes.

---

## 3. Curation Operations & Schedulers

### 3.1. 7-Second Undo Buffer & Neutral Skip Routing
To protect against accidental swipes, Siftarr executes profile updates and deletion queuing through an asynchronous in-memory scheduler:
1. **Action Request**: The user swipes/taps an item. The frontend sends the action to the backend.
2. **Immediate Return**: The backend creates a unique `transaction_id`, registers a pending task in-memory with a 7-second timeout, and returns `200 OK` to the frontend with the ID.
3. **Staging**: The frontend displays a floating Undo Toast with a countdown timer.
4. **Execution/Cancellation**:
   - **Commit**: If 7 seconds elapse without an undo request, the backend executes the API PUT mutation or writes the item to the SQLite `review_queue`, logging the transaction in `activity_log`.
   - **Undo**: If the user clicks `[ UNDO ]` on the frontend, the client sends a `POST /api/curate/undo` with the `transaction_id`. The backend clears the timeout, canceling the staged action, and returns success.
5. **Neutral Skip Bypass**:
   - If the user taps `Keep / Skip` (or inputs a neutral skip command), the client triggers `POST /api/curate/skip`.
   - Siftarr's backend bypasses the 7-second buffer entirely, logs the event directly to the SQLite `activity_log` (with action: `skipped`), and returns immediately to advance the card deck without making any changes in Radarr/Sonarr.

### 3.2. Serialized Deletion Queue Execution
When confirming deletions in the Review Queue, sending dozens of concurrent HTTP DELETE requests to Radarr/Sonarr can overwhelm the container or the server. Siftarr processes deletions sequentially:
* **Pipeline**: Deletions are processed using a serialized queue (e.g. using a promise chain or async queue).
* **Execution**: Each deletion executes sequentially:
  1. Call Radarr/Sonarr `DELETE /api/v3/movie/{id}?deleteFiles=true`.
  2. Remove the row from the local `review_queue` table.
  3. Emit a WebSocket event or update payload to the frontend with the progress (e.g., `3 of 12 items deleted`).
