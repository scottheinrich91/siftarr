import axios, { AxiosInstance } from 'axios';
import { error, trace } from '../logger.js';

export class TautulliClient {
  public client: AxiosInstance;
  private apiKey: string;

  constructor(url: string, apiKey: string) {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v2`,
      timeout: 10000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/', {
        params: {
          apikey: this.apiKey,
          cmd: 'status'
        }
      });
      return response.status === 200 && response.data.response.result === 'success';
    } catch (err) {
      error('Tautulli connection test failed', err);
      return false;
    }
  }

  async getLibraryMediaInfo(sectionId: number): Promise<any[]> {
    try {
      const response = await this.client.get('/', {
        params: {
          apikey: this.apiKey,
          cmd: 'get_library_media_info',
          section_id: sectionId
        }
      });
      if (response.data.response.result !== 'success') {
        throw new Error(response.data.response.message || 'Tautulli response returned error status');
      }
      return response.data.response.data || [];
    } catch (err) {
      error(`Failed to fetch Tautulli library info for section ${sectionId}`, err);
      throw err;
    }
  }

  async getItemWatchTimeStats(ratingKey: number): Promise<any> {
    try {
      const response = await this.client.get('/', {
        params: {
          apikey: this.apiKey,
          cmd: 'get_item_watch_time_stats',
          rating_key: ratingKey
        }
      });
      if (response.data.response.result !== 'success') {
        throw new Error(response.data.response.message || 'Tautulli response returned error status');
      }
      return response.data.response.data;
    } catch (err) {
      error(`Failed to fetch Tautulli watch stats for ratingKey ${ratingKey}`, err);
      throw err;
    }
  }
}
