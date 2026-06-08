import { db } from './connection.js';
import { getSetting, getSettingBool } from './settings.js';
import { RadarrClient } from '../api/radarr.js';
import { SonarrClient } from '../api/sonarr.js';
import { TautulliClient } from '../api/tautulli.js';
import logger, { info, warn, error, trace } from '../logger.js';

/**
 * Synchronization engine for Siftarr
 */
export class SyncEngine {
  
  /**
   * Synchronizes Radarr movies into the SQLite cache
   */
  async syncRadarr(): Promise<void> {
    const url = getSetting('radarr_url');
    const apiKey = getSetting('radarr_api_key');

    if (!url || !apiKey) {
      warn('Radarr URL or API Key is not configured. Skipping Radarr synchronization.');
      return;
    }

    info('Starting Radarr movie library sync...');
    try {
      const client = new RadarrClient(url, apiKey);
      const movies = await client.getProfiles().then(() => client.client.get('/movie')).then(res => res.data as any[]);

      info(`Fetched ${movies.length} movies from Radarr. Caching...`);

      const insertStmt = db.prepare(`
        INSERT INTO arr_cache (
          id, media_type, title, year, size_bytes, root_folder, 
          quality_profile_id, quality_format_source, custom_format_score, custom_format_tags
        ) VALUES (
          ?, 'movie', ?, ?, ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          year = excluded.year,
          size_bytes = excluded.size_bytes,
          root_folder = excluded.root_folder,
          quality_profile_id = excluded.quality_profile_id,
          quality_format_source = excluded.quality_format_source,
          custom_format_score = excluded.custom_format_score,
          custom_format_tags = excluded.custom_format_tags,
          fetched_at = CURRENT_TIMESTAMP
      `);

      const deleteObsoleteStmt = db.prepare(`
        DELETE FROM arr_cache 
        WHERE media_type = 'movie' AND id NOT IN (${movies.map(() => '?').join(',')})
      `);

      const transaction = db.transaction(() => {
        movies.forEach(m => {
          const id = m.id;
          const title = m.title || 'Unknown Title';
          const year = m.year || 0;
          const sizeBytes = m.movieFile?.size || 0;
          const rootFolder = m.path || '';
          const qualityProfileId = m.qualityProfileId || 0;
          const qualityFormatSource = m.movieFile?.quality?.quality?.name || 'Unknown';
          const customFormatScore = m.movieFile?.quality?.customFormatScore || 0;
          
          // Parse TRaSH tags from custom formats
          const tags = Array.isArray(m.movieFile?.customFormats)
            ? m.movieFile.customFormats.map((cf: any) => cf.name)
            : [];
          const customFormatTags = JSON.stringify(tags);

          insertStmt.run(
            id, title, year, sizeBytes, rootFolder, 
            qualityProfileId, qualityFormatSource, customFormatScore, customFormatTags
          );
        });

        if (movies.length > 0) {
          deleteObsoleteStmt.run(...movies.map(m => m.id));
        }
      });

      transaction();
      info('Radarr library sync successfully completed.');
    } catch (err) {
      error('Failed to run Radarr synchronization pipeline', err);
    }
  }

  /**
   * Synchronizes Sonarr series into the SQLite cache
   */
  async syncSonarr(): Promise<void> {
    const url = getSetting('sonarr_url');
    const apiKey = getSetting('sonarr_api_key');

    if (!url || !apiKey) {
      warn('Sonarr URL or API Key is not configured. Skipping Sonarr synchronization.');
      return;
    }

    info('Starting Sonarr series library sync...');
    try {
      const client = new SonarrClient(url, apiKey);
      const series = await client.getProfiles().then(() => client.client.get('/series')).then(res => res.data as any[]);

      info(`Fetched ${series.length} series from Sonarr. Caching...`);

      const insertStmt = db.prepare(`
        INSERT INTO arr_cache (
          id, media_type, title, year, size_bytes, root_folder, 
          quality_profile_id, quality_format_source, custom_format_score, custom_format_tags
        ) VALUES (
          ?, 'tv', ?, ?, ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          year = excluded.year,
          size_bytes = excluded.size_bytes,
          root_folder = excluded.root_folder,
          quality_profile_id = excluded.quality_profile_id,
          quality_format_source = excluded.quality_format_source,
          custom_format_score = excluded.custom_format_score,
          custom_format_tags = excluded.custom_format_tags,
          fetched_at = CURRENT_TIMESTAMP
      `);

      const deleteObsoleteStmt = db.prepare(`
        DELETE FROM arr_cache 
        WHERE media_type = 'tv' AND id NOT IN (${series.map(() => '?').join(',')})
      `);

      const transaction = db.transaction(() => {
        series.forEach(s => {
          const id = s.id;
          const title = s.title || 'Unknown Title';
          const year = s.year || 0;
          const sizeOnDisk = s.statistics?.sizeOnDisk || 0;
          const rootFolder = s.path || '';
          const qualityProfileId = s.qualityProfileId || 0;
          const qualityFormatSource = 'Series'; // TV shows aggregate multiple file formats
          const customFormatScore = 0; // Series scores are calculated per episode file
          const customFormatTags = JSON.stringify([]);

          insertStmt.run(
            id, title, year, sizeOnDisk, rootFolder, 
            qualityProfileId, qualityFormatSource, customFormatScore, customFormatTags
          );
        });

        if (series.length > 0) {
          deleteObsoleteStmt.run(...series.map(s => s.id));
        }
      });

      transaction();
      info('Sonarr library sync successfully completed.');
    } catch (err) {
      error('Failed to run Sonarr synchronization pipeline', err);
    }
  }

