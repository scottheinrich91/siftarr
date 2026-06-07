# Technical Specifications: Siftarr

This document outlines the system architecture, database design, API interfaces, and algorithms for Siftarr. Siftarr is designed to align with **TRaSH Guides** media management best practices and follow standard **\*arr application** development patterns, ensuring security, maintainability, and stability.

---

## 1. Codebase Architecture Patterns

To align with standard \*arr applications, Siftarr implements a layered backend architecture in Node.js/TypeScript:

```
src/
├── config/             # YAML Config parser & settings schema
├── db/
│   ├── migrations/     # SQL schema migration files
│   ├── connection.ts   # SQLite database connection manager
│   └── migrationRunner.ts # Automated startup migration runner
├── repositories/       # Data Access Layer (SQLite operations)
├── services/           # Business Logic Layer (recommendations, proxy logic)
├── api/                # HTTP Client wrappers (Radarr, Sonarr, TMDB)
├── controllers/        # Express Route Controllers (request/response handling)
├── utils/              # Structured logger, validation utilities
└── server.ts           # Application entry point
```

### 1.1. Data Access & Repositories
*   Direct SQLite queries are strictly confined to the `repositories/` layer.
*   Uses `better-sqlite3` for performance with pre-compiled prepared statements initialized on server startup.
*   Transactions are utilized for batch operations (e.g. deletion queue confirmations).

### 1.2. Database Migration System
*   On startup, Siftarr runs an automated migration runner before binding the server port.
*   Migrations are SQL files located in `src/db/migrations/` (e.g., `001_init.sql`, `002_add_sonarr.sql`).
*   A metadata table `schema_migrations` tracks applied versions.

### 1.3. Structured Logging
*   Utilizes `winston` for robust logging.
*   Logs are output in a readable format to `console` and written as structured JSON/log lines to a rotating log file: `/config/logs/siftarr.log`.
*   Supports runtime logging levels: `debug`, `info`, `warn`, `error`.

### 1.4. YAML-Based Configuration
*   Siftarr reads runtime settings from `/config/config.yml`.
*   *arr standard example:
    ```yaml
    server:
      port: 8085
      host: 0.0.0.0
    database:
      path: /config/siftarr.db
    logging:
      level: info
      directory: /config/logs
    cors:
      allowed_origins:
        - "http://localhost:5173"
    radarr:
      url: "http://localhost:7878"
      api_key: "your_radarr_api_key_here"
      enabled: true
    sonarr:
      url: "http://localhost:8989"
      api_key: "your_sonarr_api_key_here"
      enabled: false # Can be disabled or omitted
    tautulli:
      url: "http://localhost:8181"
      api_key: "your_tautulli_api_key_here"
      enabled: true # Optional integration
    ```

---

## 2. TRaSH Guides & Media Quality Integration

TRaSH Guides recommends prioritizing media quality using **Quality Profiles** combined with **Custom Formats (CF)** scoring rules (e.g. preferring HDR, Atmos, specific high-tier release groups, while penalizing CAMs or hardcoded subtitles).

