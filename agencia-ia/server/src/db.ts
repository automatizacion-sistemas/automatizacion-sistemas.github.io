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
  // 4 · Tablero de tareas y coordinación entre agentes
  `CREATE TABLE tasks (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     flow_id TEXT,
     flow_name TEXT NOT NULL DEFAULT '',
     step INTEGER NOT NULL DEFAULT 0,
     title TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     agent_id TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pendiente',
     priority TEXT NOT NULL DEFAULT 'normal',
     due_date TEXT,
     depends_on TEXT REFERENCES tasks(id) ON DELETE SET NULL,
     result TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX tasks_business ON tasks (business_id, status);
   CREATE TABLE task_events (
     id TEXT PRIMARY KEY,
     task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     note TEXT NOT NULL DEFAULT '',
     created_at TEXT NOT NULL
   );
   CREATE INDEX task_events_task ON task_events (task_id, created_at);`,
  // 5 · Estudio de video (montaje local con FFmpeg)
  `CREATE TABLE video_projects (
     id TEXT PRIMARY KEY,
     business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     fit TEXT NOT NULL DEFAULT 'difuminado',
     bg_color TEXT NOT NULL DEFAULT '#000000',
     clip_volume REAL NOT NULL DEFAULT 1,
     music_volume REAL NOT NULL DEFAULT 0.35,
     music_file TEXT,
     music_name TEXT,
     fades INTEGER NOT NULL DEFAULT 1,
     subtitle_position TEXT NOT NULL DEFAULT 'abajo',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE video_clips (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     file TEXT NOT NULL,
     original_name TEXT NOT NULL,
     duration REAL NOT NULL DEFAULT 0,
     width INTEGER NOT NULL DEFAULT 0,
     height INTEGER NOT NULL DEFAULT 0,
     has_audio INTEGER NOT NULL DEFAULT 0,
     position INTEGER NOT NULL DEFAULT 0,
     trim_start REAL NOT NULL DEFAULT 0,
     trim_end REAL,
     image_duration REAL NOT NULL DEFAULT 3,
     created_at TEXT NOT NULL
   );
   CREATE TABLE video_subtitles (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
     start REAL NOT NULL,
     end REAL NOT NULL,
     text TEXT NOT NULL
   );
   CREATE TABLE video_renders (
     id TEXT PRIMARY KEY,
     project_id TEXT NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
     format TEXT NOT NULL,
     quality TEXT NOT NULL,
     status TEXT NOT NULL,
     progress REAL NOT NULL DEFAULT 0,
     file TEXT,
     size INTEGER,
     duration REAL,
     error TEXT,
     created_at TEXT NOT NULL,
     finished_at TEXT
   );`,
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