  /**
   * Synchronizes playback statistics from Tautulli for cached media
   */
  async syncTautulli(): Promise<void> {
    const isEnabled = getSettingBool('is_tautulli_enabled', false);
    const url = getSetting('tautulli_url');
    const apiKey = getSetting('tautulli_api_key');

    if (!isEnabled || !url || !apiKey) {
      trace('Tautulli integration is disabled or not fully configured. Skipping Tautulli watch stats sync.');
      return;
    }

    info('Starting Tautulli Plex watch stats sync...');
    try {
      const tautulli = new TautulliClient(url, apiKey);
      
      // We need to resolve TMDB/TVDB IDs from the cached items
      const cachedMovies = db.prepare("SELECT id, title FROM arr_cache WHERE media_type = 'movie'").all() as { id: number; title: string }[];
      
      // Let's resolve the movie TMDB IDs from Radarr metadata dynamically or check if we can fetch all library items from Tautulli.
      // Fetching all media items from Tautulli is much faster than individual lookups!
      // To fetch all library items from Tautulli, we first get all library sections to locate Plex movies and tv shows
      const sectionsResponse = await tautulli.client.get('/', {
        params: { apikey: apiKey, cmd: 'get_library_names' }
      });
      
      const sections = sectionsResponse.data.response.data as any[];
      if (!sections || sections.length === 0) {
        warn('Tautulli returned no Plex library sections. Skipping watch stats sync.');
        return;
      }

      const insertStmt = db.prepare(`
        INSERT INTO tautulli_cache (
          external_id, media_type, rating_key, play_count, last_played, total_watch_time
        ) VALUES (
          ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(external_id, media_type) DO UPDATE SET
          rating_key = excluded.rating_key,
          play_count = excluded.play_count,
          last_played = excluded.last_played,
          total_watch_time = excluded.total_watch_time,
          fetched_at = CURRENT_TIMESTAMP
      `);

      for (const section of sections) {
        const sectionId = section.section_id;
        const sectionType = section.section_type; // 'movie' or 'show'
        const mediaType = sectionType === 'show' ? 'tv' : 'movie';

        trace(`Syncing Tautulli watch history for library: "${section.section_name}" (Type: ${sectionType}, ID: ${sectionId})`);
        
        try {
          const mediaItems = await tautulli.getLibraryMediaInfo(sectionId);
          
          const transaction = db.transaction(() => {
            mediaItems.forEach(item => {
              // Retrieve TMDB ID for movies or TVDB ID for TV shows
              const externalIdRaw = mediaType === 'movie' ? item.tmdb_id : item.tvdb_id;
              if (!externalIdRaw) return;

              const externalId = parseInt(externalIdRaw, 10);
              if (isNaN(externalId)) return;

              const ratingKey = item.rating_key ? parseInt(item.rating_key, 10) : null;
              const playCount = item.play_count ? parseInt(item.play_count, 10) : 0;
              const lastPlayed = item.last_played ? new Date(parseInt(item.last_played, 10) * 1000).toISOString() : null;
              const totalWatchTime = item.duration ? parseInt(item.duration, 10) : 0;

              insertStmt.run(externalId, mediaType, ratingKey, playCount, lastPlayed, totalWatchTime);
            });
          });

          transaction();
        } catch (err) {
          error(`Failed to sync Tautulli library section ${sectionId}`, err);
        }
      }

      info('Tautulli watch stats sync successfully completed.');
    } catch (err) {
      error('Failed to run Tautulli watch stats synchronization pipeline', err);
    }
  }

  /**
   * Triggers a full synchronization across all services
   */
  async runFullSync(): Promise<void> {
    info('Triggering full synchronization pipeline...');
    await this.syncRadarr();
    await this.syncSonarr();
    await this.syncTautulli();
    info('Full synchronization pipeline finished.');
  }
}
