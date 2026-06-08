-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: library_profiles
CREATE TABLE IF NOT EXISTS library_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    root_folder TEXT,
    tautulli_section_id INTEGER,
    is_enabled INTEGER DEFAULT 1
);

-- Table: arr_cache
CREATE TABLE IF NOT EXISTS arr_cache (
    id INTEGER PRIMARY KEY,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    root_folder TEXT NOT NULL,
    quality_profile_id INTEGER NOT NULL,
    quality_format_source TEXT NOT NULL,
    custom_format_score INTEGER NOT NULL DEFAULT 0,
    custom_format_tags TEXT, -- JSON array
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: tautulli_cache
CREATE TABLE IF NOT EXISTS tautulli_cache (
    external_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    rating_key INTEGER,
    play_count INTEGER DEFAULT 0,
    last_played DATETIME,
    total_watch_time INTEGER DEFAULT 0,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (external_id, media_type)
);

-- Table: review_queue
CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie', 'tv')),
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    path TEXT NOT NULL,
    library_name TEXT NOT NULL,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(media_type, external_id)
);

-- Table: activity_log
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
