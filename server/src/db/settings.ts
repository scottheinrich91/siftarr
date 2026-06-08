import { db } from './connection.js';
import { trace } from '../logger.js';

export const SETTINGS_ENV_MAP: Record<string, string> = {
  dry_run: 'SIFTARR_DRY_RUN',
  radarr_url: 'RADARR_URL',
  radarr_api_key: 'RADARR_API_KEY',
  sonarr_url: 'SONARR_URL',
  sonarr_api_key: 'SONARR_API_KEY',
  tautulli_url: 'TAUTULLI_URL',
  tautulli_api_key: 'TAUTULLI_API_KEY',
  overseerr_url: 'OVERSEERR_URL',
  overseerr_api_key: 'OVERSEERR_API_KEY',
  tmdb_api_key: 'TMDB_API_KEY',
  delete_file_on_upgrade: 'DELETE_FILE_ON_UPGRADE',
  delete_file_on_downgrade: 'DELETE_FILE_ON_DOWNGRADE'
};

/**
 * Gets a setting value, prioritizing environment variables over database values
 */
export function getSetting(key: string): string | undefined {
  const envKey = SETTINGS_ENV_MAP[key];
  if (envKey && process.env[envKey] !== undefined) {
    trace(`Config: Loading setting "${key}" from env var "${envKey}"`);
    return process.env[envKey];
  }

  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  } catch (err) {
    return undefined;
  }
}

/**
 * Gets a boolean setting value, prioritizing environment variables
 */
export function getSettingBool(key: string, defaultValue: boolean = false): boolean {
  const val = getSetting(key);
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1' || val === 'yes';
}

/**
 * Resolves all active configuration settings, blending database records with env overrides
 */
export function getAllSettings(): Record<string, string> {
  const settingsObj: Record<string, string> = {};

  // Initialize with database rows
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    rows.forEach(r => {
      if (r.key !== 'api_key') {
        settingsObj[r.key] = r.value;
      }
    });
  } catch (err) {
    // Database might not be initialized yet
  }

  // Overlay env overrides
  for (const [key, envKey] of Object.entries(SETTINGS_ENV_MAP)) {
    if (process.env[envKey] !== undefined) {
      settingsObj[key] = process.env[envKey]!;
    }
  }

  return settingsObj;
}
