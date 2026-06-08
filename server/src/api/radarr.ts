import axios, { AxiosInstance } from 'axios';
import { info, error, trace } from '../logger.js';

export class RadarrClient {
  public client: AxiosInstance;

  constructor(url: string, apiKey: string) {
    // Ensure clean base URL (no trailing slash)
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
      error('Radarr connection test failed', err);
      return false;
    }
  }

  async getProfiles(): Promise<any[]> {
    try {
      const response = await this.client.get('/qualityprofile');
      return response.data;
    } catch (err) {
      error('Failed to fetch Radarr quality profiles', err);
      throw err;
    }
  }

  async getMovie(id: number): Promise<any> {
    try {
      const response = await this.client.get(`/movie/${id}`);
      return response.data;
    } catch (err) {
      error(`Failed to fetch Radarr movie ${id}`, err);
      throw err;
    }
  }

  async updateMovie(moviePayload: any): Promise<void> {
    try {
      // Radarr requires putting the full movie payload back to avoid dropping fields
      await this.client.put(`/movie/${moviePayload.id}`, moviePayload);
      info(`Successfully updated Radarr movie: "${moviePayload.title}" (ID: ${moviePayload.id})`);
    } catch (err) {
      error(`Failed to update Radarr movie ${moviePayload.id}`, err);
      throw err;
    }
  }

  async deleteMovie(id: number, deleteFiles: boolean = true, addExclusion: boolean = true): Promise<void> {
    try {
      // Clean delete deletes files and prevents import lists from immediately re-adding the media
      await this.client.delete(`/movie/${id}`, {
        params: {
          deleteFiles,
          addImportListExclusion: addExclusion
        }
      });
      info(`Successfully deleted Radarr movie ID: ${id} (deleteFiles: ${deleteFiles}, addExclusion: ${addExclusion})`);
    } catch (err) {
      error(`Failed to delete Radarr movie ${id}`, err);
      throw err;
    }
  }

  async triggerSearch(movieId: number): Promise<void> {
    try {
      await this.client.post('/command', {
        name: 'MoviesSearch',
        movieIds: [movieId]
      });
      trace(`Triggered Radarr search command for movie ID: ${movieId}`);
    } catch (err) {
      error(`Failed to trigger Radarr search command for movie ${movieId}`, err);
      throw err;
    }
  }

  async getRootFolders(): Promise<any[]> {
    try {
      const response = await this.client.get('/rootfolder');
      return response.data;
    } catch (err) {
      error('Failed to fetch Radarr root folders', err);
      throw err;
    }
  }
}
