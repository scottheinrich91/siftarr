import { test, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { db, runMigrations } from '../src/db/connection.js';
import { SyncEngine } from '../src/db/sync.js';

test('SyncEngine - Library Caching Sync & Tautulli watch stats integration', async (t) => {
  // 1. Ensure migrations are applied
  runMigrations();

  // Clear existing cache rows to isolate tests
  db.prepare("DELETE FROM arr_cache").run();
  db.prepare("DELETE FROM tautulli_cache").run();

  // Seed settings needed for sync tests
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('radarr_url', 'http://localhost:7878')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('radarr_api_key', 'test-key')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('sonarr_url', 'http://localhost:8989')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('sonarr_api_key', 'test-key')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('is_tautulli_enabled', 'true')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('tautulli_url', 'http://localhost:8181')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('tautulli_api_key', 'test-key')").run();

  // 2. Mock all axios GET calls globally
  const getMock = mock.method(axios.Axios.prototype, 'get', async (url: string, config: any) => {
    // Determine the service request
    if (url === '/qualityprofile') {
      return { status: 200, data: [] };
    }
    
    if (url === '/movie') {
      return {
        status: 200,
        data: [
          {
            id: 101,
            title: 'Inception',
            year: 2010,
            path: '/data/movies/Inception (2010)',
            qualityProfileId: 2,
            movieFile: {
              size: 15461882265,
              quality: {
                quality: { name: 'WEBDL-2160p' },
                customFormatScore: 1250
              },
              customFormats: [
                { name: 'HDR10' },
                { name: 'Atmos' }
              ]
            }
          }
        ]
      };
    }

    if (url === '/series') {
      return {
        status: 200,
        data: [
          {
            id: 202,
            title: 'The Last of Us',
            year: 2023,
            path: '/data/tv/The Last of Us',
            qualityProfileId: 4,
            statistics: {
              sizeOnDisk: 85899345920
            }
          }
        ]
      };
    }

    // Tautulli API Requests
    const params = config?.params || {};
    if (params.cmd === 'get_library_names') {
      return {
        status: 200,
        data: {
          response: {
            result: 'success',
            data: [
              { section_id: 1, section_name: 'Movies', section_type: 'movie' },
              { section_id: 2, section_name: 'TV Shows', section_type: 'show' }
            ]
          }
        }
      };
    }

    if (params.cmd === 'get_library_media_info') {
      if (params.section_id === 1) {
        return {
          status: 200,
          data: {
            response: {
              result: 'success',
              data: [
                {
                  rating_key: '5001',
                  title: 'Inception',
                  year: '2010',
                  tmdb_id: '101',
                  play_count: '14',
                  last_played: '1780790400',
                  duration: '3500'
                }
              ]
            }
          }
        };
      }
      if (params.section_id === 2) {
        return {
          status: 200,
          data: {
            response: {
              result: 'success',
              data: [
                {
                  rating_key: '6001',
                  title: 'The Last of Us',
                  tvdb_id: '202',
                  play_count: '0',
                  last_played: null,
                  duration: '0'
                }
              ]
            }
          }
        };
      }
    }

    return { status: 404 };
  });

  // 3. Run Sync
  const engine = new SyncEngine();
  await engine.runFullSync();

  // 4. Assertions on SQLite cache
  const cachedMovies = db.prepare("SELECT * FROM arr_cache WHERE media_type = 'movie'").all() as any[];
  assert.strictEqual(cachedMovies.length, 1);
  assert.strictEqual(cachedMovies[0].id, 101);
  assert.strictEqual(cachedMovies[0].title, 'Inception');
  assert.strictEqual(cachedMovies[0].size_bytes, 15461882265);
  assert.strictEqual(cachedMovies[0].quality_format_source, 'WEBDL-2160p');
  assert.strictEqual(cachedMovies[0].custom_format_score, 1250);
  assert.deepEqual(JSON.parse(cachedMovies[0].custom_format_tags), ['HDR10', 'Atmos']);

  const cachedTV = db.prepare("SELECT * FROM arr_cache WHERE media_type = 'tv'").all() as any[];
  assert.strictEqual(cachedTV.length, 1);
  assert.strictEqual(cachedTV[0].id, 202);
  assert.strictEqual(cachedTV[0].title, 'The Last of Us');
  assert.strictEqual(cachedTV[0].size_bytes, 85899345920);

  const watchStats = db.prepare('SELECT * FROM tautulli_cache ORDER BY external_id ASC').all() as any[];
  assert.strictEqual(watchStats.length, 2);
  assert.strictEqual(watchStats[0].external_id, 101);
  assert.strictEqual(watchStats[0].play_count, 14);
  assert.strictEqual(watchStats[0].total_watch_time, 3500);
  
  assert.strictEqual(watchStats[1].external_id, 202);
  assert.strictEqual(watchStats[1].play_count, 0);

  // Restore mocks
  getMock.mock.restore();
});
