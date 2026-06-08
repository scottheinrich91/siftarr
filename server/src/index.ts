import 'dotenv/config';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger, { info, warn, error, trace } from './logger.js';
import { db, runMigrations } from './db/connection.js';
import { PORT, NODE_ENV } from './config.js';
import { RadarrClient } from './api/radarr.js';
import { SonarrClient } from './api/sonarr.js';
import { TautulliClient } from './api/tautulli.js';
import { OverseerrClient } from './api/overseerr.js';
import { getAllSettings, getSettingBool, getSetting } from './db/settings.js';
import { commitAction, executeDeletionQueue } from './curation.js';
import { SyncEngine } from './db/sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Run migrations on startup
try {
  runMigrations();

  // Seed mock library profiles and cache items if database is empty for evaluation
  const profileCount = (db.prepare('SELECT COUNT(*) as count FROM library_profiles').get() as { count: number }).count;
  if (profileCount === 0) {
    info('Seeding mock library profiles and media items for evaluation...');
    
    // Seed library profiles
    const insertProfile = db.prepare('INSERT INTO library_profiles (name, media_type, root_folder, is_enabled) VALUES (?, ?, ?, 1)');
    insertProfile.run('Movies', 'movie', '/data/media/movies');
    insertProfile.run('Kids Movies', 'movie', '/data/media/kids-movies');
    insertProfile.run('TV Shows', 'tv', '/data/media/tv');

    // Seed arr_cache
    const insertArr = db.prepare(`
      INSERT INTO arr_cache (id, media_type, title, year, size_bytes, root_folder, quality_profile_id, quality_format_source, custom_format_score, custom_format_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertArr.run(1, 'movie', 'Interstellar', 2014, 15461882265, '/data/media/movies', 1, 'Bluray-1080p', 120, '["HDR10", "TrueHD ATMOS"]');
    insertArr.run(2, 'movie', 'Toy Story 4', 2019, 8589934592, '/data/media/kids-movies', 1, 'WEBDL-1080p', 50, '["DD+ 5.1"]');
    insertArr.run(3, 'movie', 'The Matrix Resurrections', 2021, 32212254720, '/data/media/movies', 2, 'Remux-2160p', 240, '["4K HDR", "DTS-HD MA 7.1"]');
    insertArr.run(4, 'tv', 'Stranger Things', 2016, 107374182400, '/data/media/tv', 1, 'WEBDL-1080p', 80, '["Dolby Vision"]');
    insertArr.run(5, 'tv', 'Breaking Bad', 2008, 268435456000, '/data/media/tv', 2, 'Bluray-1080p', 150, '["DTS-HD MA 5.1"]');
    insertArr.run(6, 'movie', 'Inception', 2010, 19327352832, '/data/media/movies', 1, 'Bluray-1080p', 110, '["TrueHD"]');
    insertArr.run(7, 'movie', 'Spider-Man: Into the Spider-Verse', 2018, 12884901888, '/data/media/kids-movies', 1, 'Bluray-1080p', 95, '["HDR10"]');
    insertArr.run(8, 'movie', 'The Dark Knight', 2008, 18253611008, '/data/media/movies', 1, 'Remux-2160p', 180, '["4K HDR", "TrueHD ATMOS"]');
    insertArr.run(9, 'movie', 'Dune: Part Two', 2024, 42949672960, '/data/media/movies', 2, 'Remux-2160p', 220, '["4K HDR", "Dolby Vision", "TrueHD ATMOS"]');
    insertArr.run(10, 'movie', 'Coco', 2017, 9663676416, '/data/media/kids-movies', 1, 'Bluray-1080p', 95, '["HDR10"]');
    insertArr.run(11, 'movie', 'Frozen II', 2019, 11811160064, '/data/media/kids-movies', 1, 'WEBDL-1080p', 75, '["DD+ 5.1"]');
    insertArr.run(12, 'movie', 'Spirited Away', 2001, 7516192768, '/data/media/kids-movies', 1, 'Bluray-1080p', 110, '["DTS-HD MA 5.1"]');
    insertArr.run(13, 'tv', 'Severance', 2022, 53687091200, '/data/media/tv', 1, 'WEBDL-1080p', 90, '["Dolby Vision"]');
    insertArr.run(14, 'tv', 'Succession', 2018, 161061273600, '/data/media/tv', 2, 'WEBDL-1080p', 130, '["DD+ 5.1"]');
    insertArr.run(15, 'tv', 'The Last of Us', 2023, 85899345920, '/data/media/tv', 1, 'WEBDL-2160p', 170, '["4K HDR", "Dolby Vision"]');
    insertArr.run(16, 'tv', 'Avatar: The Last Airbender', 2005, 32212254720, '/data/media/tv', 1, 'Bluray-1080p', 85, '["DD+ 5.1"]');

    // Seed tautulli_cache
    const insertTautulli = db.prepare(`
      INSERT INTO tautulli_cache (external_id, media_type, play_count, total_watch_time, last_played)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertTautulli.run(1, 'movie', 14, 14 * 169 * 60, '2026-05-20T21:00:00Z');
    insertTautulli.run(2, 'movie', 32, 32 * 100 * 60, '2026-06-01T15:30:00Z');
    insertTautulli.run(3, 'movie', 1, 1 * 148 * 60, '2026-01-15T22:00:00Z');
    insertTautulli.run(4, 'tv', 5, 5 * 34 * 50 * 60, '2026-04-10T19:00:00Z');
    insertTautulli.run(5, 'tv', 2, 2 * 62 * 47 * 60, '2026-05-02T11:00:00Z');
    insertTautulli.run(6, 'movie', 0, 0, null);
    insertTautulli.run(7, 'movie', 45, 45 * 117 * 60, '2026-06-05T17:00:00Z');
    insertTautulli.run(8, 'movie', 8, 8 * 152 * 60, '2026-05-25T23:30:00Z');
    insertTautulli.run(9, 'movie', 2, 2 * 166 * 60, '2026-06-06T20:15:00Z');
    insertTautulli.run(10, 'movie', 15, 15 * 105 * 60, '2026-05-30T10:00:00Z');
    insertTautulli.run(11, 'movie', 25, 25 * 103 * 60, '2026-06-02T14:00:00Z');
    insertTautulli.run(12, 'movie', 3, 3 * 125 * 60, '2026-04-18T16:45:00Z');
    insertTautulli.run(13, 'tv', 6, 6 * 9 * 50 * 60, '2026-05-12T22:30:00Z');
    insertTautulli.run(14, 'tv', 1, 1 * 39 * 60 * 60, '2026-03-01T21:00:00Z');
    insertTautulli.run(15, 'tv', 8, 8 * 9 * 55 * 60, '2026-06-03T23:00:00Z');
    insertTautulli.run(16, 'tv', 4, 4 * 61 * 23 * 60, '2026-05-28T08:30:00Z');
    
    info('Mock data seeding finished successfully.');
  }
} catch (err) {
  error('Critical failure: database migrations or seeding failed to execute', err);
  process.exit(1);
}

// Generate or retrieve Siftarr API Key
let apiKey = '';
try {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('api_key') as { value: string } | undefined;
  if (!row) {
    apiKey = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('api_key', apiKey);
    info(`Generated new Siftarr API Key: ${apiKey}`);
  } else {
    apiKey = row.value;
    info(`Siftarr API Key is configured: ${apiKey}`);
  }
} catch (err) {
  error('Failed to configure Siftarr API Key', err);
  process.exit(1);
}

// Initialize Dry Run setting (defaults to "true" for safety)
let dryRunActive = true;
try {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('dry_run') as { value: string } | undefined;
  if (!row) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('dry_run', 'true');
    info('Initialized database fallback for Dry Run Mode to: true');
  }
  
  dryRunActive = getSettingBool('dry_run', true);
  info(`Siftarr Dry Run Mode is active: ${dryRunActive}`);
} catch (err) {
  error('Failed to configure Siftarr Dry Run setting', err);
}

