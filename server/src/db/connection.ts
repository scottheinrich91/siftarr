import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger, { info, error, trace } from '../logger.js';
import { CONFIG_DIR } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(CONFIG_DIR, 'siftarr.db');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

info(`Initializing SQLite database at: ${DB_PATH}`);

export const db = new Database(DB_PATH, { verbose: (message) => trace(`SQL Query: ${message}`) });

// Enable Write-Ahead Logging (WAL) for better concurrent performance
db.pragma('journal_mode = WAL');

// Ensure schema_version table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Executes pending database migrations
 */
export function runMigrations() {
  info('Checking for database migrations...');
  
  // Resolve migrations directory
  // In development, it's relative to src, in production relative to dist
  let migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    // Try src if we are in dist/db during dev TS execution
    migrationsDir = path.resolve(__dirname, '..', '..', 'src', 'db', 'migrations');
  }

  if (!fs.existsSync(migrationsDir)) {
    error(`Migrations directory not found at: ${migrationsDir}`);
    return;
  }

  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => {
      const numA = parseInt(a.split('_')[0], 10);
      const numB = parseInt(b.split('_')[0], 10);
      return numA - numB;
    });

  trace(`Found migrations: ${JSON.stringify(migrationFiles)}`);

  for (const file of migrationFiles) {
    const version = parseInt(file.split('_')[0], 10);
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');

    // Check if migration already applied
    const row = db.prepare('SELECT version FROM schema_version WHERE version = ?').get(version) as { version: number } | undefined;

    if (row) {
      trace(`Migration ${file} (v${version}) already applied.`);
      continue;
    }

    info(`Applying database migration: ${file} (v${version})`);
    const sqlPath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Run migration in a transaction
    const transaction = db.transaction(() => {
      db.exec(sqlContent);
      db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(version, name);
    });

    try {
      transaction();
      info(`Migration ${file} successfully applied.`);
    } catch (err) {
      error(`Failed to apply migration ${file}`, err);
      throw err;
    }
  }

  info('Database migrations check completed.');
}
