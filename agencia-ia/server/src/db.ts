import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const UPLOADS_DIR = path.join(config.dataDir, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'agencia.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

/** Migraciones en orden. Nunca se editan una vez publicadas: se agregan nuevas. */
const MIGRATIONS: string[] = [
  `CREATE TABLE businesses (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     products TEXT NOT NULL DEFAULT '',
     audience TEXT NOT NULL DEFAULT '',
     goals TEXT NOT NULL DEFAULT '',
     colors TEXT NOT NULL DEFAULT '[]',
     socials TEXT NOT NULL DEFAULT '{}',
     logo_file TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE messages (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     agent_id TEXT NOT NULL,
     role TEXT NOT NULL CHECK (role IN ('user','assistant')),
     content TEXT NOT NULL,
     model TEXT,
     input_tokens INTEGER,
     output_tokens INTEGER,
     cache_read_tokens INTEGER,
     cost_usd REAL,
     created_at TEXT NOT NULL
   );
   CREATE INDEX messages_thread ON messages (business_id, agent_id, created_at);
   CREATE TABLE activity (
     id TEXT PRIMARY KEY,
     business_id TEXT,
     agent_id TEXT,
     kind TEXT NOT NULL,
     summary TEXT NOT NULL,
     detail TEXT,
     created_at TEXT NOT NULL
   );
   CREATE INDEX activity_recent ON activity (created_at DESC);`,
];

function migrate() {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;
  let current = row?.version ?? 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  while (current < MIGRATIONS.length) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[current]);
      current += 1;
      db.prepare('UPDATE schema_version SET version = ?').run(current);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}
migrate();

export const now = () => new Date().toISOString();
export const newId = () => randomUUID();

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  if (value === null) db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  else
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      key,
      value,
    );
}
