import { test, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { db, runMigrations } from '../src/db/connection.js';
import { 
  commitAction, 
  executeDeletionQueue 
} from '../src/curation.js';

test('Curation Engine - Action Staging, Skipping, and Queue Deletion Pipeline', async (t) => {
  // 1. Initialize DB and clear logs
  runMigrations();
  db.prepare("DELETE FROM arr_cache").run();
  db.prepare("DELETE FROM review_queue").run();
  db.prepare("DELETE FROM activity_log").run();

  // Seed settings and cached movie
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('radarr_url', 'http://localhost:7878')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('radarr_api_key', 'test-key')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('dry_run', 'false')").run(); // Run live actions for test
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('swipe_left_action', 'profile')").run();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('swipe_left_radarr_profile_id', '2')").run();

  db.prepare(`
    INSERT INTO arr_cache (
      id, media_type, title, year, size_bytes, root_folder, 
      quality_profile_id, quality_format_source, custom_format_score, custom_format_tags
    ) VALUES (
      101, 'movie', 'Inception', 2010, 15000000, '/movies/Inception', 1, 'Bluray', 500, '[]'
    )
  `).run();

  // Mock Axios instance calls inside clients
  const getMock = mock.method(axios.Axios.prototype, 'get', async (url: string) => {
    if (url === '/movie/101') {
      return {
        status: 200,
        data: {
          id: 101,
          title: 'Inception',
          qualityProfileId: 1,
          monitored: true,
          movieFile: { id: 50 }
        }
      };
    }
    if (url === '/qualityprofile') {
      return {
        status: 200,
        data: [
          { id: 1, name: 'Any' },
          { id: 2, name: 'HD-1080p' }
        ]
      };
    }
    return { status: 404 };
  });

  const putMock = mock.method(axios.Axios.prototype, 'put', async (url: string, body: any) => {
    if (url === '/movie/101') {
      assert.strictEqual(body.qualityProfileId, 2);
      return { status: 200 };
    }
    return { status: 404 };
  });

  const postMock = mock.method(axios.Axios.prototype, 'post', async (url: string) => {
    if (url === '/command') {
      return { status: 200 };
    }
    return { status: 404 };
  });

  // Test 1: Commit standard profile change action to verify Radarr sync
  await commitAction(101, 'movie', 'left');

  // Verify activity log
  const log = db.prepare("SELECT * FROM activity_log WHERE external_id = 101").get() as any;
  assert.ok(log);
  assert.strictEqual(log.action, 'upgrade_profile');
  assert.strictEqual(log.details.includes('Updated profile to ID 2'), true);

  // Test 3: Delete Action stages item to review queue
  await commitAction(101, 'movie', 'delete');

  const queued = db.prepare("SELECT * FROM review_queue WHERE external_id = 101").get() as any;
  assert.ok(queued);
  assert.strictEqual(queued.title, 'Inception');
  assert.strictEqual(queued.media_type, 'movie');

  // Test 3.5: Remove single item from queue manually
  db.prepare("DELETE FROM review_queue WHERE id = ?").run(queued.id);
  const queueCountAfterSingleDelete = db.prepare("SELECT count(*) as count FROM review_queue WHERE id = ?").get(queued.id) as { count: number };
  assert.strictEqual(queueCountAfterSingleDelete.count, 0);

  // Re-stage for the execution test
  await commitAction(101, 'movie', 'delete');

  // Test 4: Sequential Deletion Queue Execution
  const deleteMock = mock.method(axios.Axios.prototype, 'delete', async (url: string) => {
    if (url === '/movie/101') {
      return { status: 200 };
    }
    return { status: 404 };
  });

  const deleteStats = await executeDeletionQueue();
  assert.strictEqual(deleteStats.success, 1);
  assert.strictEqual(deleteStats.failed, 0);

  // Queue should now be empty
  const queueCount = db.prepare("SELECT count(*) as count FROM review_queue").get() as { count: number };
  assert.strictEqual(queueCount.count, 0);

  // Clean up mocks
  getMock.mock.restore();
  putMock.mock.restore();
  postMock.mock.restore();
  deleteMock.mock.restore();
});
