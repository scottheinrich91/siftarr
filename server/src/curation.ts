import { db } from './db/connection.js';
import { getSetting, getSettingBool } from './db/settings.js';
import { RadarrClient } from './api/radarr.js';
import { SonarrClient } from './api/sonarr.js';
import { OverseerrClient } from './api/overseerr.js';
import { info, error, warn, trace } from './logger.js';




export async function commitAction(
  itemId: number,
  mediaType: 'movie' | 'tv',
  action: 'left' | 'right' | 'up' | 'down' | 'unmonitor' | 'delete'
) {
  const isDryRun = getSettingBool('dry_run', true);

  // Resolve dynamic swipe configurations
  let resolvedAction: 'profile' | 'unmonitor' | 'delete' | 'skip' | 'disabled' = 'disabled';
  let targetProfileId: number | undefined;

  if (['left', 'right', 'up', 'down'].includes(action)) {
    const dir = action;
    const actionKey = `swipe_${dir}_action`;
    const actionVal = getSetting(actionKey);

    if (actionVal === 'disabled') {
      info(`Swipe direction ${dir} is disabled.`);
      return;
    }

    if (actionVal) {
      resolvedAction = actionVal as any;
    } else {
      // Fallback defaults
      if (dir === 'left') resolvedAction = 'profile';
      else if (dir === 'right') resolvedAction = 'profile';
      else if (dir === 'up') resolvedAction = 'profile';
      else if (dir === 'down') resolvedAction = 'delete';
    }

    if (resolvedAction === 'profile') {
      const profileIdKey = `swipe_${dir}_${mediaType === 'movie' ? 'radarr' : 'sonarr'}_profile_id`;
      const profileIdVal = getSetting(profileIdKey);
      if (profileIdVal) {
        targetProfileId = parseInt(profileIdVal, 10);
      } else {
        // Fallback profile IDs
        targetProfileId = dir === 'left' ? 1 : dir === 'right' ? 2 : dir === 'up' ? 3 : 1;
      }
    }
  } else {
    resolvedAction = action as any;
  }

  info(`Committing resolved action: ${resolvedAction} (direction: ${action}) on ${mediaType} ${itemId} (Dry Run: ${isDryRun})`);

  if (resolvedAction === 'skip') {
    let title = `${mediaType === 'movie' ? 'Movie' : 'TV'} ${itemId}`;
    const cached = db.prepare('SELECT title FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, mediaType) as any;
    if (cached) {
      title = cached.title;
    }
    db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
      .run(itemId, mediaType, title, 'skipped', 'Skipped curation card');
    return;
  }

  if (mediaType === 'movie') {
    if (resolvedAction === 'unmonitor') {
      let movieTitle = `Movie ${itemId}`;
      const cached = db.prepare('SELECT title FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, 'movie') as any;
      if (cached) {
        movieTitle = cached.title;
      }

      (async () => {
        try {
          const radarrUrl = getSetting('radarr_url');
          const radarrApiKey = getSetting('radarr_api_key');
          if (!radarrUrl || !radarrApiKey) {
            warn('Radarr URL or API Key is not configured. Skipping background Radarr update.');
            return;
          }
          const radarr = new RadarrClient(radarrUrl, radarrApiKey);
          const movie = await radarr.getMovie(itemId);
          if (!isDryRun) {
            movie.monitored = false;
            await radarr.updateMovie(movie);
          }
          info(`Successfully unmonitored Radarr movie: "${movieTitle}" (ID: ${itemId})`);
        } catch (err) {
          error(`Failed to get/update Radarr movie for unmonitoring: ${itemId}`, err);
        }
      })();

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(itemId, 'movie', movieTitle, 'unmonitored', isDryRun ? '[DRY RUN] Set monitored = false' : 'Set monitored = false in Radarr');
    } else if (resolvedAction === 'profile' && targetProfileId !== undefined) {
      let movieTitle = `Movie ${itemId}`;
      const cached = db.prepare('SELECT title FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, 'movie') as any;
      if (cached) {
        movieTitle = cached.title;
      }

      (async () => {
        try {
          const radarrUrl = getSetting('radarr_url');
          const radarrApiKey = getSetting('radarr_api_key');
          if (!radarrUrl || !radarrApiKey) {
            warn('Radarr URL or API Key is not configured. Skipping background Radarr update.');
            return;
          }
          const radarr = new RadarrClient(radarrUrl, radarrApiKey);
          const movie = await radarr.getMovie(itemId);
          const currentProfileId = movie.qualityProfileId;

          if (!isDryRun) {
            const profiles = await radarr.getProfiles();
            const currentIndex = profiles.findIndex((p: any) => p.id === currentProfileId);
            const targetIndex = profiles.findIndex((p: any) => p.id === targetProfileId);
            const isUpgrade = targetIndex > currentIndex;

            const deleteOnUpgrade = getSettingBool('delete_file_on_upgrade', false);
            const deleteOnDowngrade = getSettingBool('delete_file_on_downgrade', false);

            if ((isUpgrade && deleteOnUpgrade) || (!isUpgrade && deleteOnDowngrade)) {
              const fileId = movie.movieFile?.id;
              if (fileId) {
                info(`Deleting movie file ${fileId} before profile update (Upgrade: ${isUpgrade})`);
                try {
                  await radarr.client.delete(`/moviefile/${fileId}`);
                } catch (err: any) {
                  warn(`Could not delete movie file ${fileId} from Radarr before profile change: ${err?.message || err}`);
                }
              }
            }

            movie.qualityProfileId = targetProfileId;
            await radarr.updateMovie(movie);
            await radarr.triggerSearch(itemId);
          }
          info(`Successfully updated Radarr movie profile: "${movieTitle}" (ID: ${itemId}) to Profile ${targetProfileId}`);
        } catch (err) {
          error(`Failed to execute quality profile update on Radarr movie ${itemId}`, err);
        }
      })();

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(itemId, 'movie', movieTitle, 'upgrade_profile', isDryRun ? `[DRY RUN] Update profile to ID ${targetProfileId}` : `Updated profile to ID ${targetProfileId} (Triggered search)`);

    } else if (resolvedAction === 'delete') {
      let movieTitle = `Movie ${itemId}`;
      let movieYear = 0;
      let movieSize = 0;
      let moviePath = '';

      const cached = db.prepare('SELECT * FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, 'movie') as any;
      if (cached) {
        movieTitle = cached.title;
        movieYear = cached.year;
        movieSize = cached.size_bytes;
        moviePath = cached.root_folder;
      }

      db.prepare(`
        INSERT OR REPLACE INTO review_queue (external_id, media_type, title, year, size_bytes, path, library_name)
        VALUES (?, 'movie', ?, ?, ?, ?, 'Movies')
      `).run(itemId, movieTitle, movieYear, movieSize, moviePath);

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(itemId, 'movie', movieTitle, 'delete', 'Added to Deletion Queue');
    }
  } else if (mediaType === 'tv') {
    if (resolvedAction === 'unmonitor') {
      let seriesTitle = `Series ${itemId}`;
      const cached = db.prepare('SELECT title FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, 'tv') as any;
      if (cached) {
        seriesTitle = cached.title;
      }

      (async () => {
        try {
          const sonarrUrl = getSetting('sonarr_url');
          const sonarrApiKey = getSetting('sonarr_api_key');
          if (!sonarrUrl || !sonarrApiKey) {
            warn('Sonarr URL or API Key is not configured. Skipping background Sonarr update.');
            return;
          }
          const sonarr = new SonarrClient(sonarrUrl, sonarrApiKey);
          const series = await sonarr.getSeries(itemId);
          if (!isDryRun) {
            series.monitored = false;
            await sonarr.updateSeries(series);
          }
          info(`Successfully unmonitored Sonarr series: "${seriesTitle}" (ID: ${itemId})`);
        } catch (err) {
          error(`Failed to get/update Sonarr series for unmonitoring: ${itemId}`, err);
        }
      })();

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(itemId, 'tv', seriesTitle, 'unmonitored', isDryRun ? '[DRY RUN] Set monitored = false' : 'Set monitored = false in Sonarr');
    } else if (resolvedAction === 'profile' && targetProfileId !== undefined) {
      let seriesTitle = `Series ${itemId}`;
      const cached = db.prepare('SELECT title FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, 'tv') as any;
      if (cached) {
        seriesTitle = cached.title;
      }

      (async () => {
        try {
          const sonarrUrl = getSetting('sonarr_url');
          const sonarrApiKey = getSetting('sonarr_api_key');
          if (!sonarrUrl || !sonarrApiKey) {
            warn('Sonarr URL or API Key is not configured. Skipping background Sonarr update.');
            return;
          }
          const sonarr = new SonarrClient(sonarrUrl, sonarrApiKey);
          const series = await sonarr.getSeries(itemId);

          if (!isDryRun) {
            series.qualityProfileId = targetProfileId;
            await sonarr.updateSeries(series);
            await sonarr.triggerSearch(itemId);
          }
          info(`Successfully updated Sonarr series profile: "${seriesTitle}" (ID: ${itemId}) to Profile ${targetProfileId}`);
        } catch (err) {
          error(`Failed to execute quality profile update on Sonarr series ${itemId}`, err);
        }
      })();

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(itemId, 'tv', seriesTitle, 'upgrade_profile', isDryRun ? `[DRY RUN] Update profile to ID ${targetProfileId}` : `Updated profile to ID ${targetProfileId} (Triggered search)`);
    } else if (resolvedAction === 'delete') {
      let seriesTitle = `Series ${itemId}`;
      let seriesYear = 0;
      let seriesSize = 0;
      let seriesPath = '';

      const cached = db.prepare('SELECT * FROM arr_cache WHERE id = ? AND media_type = ?').get(itemId, 'tv') as any;
      if (cached) {
        seriesTitle = cached.title;
        seriesYear = cached.year;
        seriesSize = cached.size_bytes;
        seriesPath = cached.root_folder;
      }

      db.prepare(`
        INSERT OR REPLACE INTO review_queue (external_id, media_type, title, year, size_bytes, path, library_name)
        VALUES (?, 'tv', ?, ?, ?, ?, 'TV Shows')
      `).run(itemId, seriesTitle, seriesYear, seriesSize, seriesPath);

      db.prepare('INSERT INTO activity_log (external_id, media_type, title, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(itemId, 'tv', seriesTitle, 'delete', 'Added to Deletion Queue');
    }
  }
}


export async function executeDeletionQueue(
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ success: number; failed: number }> {
  const isDryRun = getSettingBool('dry_run', true);
  const queue = db.prepare('SELECT * FROM review_queue ORDER BY queued_at ASC').all() as any[];

  let successCount = 0;
  let failedCount = 0;

  info(`Starting sequential deletion execution for ${queue.length} items (Dry Run: ${isDryRun})`);

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (onProgress) {
      onProgress(i + 1, queue.length, item.title);
    }

    try {
      // 1. Resolve TMDB/TVDB ID if Overseerr is enabled (before deleting from Arr!)
      let externalTmdbOrTvdbId: number | undefined;
      const isOverseerrEnabled = getSettingBool('is_overseerr_enabled', false);

      if (isOverseerrEnabled) {
        const url = item.media_type === 'movie' ? getSetting('radarr_url') : getSetting('sonarr_url');
        const apiKey = item.media_type === 'movie' ? getSetting('radarr_api_key') : getSetting('sonarr_api_key');

        if (url && apiKey) {
          try {
            if (item.media_type === 'movie') {
              const radarr = new RadarrClient(url, apiKey);
              const movieObj = await radarr.getMovie(item.external_id);
              externalTmdbOrTvdbId = movieObj.tmdbId;
            } else {
              const sonarr = new SonarrClient(url, apiKey);
              const seriesObj = await sonarr.getSeries(item.external_id);
              externalTmdbOrTvdbId = seriesObj.tvdbId;
            }
          } catch (err: any) {
            warn(`Failed to retrieve Arr media object for deletion TMDB/TVDB lookup: ${item.title}: ${err?.message || err}`);
          }
        }
      }

      // 2. Delete from Radarr/Sonarr (if not dry run)
      if (!isDryRun) {
        try {
          if (item.media_type === 'movie') {
            const radarrUrl = getSetting('radarr_url');
            const radarrApiKey = getSetting('radarr_api_key');
            if (radarrUrl && radarrApiKey) {
              const radarr = new RadarrClient(radarrUrl, radarrApiKey);
              await radarr.deleteMovie(item.external_id, true, true);
            }
          } else {
            const sonarrUrl = getSetting('sonarr_url');
            const sonarrApiKey = getSetting('sonarr_api_key');
            if (sonarrUrl && sonarrApiKey) {
              const sonarr = new SonarrClient(sonarrUrl, sonarrApiKey);
              await sonarr.deleteSeries(item.external_id, true, true);
            }
          }
        } catch (apiErr: any) {
          warn(`Failed to delete ${item.title} from *arr stack: ${apiErr?.message || apiErr}. Clearing from queue anyway for testing/offline support.`);
        }
      }

      // 3. Clear Overseerr Cache (if not dry run and resolved ID)
      if (externalTmdbOrTvdbId && isOverseerrEnabled) {
        const overseerrUrl = getSetting('overseerr_url');
        const overseerrApiKey = getSetting('overseerr_api_key');
        if (overseerrUrl && overseerrApiKey) {
          try {
            const overseerr = new OverseerrClient(overseerrUrl, overseerrApiKey);
            if (!isDryRun) {
              await overseerr.cleanSyncDelete(externalTmdbOrTvdbId, item.media_type);
            } else {
              info(`[DRY RUN] Would reset Overseerr status for ${item.media_type} with external ID ${externalTmdbOrTvdbId}`);
            }
          } catch (err: any) {
            warn(`Failed to clean Overseerr status for ${item.title}: ${err?.message || err}`);
          }
        }
      }

      // 4. Remove row from local queue
      db.prepare('DELETE FROM review_queue WHERE id = ?').run(item.id);
      successCount++;
    } catch (err) {
      error(`Failed to execute deletion for queue item ${item.title} (ID: ${item.external_id})`, err);
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount };
}