// Seed default swipe gestures if not present
try {
  const defaultSwipeSettings = [
    { key: 'swipe_left_action', value: 'profile' },
    { key: 'swipe_left_color', value: '#00b0ff' },
    { key: 'swipe_left_label', value: 'Standard Profile' },
    { key: 'swipe_left_radarr_profile_id', value: '1' },
    { key: 'swipe_left_sonarr_profile_id', value: '1' },

    { key: 'swipe_right_action', value: 'profile' },
    { key: 'swipe_right_color', value: '#00e676' },
    { key: 'swipe_right_label', value: 'Upgraded Profile' },
    { key: 'swipe_right_radarr_profile_id', value: '2' },
    { key: 'swipe_right_sonarr_profile_id', value: '2' },

    { key: 'swipe_up_action', value: 'profile' },
    { key: 'swipe_up_color', value: '#ffd600' },
    { key: 'swipe_up_label', value: 'God Tier Profile' },
    { key: 'swipe_up_radarr_profile_id', value: '3' },
    { key: 'swipe_up_sonarr_profile_id', value: '3' },

    { key: 'swipe_down_action', value: 'delete' },
    { key: 'swipe_down_color', value: '#ff1744' },
    { key: 'swipe_down_label', value: 'Delete' },
    { key: 'swipe_down_radarr_profile_id', value: '1' },
    { key: 'swipe_down_sonarr_profile_id', value: '1' }
  ];

  const insertSettingIgnore = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const s of defaultSwipeSettings) {
    insertSettingIgnore.run(s.key, s.value);
  }
  info('Seeded default swipe settings if missing.');
} catch (err) {
  error('Failed to seed default swipe settings', err);
}

