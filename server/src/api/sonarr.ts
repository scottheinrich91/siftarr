import axios, { AxiosInstance } from 'axios';
import { info, error, trace } from '../logger.js';

export class SonarrClient {
  public client: AxiosInstance;

  constructor(url: string, apiKey: string) {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v3`,
      headers: {
        'X-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get('/system/status');
      return response.status === 200 && !!response.data.version;
    } catch (err) {
      error('Sonarr connection test failed', err);
      return false;
    }
  }

  async getProfiles(): Promise<any[]> {
    try {
      const response = await this.client.get('/qualityprofile');
      return response.data;
    } catch (err) {
      error('Failed to fetch Sonarr quality profiles', err);
      throw err;
    }
  }

  async getSeries(id: number): Promise<any> {
    try {
      const response = await this.client.get(`/series/${id}`);
      return response.data;
    } catch (err) {
      error(`Failed to fetch Sonarr series ${id}`, err);
      throw err;
    }
  }

  async updateSeries(seriesPayload: any): Promise<void> {
    try {
      await this.client.put(`/series/${seriesPayload.id}`, seriesPayload);
      info(`Successfully updated Sonarr series: "${seriesPayload.title}" (ID: ${seriesPayload.id})`);
    } catch (err) {
      error(`Failed to update Sonarr series ${seriesPayload.id}`, err);
      throw err;
    }
  }

  async deleteSeries(id: number, deleteFiles: boolean = true, addExclusion: boolean = true): Promise<void> {
    try {
      await this.client.delete(`/series/${id}`, {
        params: {
          deleteFiles,
          addImportListExclusion: addExclusion
        }
      });
      info(`Successfully deleted Sonarr series ID: ${id} (deleteFiles: ${deleteFiles}, addExclusion: ${addExclusion})`);
    } catch (err) {
      error(`Failed to delete Sonarr series ${id}`, err);
      throw err;
    }
  }

  async triggerSearch(seriesId: number): Promise<void> {
    try {
      await this.client.post('/command', {
        name: 'SeriesSearch',
        seriesId
      });
      trace(`Triggered Sonarr search command for series ID: ${seriesId}`);
    } catch (err) {
      error(`Failed to trigger Sonarr search command for series ${seriesId}`, err);
      throw err;
    }
  }

  async getRootFolders(): Promise<any[]> {
    try {
      const response = await this.client.get('/rootfolder');
      return response.data;
    } catch (err) {
      error('Failed to fetch Sonarr root folders', err);
      throw err;
    }
  }
}
