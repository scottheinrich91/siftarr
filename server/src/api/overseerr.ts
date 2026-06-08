import axios, { AxiosInstance } from 'axios';
import { info, error, trace } from '../logger.js';

/**
 * Overseerr / Jellyseerr (Seerr) API Client wrapper.
 * Compatible with all Seerr-based request management stacks.
 */
export class OverseerrClient {
  private client: AxiosInstance;

  constructor(url: string, apiKey: string) {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v1`,
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/status');
      return response.status === 200 && !!response.data.version;
    } catch (err) {
      error('Overseerr connection test failed', err);
      return false;
    }
  }

  /**
   * Fetches internal Overseerr media info ID for a given TMDB (movie) or TVDB (show) ID
   */
  async getMediaInfoId(externalId: number, type: 'movie' | 'tv'): Promise<number | null> {
    try {
      const endpoint = type === 'movie' ? `/movie/${externalId}` : `/tv/${externalId}`;
      const response = await this.client.get(endpoint);
      
      const mediaInfo = response.data.mediaInfo;
      if (mediaInfo && typeof mediaInfo.id === 'number') {
        trace(`Found Overseerr mediaInfo ID: ${mediaInfo.id} for external ID: ${externalId} (${type})`);
        return mediaInfo.id;
      }
      
      trace(`No active Overseerr mediaInfo found for external ID: ${externalId} (${type})`);
      return null;
    } catch (err) {
      error(`Failed to fetch Overseerr media status for external ID ${externalId} (${type})`, err);
      return null; // Don't throw to prevent blocking the deletion cascade
    }
  }

  /**
   * Deletes a media item from Overseerr's database, resetting its status so users can re-request it
   */
  async deleteMediaData(mediaId: number): Promise<void> {
    try {
      await this.client.delete(`/media/${mediaId}`);
      info(`Successfully deleted Overseerr media data ID: ${mediaId}`);
    } catch (err) {
      error(`Failed to delete Overseerr media data ID: ${mediaId}`, err);
      throw err;
    }
  }

  /**
   * Orchestrates a clean Overseerr sync deletion for a given movie/show
   */
  async cleanSyncDelete(externalId: number, type: 'movie' | 'tv'): Promise<boolean> {
    try {
      const mediaId = await this.getMediaInfoId(externalId, type);
      if (mediaId !== null) {
        await this.deleteMediaData(mediaId);
        return true;
      }
      return false;
    } catch (err) {
      error(`Overseerr clean sync deletion failed for external ID ${externalId} (${type})`, err);
      return false;
    }
  }
}