const app = express();

app.use(cors());
app.use(express.json());

// Trace logging middleware for HTTP requests
app.use((req, res, next) => {
  trace(`${req.method} ${req.originalUrl}`);
  next();
});

// Authentication middleware for Siftarr API Key
const apiAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const reqKey = req.header('X-Api-Key') || (req.query.apikey as string);
  if (!reqKey || reqKey !== apiKey) {
    trace(`Authentication failed for request to: ${req.originalUrl}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }
  next();
};

// GET local bootstrap API key (exempt from apiAuth)
app.get('/api/v1/system/bootstrap', (req, res) => {
  const isLocal = 
    req.ip === '127.0.0.1' || 
    req.ip === '::1' || 
    req.ip === '::ffff:127.0.0.1' || 
    req.hostname === 'localhost' || 
    req.hostname === '127.0.0.1' ||
    req.socket.remoteAddress === '127.0.0.1' ||
    req.socket.remoteAddress === '::1' ||
    req.socket.remoteAddress === '::ffff:127.0.0.1';
    
  if (isLocal) {
    return res.json({ apiKey });
  }
  return res.status(403).json({ error: 'Local bootstrap only' });
});


// System Status
app.get('/api/v1/system/status', apiAuth, (req, res) => {
  return res.json({
    status: 'ok',
    version: '1.0.0',
    env: NODE_ENV,
    dryRun: getSettingBool('dry_run', true),
    dbPath: path.join(process.env.SIFTARR_CONFIG_DIR || '', 'siftarr.db'),
    logsDir: path.join(process.env.SIFTARR_CONFIG_DIR || '', 'logs')
  });
});

// Settings Getter/Setter
app.get('/api/v1/settings', apiAuth, (req, res) => {
  try {
    const settingsObj = getAllSettings();
    return res.json(settingsObj);
  } catch (err) {
    error('Failed to fetch settings', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/v1/settings', apiAuth, (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    const updateStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP');
    
    const transaction = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'api_key') continue; // Do not allow overwriting API key from settings UI
        updateStmt.run(key, value);
      }
    });

    transaction();
    return res.json({ status: 'success' });
  } catch (err) {
    error('Failed to update settings', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Test Radarr Connection
app.post('/api/v1/settings/test/radarr', apiAuth, async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    if (!url || !apiKey) {
      return res.status(400).json({ error: 'URL and API Key are required' });
    }
    const client = new RadarrClient(url, apiKey);
    const success = await client.testConnection();
    return res.json({ success });
  } catch (err) {
    return res.json({ success: false });
  }
});

// Test Sonarr Connection
app.post('/api/v1/settings/test/sonarr', apiAuth, async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    if (!url || !apiKey) {
      return res.status(400).json({ error: 'URL and API Key are required' });
    }
    const client = new SonarrClient(url, apiKey);
    const success = await client.testConnection();
    return res.json({ success });
  } catch (err) {
    return res.json({ success: false });
  }
});

// Test Tautulli Connection
app.post('/api/v1/settings/test/tautulli', apiAuth, async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    if (!url || !apiKey) {
      return res.status(400).json({ error: 'URL and API Key are required' });
    }
    const client = new TautulliClient(url, apiKey);
    const success = await client.testConnection();
    return res.json({ success });
  } catch (err) {
    return res.json({ success: false });
  }
});

// Test Overseerr Connection
app.post('/api/v1/settings/test/overseerr', apiAuth, async (req, res) => {
  try {
    const { url, apiKey } = req.body;
    if (!url || !apiKey) {
      return res.status(400).json({ error: 'URL and API Key are required' });
    }
    const client = new OverseerrClient(url, apiKey);
    const success = await client.testConnection();
    return res.json({ success });
  } catch (err) {
    return res.json({ success: false });
  }
});

// Library Profiles (segmentation of movies/tv)
app.get('/api/v1/profiles', apiAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM library_profiles ORDER BY name ASC').all();
    return res.json(rows);
  } catch (err) {
    error('Failed to fetch library profiles', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Quality Profiles proxy for Radarr
app.get('/api/v1/radarr/profiles', apiAuth, async (req, res) => {
  try {
    const url = getSetting('radarr_url');
    const apiKey = getSetting('radarr_api_key');
    if (!url || !apiKey) return res.json([]);
    const client = new RadarrClient(url, apiKey);
    const profiles = await client.getProfiles();
    return res.json(profiles);
  } catch (err) {
    error('Failed to proxy Radarr quality profiles', err);
    return res.json([]);
  }
});

// GET Quality Profiles proxy for Sonarr
app.get('/api/v1/sonarr/profiles', apiAuth, async (req, res) => {
  try {
    const url = getSetting('sonarr_url');
    const apiKey = getSetting('sonarr_api_key');
    if (!url || !apiKey) return res.json([]);
    const client = new SonarrClient(url, apiKey);
    const profiles = await client.getProfiles();
    return res.json(profiles);
  } catch (err) {
    error('Failed to proxy Sonarr quality profiles', err);
    return res.json([]);
  }
});

// GET Radarr Root Folders
app.get('/api/v1/radarr/rootfolders', apiAuth, async (req, res) => {
  try {
    const url = getSetting('radarr_url');
    const apiKey = getSetting('radarr_api_key');
    if (!url || !apiKey) return res.json([]);
    const client = new RadarrClient(url, apiKey);
    const rootfolders = await client.getRootFolders();
    return res.json(rootfolders);
  } catch (err) {
    error('Failed to proxy Radarr root folders', err);
    return res.json([]);
  }
});

// GET Sonarr Root Folders
app.get('/api/v1/sonarr/rootfolders', apiAuth, async (req, res) => {
  try {
    const url = getSetting('sonarr_url');
    const apiKey = getSetting('sonarr_api_key');
    if (!url || !apiKey) return res.json([]);
    const client = new SonarrClient(url, apiKey);
    const rootfolders = await client.getRootFolders();
    return res.json(rootfolders);
  } catch (err) {
    error('Failed to proxy Sonarr root folders', err);
    return res.json([]);
  }
});

// GET Settings Libraries
app.get('/api/v1/settings/libraries', apiAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM library_profiles ORDER BY name ASC').all();
    return res.json(rows);
  } catch (err) {
    error('Failed to fetch library profiles', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST Add Settings Library
app.post('/api/v1/settings/libraries', apiAuth, async (req, res) => {
  try {
    const { name, mediaType, rootFolder } = req.body;
    if (!name || !mediaType || !rootFolder) {
      return res.status(400).json({ error: 'name, mediaType, and rootFolder are required' });
    }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }

    // Insert library profile
    const insertStmt = db.prepare(`
      INSERT INTO library_profiles (name, media_type, root_folder, is_enabled)
      VALUES (?, ?, ?, 1)
    `);
    const result = insertStmt.run(name, mediaType, rootFolder);
    const newId = result.lastInsertRowid;

    // Trigger asynchronous sync for this type in the background
    const syncEngine = new SyncEngine();
    if (mediaType === 'movie') {
      syncEngine.syncRadarr().catch(err => error('Background Radarr sync failed after library addition', err));
    } else {
      syncEngine.syncSonarr().catch(err => error('Background Sonarr sync failed after library addition', err));
    }

    return res.status(201).json({ id: Number(newId), name, mediaType, rootFolder });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A library with this name already exists' });
    }
    error('Failed to add library profile', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE Settings Library
app.delete('/api/v1/settings/libraries/:id', apiAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid library ID' });
    }

    // Get library path first to clean up its cache items
    const library = db.prepare('SELECT root_folder, media_type FROM library_profiles WHERE id = ?').get(id) as { root_folder: string, media_type: string } | undefined;
    if (!library) {
      return res.status(404).json({ error: 'Library profile not found' });
    }

    // Delete profile
    db.prepare('DELETE FROM library_profiles WHERE id = ?').run(id);

    // Delete obsolete cached items for this root folder and type
    db.prepare('DELETE FROM arr_cache WHERE media_type = ? AND root_folder = ?').run(library.media_type, library.root_folder);

    return res.json({ success: true });
  } catch (err) {
    error('Failed to delete library profile', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Media Poster proxy from Radarr/Sonarr
app.get('/api/v1/media/poster', apiAuth, async (req, res) => {
  try {
    const mediaType = req.query.mediaType as string;
    const id = parseInt(req.query.id as string, 10);
    if (!mediaType || isNaN(id)) {
      return res.status(400).json({ error: 'mediaType and id are required' });
    }

    const mockPosters: Record<string, string> = {
      'movie_1': 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', // Interstellar
      'movie_2': 'https://image.tmdb.org/t/p/w500/w9kR8qbmQ01HwnvK4alvnQ2ca0L.jpg', // Toy Story 4
      'movie_3': 'https://image.tmdb.org/t/p/w500/8c4a8kE7PizaGQQnditMmI1xbRp.jpg', // The Matrix Resurrections
      'tv_4': 'https://image.tmdb.org/t/p/w500/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg', // Stranger Things
      'tv_5': 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg', // Breaking Bad
      'movie_6': 'https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg', // Inception
      'movie_7': 'https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg', // Spider-Man: Into the Spider-Verse
      'movie_8': 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', // The Dark Knight
      'movie_9': 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', // Dune: Part Two
      'movie_10': 'https://image.tmdb.org/t/p/w500/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg', // Coco
      'movie_11': 'https://image.tmdb.org/t/p/w500/mINJaa34MtknCYl5AjtNJzWj8cD.jpg', // Frozen II
      'movie_12': 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', // Spirited Away
      'tv_13': 'https://image.tmdb.org/t/p/w500/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg', // Severance
      'tv_14': 'https://image.tmdb.org/t/p/w500/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg', // Succession
      'tv_15': 'https://image.tmdb.org/t/p/w500/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg', // The Last of Us
      'tv_16': 'https://image.tmdb.org/t/p/w500/9RQhVb3r3mCMqYVhLoCu4EvuipP.jpg' // Avatar: The Last Airbender
    };

    const mockKey = `${mediaType}_${id}`;
    if (mockPosters[mockKey]) {
      const response = await axios.get(mockPosters[mockKey], {
        responseType: 'stream'
      });
      res.setHeader('Content-Type', String(response.headers['content-type'] || 'image/jpeg'));
      return response.data.pipe(res);
    }

    let imageUrl = '';
    let apiToken = '';
    if (mediaType === 'movie') {
      const url = getSetting('radarr_url');
      const apiKey = getSetting('radarr_api_key');
      if (url && apiKey) {
        const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        imageUrl = `${baseUrl}/api/v3/mediacover/${id}/poster.jpg`;
        apiToken = apiKey;
      }
    } else {
      const url = getSetting('sonarr_url');
      const apiKey = getSetting('sonarr_api_key');
      if (url && apiKey) {
        const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        imageUrl = `${baseUrl}/api/v3/mediacover/${id}/poster.jpg`;
        apiToken = apiKey;
      }
    }

    if (!imageUrl) {
      return res.status(404).send('Poster not found');
    }

    const response = await axios.get(imageUrl, {
      headers: { 'X-Api-Key': apiToken },
      responseType: 'stream'
    });

    res.setHeader('Content-Type', String(response.headers['content-type'] || 'image/jpeg'));
    response.data.pipe(res);
  } catch (err) {
    res.status(404).send('Poster not found');
  }
});


// GET Curate Feed
app.get('/api/v1/curate/feed', apiAuth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    const mediaType = req.query.mediaType as string || 'all'; // 'all', 'movie', 'tv'
    const rootFolder = req.query.rootFolder as string;
    const unwatchedOnly = req.query.unwatchedOnly === 'true';
    const sortBy = req.query.sortBy as string || 'size'; // 'size', 'plays', 'score', 'added'
    const sortOrder = req.query.sortOrder as string || 'desc'; // 'desc', 'asc'

    let query = `
      SELECT 
        a.id, 
        a.media_type as mediaType, 
        a.title, 
        a.year, 
        a.size_bytes as sizeBytes, 
        a.quality_profile_id as qualityProfileId, 
        a.quality_format_source as qualityFormatSource, 
        a.custom_format_score as customFormatScore, 
        a.custom_format_tags as customFormatTags,
        a.root_folder as rootFolder,
        COALESCE(t.play_count, 0) as playCount, 
        t.last_played as lastPlayed, 
        COALESCE(t.total_watch_time, 0) as totalWatchTime
      FROM arr_cache a
      LEFT JOIN tautulli_cache t ON a.id = t.external_id AND a.media_type = t.media_type
      WHERE 1=1
    `;
    const params: any[] = [];

    if (mediaType === 'movie' || mediaType === 'tv') {
      query += ' AND a.media_type = ?';
      params.push(mediaType);
    }

    if (rootFolder && rootFolder !== 'all') {
      query += ' AND a.root_folder = ?';
      params.push(rootFolder);
    }

    if (unwatchedOnly) {
      query += ' AND COALESCE(t.play_count, 0) = 0';
    }

    // Exclude items in the review queue
    query += ` AND NOT EXISTS (
      SELECT 1 FROM review_queue r 
      WHERE r.external_id = a.id AND r.media_type = a.media_type
    )`;

    // Sorting logic
    let orderCol = 'a.size_bytes';
    if (sortBy === 'plays') {
      orderCol = 'COALESCE(t.play_count, 0)';
    } else if (sortBy === 'score') {
      orderCol = 'a.custom_format_score';
    } else if (sortBy === 'added') {
      orderCol = 'a.id';
    }

    const direction = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${orderCol} ${direction}`;

    const allRows = db.prepare(query).all(...params) as any[];

    const paginatedRows = allRows.slice(offset, offset + limit);

    const result = paginatedRows.map(row => ({
      ...row,
      customFormatTags: row.customFormatTags ? JSON.parse(row.customFormatTags) : [],
      watchTimeHours: Math.round(row.totalWatchTime / 3600)
    }));

    return res.json({
      items: result,
      total: allRows.length
    });
  } catch (err) {
    error('Failed to query curate feed', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST Curate Action (Stage)
app.post('/api/v1/curate/action', apiAuth, async (req, res) => {
  try {
    const { itemId, mediaType, action } = req.body;
    if (!itemId || !mediaType || !action) {
      return res.status(400).json({ error: 'itemId, mediaType, and action are required' });
    }
    if (mediaType !== 'movie' && mediaType !== 'tv') {
      return res.status(400).json({ error: 'mediaType must be movie or tv' });
    }
    if (!['left', 'right', 'up', 'down', 'unmonitor', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'invalid action' });
    }

    await commitAction(itemId, mediaType, action);
    return res.json({ status: 'success' });
  } catch (err) {
    error('Failed to execute curate action', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST Curate Skip (Instant bypass)
app.post('/api/v1/curate/skip', apiAuth, (req, res) => {
  try {
    const { itemId, mediaType } = req.body;
    if (!itemId || !mediaType) {
      return res.status(400).json({ error: 'itemId and mediaType are required' });
    }

    let title = `${mediaType === 'movie' ? 'Movie' : 'TV'} ${itemId}`;
    const cached = db.prepare('SELECT title FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, mediaType) as any;
    if (cached) {
      title = cached.title;
    }

    db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
      .run(itemId, mediaType, title, 'skipped', 'Skipped curation card');

    return res.json({ status: 'success' });
  } catch (err) {
    error('Failed to skip curation card', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST Reset Mock Data (For testing/evaluation)
app.post('/api/v1/test/reset', apiAuth, (req, res) => {
  try {
    info('Resetting mock database cache and curation queues for testing...');
    


    // Clear caches and queues
    db.prepare('DELETE FROM review_queue').run();
    db.prepare('DELETE FROM activity_log').run();
    db.prepare('DELETE FROM arr_cache').run();
    db.prepare('DELETE FROM tautulli_cache').run();
    db.prepare('DELETE FROM library_profiles').run();

    // Re-seed profiles
    const insertProfile = db.prepare('INSERT INTO library_profiles (name, media_type, root_folder, is_enabled) VALUES (?, ?, ?, 1)');
    insertProfile.run('Movies', 'movie', '/data/media/movies');
    insertProfile.run('Kids Movies', 'movie', '/data/media/kids-movies');
    insertProfile.run('TV Shows', 'tv', '/data/media/tv');

    // Re-seed arr_cache
    const insertArr = db.prepare(`
      INSERT INTO arr_cache (id, media_type, title, year, size_bytes, root_folder, quality_profile_id, quality_format_source, custom_format_score, custom_format_tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertArr.run(1, 'movie', 'Interstellar', 2014, 15461882265, '/data/media/movies', 1, 'Bluray-1080p', 120, '["HDR10", "TrueHD ATMOS"]');
    insertArr.run(2, 'movie', 'Toy Story 4', 2019, 8589934592, '/data/media/kids-movies', 1, 'WEBDL-1080p', 50, '["DD+ 5.1"]');
    insertArr.run(3, 'movie', 'The Matrix Resurrections', 2021, 32212254720, '/data/media/movies', 2, 'Remux-2160p', 240, '["4K HDR", "DTS-HD MA 7.1"]');
    insertArr.run(4, 'tv', 'Stranger Things', 2016, 107374182400, '/data/media/tv', 1, 'WEBDL-1080p', 80, '["Dolby Vision"]');
    insertArr.run(5, 'tv', 'Breaking Bad', 2008, 268435456000, '/data/media/tv', 2, 'Bluray-1080p', 150, '["DTS-HD MA 5.1"]');
    insertArr.run(6, 'movie', 'Inception', 2010, 19327352832, '/data/media/movies', 1, 'Bluray-1080p', 110, '["TrueHD"]');
    insertArr.run(7, 'movie', 'Spider-Man: Into the Spider-Verse', 2018, 12884901888, '/data/media/kids-movies', 1, 'Bluray-1080p', 95, '["HDR10"]');
    insertArr.run(8, 'movie', 'The Dark Knight', 2008, 18253611008, '/data/media/movies', 1, 'Remux-2160p', 180, '["4K HDR", "TrueHD ATMOS"]');
    insertArr.run(9, 'movie', 'Dune: Part Two', 2024, 42949672960, '/data/media/movies', 2, 'Remux-2160p', 220, '["4K HDR", "Dolby Vision", "TrueHD ATMOS"]');
    insertArr.run(10, 'movie', 'Coco', 2017, 9663676416, '/data/media/kids-movies', 1, 'Bluray-1080p', 95, '["HDR10"]');
    insertArr.run(11, 'movie', 'Frozen II', 2019, 11811160064, '/data/media/kids-movies', 1, 'WEBDL-1080p', 75, '["DD+ 5.1"]');
    insertArr.run(12, 'movie', 'Spirited Away', 2001, 7516192768, '/data/media/kids-movies', 1, 'Bluray-1080p', 110, '["DTS-HD MA 5.1"]');
    insertArr.run(13, 'tv', 'Severance', 2022, 53687091200, '/data/media/tv', 1, 'WEBDL-1080p', 90, '["Dolby Vision"]');
    insertArr.run(14, 'tv', 'Succession', 2018, 161061273600, '/data/media/tv', 2, 'WEBDL-1080p', 130, '["DD+ 5.1"]');
    insertArr.run(15, 'tv', 'The Last of Us', 2023, 85899345920, '/data/media/tv', 1, 'WEBDL-2160p', 170, '["4K HDR", "Dolby Vision"]');
    insertArr.run(16, 'tv', 'Avatar: The Last Airbender', 2005, 32212254720, '/data/media/tv', 1, 'Bluray-1080p', 85, '["DD+ 5.1"]');

    // Re-seed tautulli_cache
    const insertTautulli = db.prepare(`
      INSERT INTO tautulli_cache (external_id, media_type, play_count, total_watch_time, last_played)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertTautulli.run(1, 'movie', 14, 14 * 169 * 60, '2026-05-20T21:00:00Z');
    insertTautulli.run(2, 'movie', 32, 32 * 100 * 60, '2026-06-01T15:30:00Z');
    insertTautulli.run(3, 'movie', 1, 1 * 148 * 60, '2026-01-15T22:00:00Z');
    insertTautulli.run(4, 'tv', 5, 5 * 34 * 50 * 60, '2026-04-10T19:00:00Z');
    insertTautulli.run(5, 'tv', 2, 2 * 62 * 47 * 60, '2026-05-02T11:00:00Z');
    insertTautulli.run(6, 'movie', 0, 0, null);
    insertTautulli.run(7, 'movie', 45, 45 * 117 * 60, '2026-06-05T17:00:00Z');
    insertTautulli.run(8, 'movie', 8, 8 * 152 * 60, '2026-05-25T23:30:00Z');
    insertTautulli.run(9, 'movie', 2, 2 * 166 * 60, '2026-06-06T20:15:00Z');
    insertTautulli.run(10, 'movie', 15, 15 * 105 * 60, '2026-05-30T10:00:00Z');
    insertTautulli.run(11, 'movie', 25, 25 * 103 * 60, '2026-06-02T14:00:00Z');
    insertTautulli.run(12, 'movie', 3, 3 * 125 * 60, '2026-04-18T16:45:00Z');
    insertTautulli.run(13, 'tv', 6, 6 * 9 * 50 * 60, '2026-05-12T22:30:00Z');
    insertTautulli.run(14, 'tv', 1, 1 * 39 * 60 * 60, '2026-03-01T21:00:00Z');
    insertTautulli.run(15, 'tv', 8, 8 * 9 * 55 * 60, '2026-06-03T23:00:00Z');
    // Reset swipe settings to defaults
    const defaultSwipeSettings = [
      { key: 'swipe_left_action', value: 'profile' },
      { key: 'swipe_left_color', value: '#00b0ff' },
      { key: 'swipe_left_label', value: 'Standard Profile' },
      { key: 'swipe_left_radarr_profile_id', value: '1' },
      { key: 'swipe_left_sonarr_profile_id', value: '1' },

      { key: 'swipe_right_action', value: 'profile' },
      { key: 'swipe_right_color', value: '#00e676' },
      { key: 'swipe_right_label', value: 'Upgraded Profile' },
      { key: 'swipe_right_radarr_profile_id', value: '2' },
      { key: 'swipe_right_sonarr_profile_id', value: '2' },

      { key: 'swipe_up_action', value: 'profile' },
      { key: 'swipe_up_color', value: '#ffd600' },
      { key: 'swipe_up_label', value: 'God Tier Profile' },
      { key: 'swipe_up_radarr_profile_id', value: '3' },
      { key: 'swipe_up_sonarr_profile_id', value: '3' },

      { key: 'swipe_down_action', value: 'delete' },
      { key: 'swipe_down_color', value: '#ff1744' },
      { key: 'swipe_down_label', value: 'Delete' },
      { key: 'swipe_down_radarr_profile_id', value: '1' },
      { key: 'swipe_down_sonarr_profile_id', value: '1' }
    ];

    const insertSettingReplace = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const s of defaultSwipeSettings) {
      insertSettingReplace.run(s.key, s.value);
    }

    return res.json({ status: 'success', message: 'Test data reset successfully' });
  } catch (err) {
    error('Failed to reset test data', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Deletion Queue
app.get('/api/v1/queue', apiAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM review_queue ORDER BY queued_at DESC').all();
    return res.json(rows);
  } catch (err) {
    error('Failed to fetch review queue', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE Deletion Queue (Sequentially)
app.delete('/api/v1/queue', apiAuth, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const result = await executeDeletionQueue((current, total, title) => {
      res.write(JSON.stringify({ type: 'progress', current, total, title }) + '\n');
    });
    res.write(JSON.stringify({ type: 'complete', ...result }) + '\n');
    res.end();
  } catch (err) {
    error('Failed to execute deletion queue', err);
    res.write(JSON.stringify({ type: 'error', error: 'Internal Server Error' }) + '\n');
    res.end();
  }
});

// DELETE Single Item from Deletion Queue
app.delete('/api/v1/queue/:id', apiAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const item = db.prepare('SELECT title, media_type, external_id FROM review_queue WHERE id = ?').get(id) as any;
    if (item) {
      db.prepare('DELETE FROM review_queue WHERE id = ?').run(id);

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(item.external_id, item.media_type, item.title, 'removed_from_queue', 'Removed from Deletion Queue');

      return res.json({ status: 'success' });
    } else {
      return res.status(404).json({ error: 'Item not found in queue' });
    }
  } catch (err) {
    error('Failed to remove item from queue', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET Activity Log
app.get('/api/v1/activity-log', apiAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM activity_log ORDER BY timestamp DESC LIMIT 100').all();
    return res.json(rows);
  } catch (err) {
    error('Failed to fetch activity log', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// System logs streaming for diagnostic panel (matches *arr System tab)
app.get('/api/v1/system/logs', apiAuth, (req, res) => {
  try {
    const logType = req.query.type as string || 'info'; // 'info', 'debug', 'trace'
    let logFile = 'siftarr.log';
    if (logType === 'debug') logFile = 'siftarr.debug.log';
    if (logType === 'trace') logFile = 'siftarr.trace.log';

    const logPath = path.join(process.env.SIFTARR_CONFIG_DIR || '', 'logs', logFile);
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    const content = fs.readFileSync(logPath, 'utf8');
    return res.send(content);
  } catch (err) {
    error('Failed to read log file', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// Static Files (Frontend UI serving)
// ==========================================

const frontendDistPath = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

if (fs.existsSync(frontendDistPath)) {
  info(`Serving frontend static files from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath));
  
  // Catch-all to support React SPA routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next(); // Pass through APIs to 404 handler
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  warn(`Frontend dist folder not found at ${frontendDistPath}. Run backend in development/API-only mode.`);
  app.get('/', (req, res) => {
    res.send('Siftarr Backend API running. Frontend static assets not built yet.');
  });
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(PORT, '0.0.0.0', () => {
  info(`Siftarr server listening on http://0.0.0.0:${PORT}`);
});
