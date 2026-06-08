import { test, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { RadarrClient } from '../src/api/radarr.js';
import { SonarrClient } from '../src/api/sonarr.js';
import { TautulliClient } from '../src/api/tautulli.js';
import { OverseerrClient } from '../src/api/overseerr.js';

// Mock axios prototype calls to avoid hit on network
test('RadarrClient Connection Test & Deletion Parameters', async (t) => {
  const radarr = new RadarrClient('http://localhost:7878', 'test-api-key');

  // 1. Verify testConnection
  const getMock = mock.method(radarr['client'], 'get', async (url: string) => {
    if (url === '/system/status') {
      return { status: 200, data: { version: '1.0.0.1234' } };
    }
    return { status: 404 };
  });

  const connected = await radarr.testConnection();
  assert.strictEqual(connected, true);
  assert.strictEqual(getMock.mock.calls.length, 1);
  assert.strictEqual(getMock.mock.calls[0].arguments[0], '/system/status');

  getMock.mock.restore();

  // 2. Verify clean delete parameters
  const deleteMock = mock.method(radarr['client'], 'delete', async (url: string, config: any) => {
    assert.strictEqual(url, '/movie/42');
    assert.strictEqual(config.params.deleteFiles, true);
    assert.strictEqual(config.params.addImportListExclusion, true);
    return { status: 200 };
  });

  await radarr.deleteMovie(42, true, true);
  assert.strictEqual(deleteMock.mock.calls.length, 1);
  deleteMock.mock.restore();
});

test('SonarrClient Connection Test & Deletion Parameters', async (t) => {
  const sonarr = new SonarrClient('http://localhost:8989', 'test-api-key');

  const getMock = mock.method(sonarr['client'], 'get', async (url: string) => {
    if (url === '/system/status') {
      return { status: 200, data: { version: '4.0.0' } };
    }
    return { status: 404 };
  });

  const connected = await sonarr.testConnection();
  assert.strictEqual(connected, true);
  getMock.mock.restore();

  const deleteMock = mock.method(sonarr['client'], 'delete', async (url: string, config: any) => {
    assert.strictEqual(url, '/series/12');
    assert.strictEqual(config.params.deleteFiles, true);
    assert.strictEqual(config.params.addImportListExclusion, true);
    return { status: 200 };
  });

  await sonarr.deleteSeries(12, true, true);
  assert.strictEqual(deleteMock.mock.calls.length, 1);
  deleteMock.mock.restore();
});

test('TautulliClient Fetch Watch Statistics', async (t) => {
  const tautulli = new TautulliClient('http://localhost:8181', 'test-api-key');

  const getMock = mock.method(tautulli['client'], 'get', async (url: string, config: any) => {
    assert.strictEqual(config.params.apikey, 'test-api-key');
    if (config.params.cmd === 'get_item_watch_time_stats') {
      return {
        status: 200,
        data: {
          response: {
            result: 'success',
            data: {
              play_count: 5,
              last_play: '2026-06-07',
              total_watch_time: 7200
            }
          }
        }
      };
    }
    return { status: 404 };
  });

  const stats = await tautulli.getItemWatchTimeStats(999);
  assert.strictEqual(stats.play_count, 5);
  assert.strictEqual(stats.total_watch_time, 7200);
  getMock.mock.restore();
});

test('OverseerrClient Clean Cache Deletion', async (t) => {
  const overseerr = new OverseerrClient('http://localhost:5055', 'test-api-key');

  // 1. Mock GET to lookup movie and get mediaInfo.id
  const getMock = mock.method(overseerr['client'], 'get', async (url: string) => {
    if (url === '/movie/550') {
      return {
        status: 200,
        data: {
          id: 550,
          title: 'Fight Club',
          mediaInfo: {
            id: 88,
            status: 5 // Available
          }
        }
      };
    }
    return { status: 404 };
  });

  // 2. Mock DELETE to clear cache
  const deleteMock = mock.method(overseerr['client'], 'delete', async (url: string) => {
    assert.strictEqual(url, '/media/88');
    return { status: 200 };
  });

  const success = await overseerr.cleanSyncDelete(550, 'movie');
  assert.strictEqual(success, true);
  assert.strictEqual(getMock.mock.calls.length, 1);
  assert.strictEqual(deleteMock.mock.calls.length, 1);

  getMock.mock.restore();
  deleteMock.mock.restore();
});

test('RadarrClient and SonarrClient getRootFolders method tests', async (t) => {
  const radarr = new RadarrClient('http://localhost:7878', 'test-api-key');
  const sonarr = new SonarrClient('http://localhost:8989', 'test-api-key');

  const getMockRadarr = mock.method(radarr['client'], 'get', async (url: string) => {
    assert.strictEqual(url, '/rootfolder');
    return { status: 200, data: [{ path: '/data/movies', id: 1, freeSpace: 1000 }] };
  });

  const getMockSonarr = mock.method(sonarr['client'], 'get', async (url: string) => {
    assert.strictEqual(url, '/rootfolder');
    return { status: 200, data: [{ path: '/data/tv', id: 1, freeSpace: 2000 }] };
  });

  const radarrFolders = await radarr.getRootFolders();
  assert.strictEqual(radarrFolders.length, 1);
  assert.strictEqual(radarrFolders[0].path, '/data/movies');

  const sonarrFolders = await sonarr.getRootFolders();
  assert.strictEqual(sonarrFolders.length, 1);
  assert.strictEqual(sonarrFolders[0].path, '/data/tv');

  getMockRadarr.mock.restore();
  getMockSonarr.mock.restore();
});