### 2.1. Dynamic Custom Format Parsing
When fetching the library in Management Mode, Siftarr retrieves active file metadata from Radarr/Sonarr. Siftarr parses this data to display **TRaSH Guide Tags** on card overlays:
*   **Source/Quality**: Remux, Bluray, WEB-DL, HDTV (extracted from the file's quality profile field).
*   **Video Codec**: HEVC (x265), AVC (x246), AV1.
*   **Audio Codecs/Channels**: Dolby Atmos, TrueHD, DTS-HD MA, DD+ 5.1.
*   **Dynamic Range**: Dolby Vision (DV), HDR10+, HDR10, SDR.
*   **Custom Format Scores**: Siftarr queries the Custom Formats list from the active Radarr/Sonarr instances. If files match specific custom format regexes, the card displays their active **Custom Format Score** (e.g., `+100` or `+500`), highlighting whether the item meets TRaSH Guides criteria.

### 2.2. Upgrading Quality via Swipe Mappings
Instead of managing dozens of individual resolutions, Siftarr maps swipes directly to quality profiles that are managed via **Recyclarr** or manual TRaSH Guide rules:
*   **Standard Swipe**: Maps to a base Quality Profile (e.g., "HD-1080p") that has a custom format cutoff score of `0`.
*   **Really Good Swipe**: Maps to an upgraded Quality Profile (e.g., "Web-1080p / 2160p") with a custom format cutoff score (e.g., `+100`).
*   **God Tier Swipe**: Maps to a premium Quality Profile (e.g., "UHD-Remux / WEB") with the highest custom format priorities enabled (e.g., `+500`).

---

## 3. Database Schema

### 3.1. Table: `skipped_items`
```sql
CREATE TABLE skipped_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    skipped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tmdb_id, media_type)
);
```

### 3.2. Table: `taste_profiles`
```sql
CREATE TABLE taste_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    attribute_type TEXT NOT NULL CHECK(attribute_type IN ('genre', 'person', 'decade')),
    attribute_value TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 0.0,
    UNIQUE(media_type, attribute_type, attribute_value)
);
```

### 3.3. Table: `deletion_queue`
```sql
CREATE TABLE deletion_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    external_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    path TEXT,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_type, external_id)
);
```

---

## 4. external API Interfaces (Proxy Layer)

### 4.1. Radarr API v3
*   `GET /api/v3/movie` (Retrieves full library including nested `movieFile` objects to extract resolution, audio, custom formats, and size).
*   `PUT /api/v3/movie/{id}` (Updates Assigned `qualityProfileId` for the movie).
*   `POST /api/v3/command` with `{ name: "MoviesSearch", movieIds: [id] }` (Forces Radarr to query trackers for updates matching the new profile).

### 4.2. Sonarr API v3
*   `GET /api/v3/series` (Retrieves library series details).
*   `GET /api/v3/series/{id}` (Retrieves series profile information).
*   `GET /api/v3/episodefile?seriesId={id}` (Retrieves episode files metadata to extract series resolution, size, and custom formats).
*   `PUT /api/v3/series/{id}` (Updates Assigned `qualityProfileId` for the series).
*   `POST /api/v3/command` with `{ name: "SeriesSearch", seriesId: id }` (Triggers Sonarr search for the series).

### 4.3. TMDB API v3
*   `GET /3/trending/{movie|tv}/week`
*   `GET /3/{movie|tv}/popular`
*   `GET /3/{movie|tv}/{id}?append_to_response=credits` (Fetches metadata for recommendation parsing).

### 4.4. Tautulli API v2 (Optional)
If configured in Siftarr's settings, Siftarr queries Tautulli to retrieve watch stats for items in the library.
*   **Resolve Rating Key (Movies)**:
    *   Query: `GET /api/v2?apikey={key}&cmd=get_library_media_info`
    *   Parameters: `rating_key` matches are verified by searching for matching TMDB ID (`tmdb_id`) or IMDb ID (`imdb_id`) in Tautulli's metadata.
*   **Resolve Rating Key (TV Shows)**:
    *   Query: `GET /api/v2?apikey={key}&cmd=get_library_media_info`
    *   Parameters: Matches the Sonarr series TVDB ID (`tvdb_id`) or IMDb ID (`imdb_id`) to the Tautulli library rating key.
*   **Retrieve Watch Stats**:
    *   Query: `GET /api/v2?apikey={key}&cmd=get_item_watch_time_stats&rating_key={rating_key}`
    *   Response yields:
        *   `play_count`: Total watch count (Integer). For TV shows, represents cumulative play count across all episodes in the series.
        *   `last_played`: Timestamp of last play activity (String/Epoch). For TV shows, represents the last played timestamp of any episode in the series.
        *   `total_watch_time`: Cumulative watch duration in seconds (Integer).

### 4.5. Dynamic Service Lifecycle & Error Handling
Siftarr is built to run with either or both *arr services configured.
*   **Initialization**: The configuration module validates credentials on startup. Active integrations are flagged (`isRadarrEnabled`, `isSonarrEnabled`, `isTautulliEnabled`).
*   **API Layer Resilience**:
    *   Routes corresponding to disabled services (e.g. `/api/series` when `isSonarrEnabled` is false) return a structured `200 OK` response with `{ enabled: false, items: [] }` or a descriptive error rather than causing server crashes.
    *   Settings page connection tests operate independently. A failure to connect to Sonarr will not prevent Radarr or Tautulli settings from being tested or saved successfully.
    *   The frontend queries `/api/status` on load to learn which services are enabled, dynamically adapting the interface.

---

## 5. Security & Container Best Practices

To make Siftarr reliable and production-ready for GitHub and self-hosted environments:
*   **Non-Root Execution**: The Docker container runs as a non-root `siftarr` user by default.
*   **PUID/PGID Mapping**: On container startup, an entrypoint script reads optional environment variables `PUID` and `PGID` and recursively corrects permissions of `/config` (database, settings, logs) before executing the Node process.
*   **CORS Hardening**: Access from the frontend is secured using Express CORS configurations configured via `config.yml`.
