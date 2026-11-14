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
  // 2 · CRM comercial (gratuito, local)
  `CREATE TABLE prospects (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     company TEXT NOT NULL DEFAULT '',
     phone TEXT NOT NULL DEFAULT '',
     email TEXT NOT NULL DEFAULT '',
     service TEXT NOT NULL DEFAULT '',
     contact_date TEXT,
     stage TEXT NOT NULL DEFAULT 'nuevo',
     priority TEXT NOT NULL DEFAULT 'tibio',
     next_followup TEXT,
     notes TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX prospects_business ON prospects (business_id, stage);
   CREATE TABLE followups (
     id TEXT PRIMARY KEY,
     prospect_id TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
     date TEXT NOT NULL,
     channel TEXT NOT NULL DEFAULT 'otro',
     note TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE INDEX followups_prospect ON followups (prospect_id, date);
   CREATE TABLE message_templates (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     body TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );`,
  // 3 · Calendario editorial (gratuito, publicación manual)
  `CREATE TABLE posts (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     date TEXT NOT NULL,
     time TEXT NOT NULL DEFAULT '',
     network TEXT NOT NULL,
     title TEXT NOT NULL DEFAULT '',
     body TEXT NOT NULL DEFAULT '',
     hashtags TEXT NOT NULL DEFAULT '',
     media TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'borrador',
     owner TEXT NOT NULL DEFAULT 'diego',
     post_url TEXT NOT NULL DEFAULT '',
     review_note TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX posts_business_date ON posts (business_id, date);`,
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
