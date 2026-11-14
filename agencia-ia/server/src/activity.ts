import { db, newId, now } from './db.js';
import { broadcast } from './events.js';

export interface ActivityEntry {
  id: string;
  businessId: string | null;
  agentId: string | null;
  kind: string;
  summary: string;
  detail: unknown;
  createdAt: string;
}

/** Registra una operación importante (bitácora de auditoría) y la emite a la interfaz. */
export function logActivity(input: {
  businessId?: string | null;
  agentId?: string | null;
  kind: string;
  summary: string;
  detail?: unknown;
}): ActivityEntry {
  const entry: ActivityEntry = {
    id: newId(),
    businessId: input.businessId ?? null,
    agentId: input.agentId ?? null,
    kind: input.kind,
    summary: input.summary,
    detail: input.detail ?? null,
    createdAt: now(),
  };
  db.prepare(
    'INSERT INTO activity (id, business_id, agent_id, kind, summary, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    entry.id,
    entry.businessId,
    entry.agentId,
    entry.kind,
    entry.summary,
    entry.detail === null ? null : JSON.stringify(entry.detail),
    entry.createdAt,
  );
  broadcast('activity', entry);
  return entry;
}

interface Row {
  id: string;
  business_id: string | null;
  agent_id: string | null;
  kind: string;
  summary: string;
  detail: string | null;
  created_at: string;
}

export function listActivity(filter: { agentId?: string; businessId?: string; limit?: number }): ActivityEntry[] {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.agentId) {
    where.push('agent_id = ?');
    params.push(filter.agentId);
  }
  if (filter.businessId) {
    where.push('(business_id = ? OR business_id IS NULL)');
    params.push(filter.businessId);
  }
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const sql = `SELECT * FROM activity ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ${limit}`;
  const rows = db.prepare(sql).all(...params) as unknown as Row[];
  return rows.map((r) => ({
    id: r.id,
    businessId: r.business_id,
    agentId: r.agent_id,
    kind: r.kind,
    summary: r.summary,
    detail: r.detail ? JSON.parse(r.detail) : null,
    createdAt: r.created_at,
  }));
}
