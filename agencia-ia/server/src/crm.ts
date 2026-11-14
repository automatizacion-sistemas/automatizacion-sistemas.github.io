import type { FastifyInstance } from 'fastify';
import { db, newId, now } from './db.js';
import { getBusiness } from './businesses.js';
import { logActivity } from './activity.js';

/**
 * CRM comercial de Sofía. Funciona 100 % en local y sin costo.
 * No envía mensajes: WhatsApp se abre en el dispositivo del usuario con el texto listo,
 * y es el usuario quien decide enviarlo.
 */

export const STAGES = ['nuevo', 'contactado', 'interesado', 'propuesta', 'negociacion', 'ganado', 'perdido'] as const;
export const PRIORITIES = ['caliente', 'tibio', 'frio'] as const;
export const CHANNELS = ['whatsapp', 'llamada', 'correo', 'reunion', 'otro'] as const;
type Stage = (typeof STAGES)[number];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;

interface ProspectRow {
  id: string;
  business_id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  service: string;
  contact_date: string | null;
  stage: Stage;
  priority: string;
  next_followup: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  followup_count?: number;
  last_followup?: string | null;
}

const toProspect = (r: ProspectRow) => ({
  id: r.id,
  businessId: r.business_id,
  name: r.name,
  company: r.company,
  phone: r.phone,
  email: r.email,
  service: r.service,
  contactDate: r.contact_date,
  stage: r.stage,
  priority: r.priority,
  nextFollowup: r.next_followup,
  notes: r.notes,
  followupCount: r.followup_count ?? 0,
  lastFollowup: r.last_followup ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function parseProspect(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 160);
  if (!name) return { error: 'El nombre del prospecto es obligatorio.' } as const;
  const email = text(b.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'El correo no tiene un formato válido.' } as const;
  return {
    data: {
      name,
      company: text(b.company, 160),
      phone: text(b.phone, 40),
      email,
      service: text(b.service, 200),
      contactDate: date(b.contactDate),
      stage: oneOf(b.stage, STAGES, 'nuevo'),
      priority: oneOf(b.priority, PRIORITIES, 'tibio'),
      nextFollowup: date(b.nextFollowup),
      notes: text(b.notes, 6000),
    },
  } as const;
}

const SELECT = `SELECT p.*, (SELECT COUNT(*) FROM followups f WHERE f.prospect_id = p.id) AS followup_count,
                       (SELECT MAX(date) FROM followups f WHERE f.prospect_id = p.id) AS last_followup
                FROM prospects p`;

function getProspect(id: string) {
  const r = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as unknown as ProspectRow | undefined;
  return r ? toProspect(r) : null;
}

export function registerCrm(app: FastifyInstance) {
  const requireBusiness = (id: string | undefined) => (id ? getBusiness(id) : null);

  // ---- Prospectos ----
  app.get<{ Querystring: { businessId?: string } }>('/api/crm/prospects', async (req, reply) => {
    const b = requireBusiness(req.query.businessId);
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const rows = db
      .prepare(`${SELECT} WHERE p.business_id = ? ORDER BY COALESCE(p.next_followup, '9999-12-31'), p.updated_at DESC`)
      .all(b.id) as unknown as ProspectRow[];
    return { prospects: rows.map(toProspect) };
  });

  app.post<{ Body: Record<string, unknown> & { businessId?: string } }>('/api/crm/prospects', async (req, reply) => {
    const b = requireBusiness(req.body?.businessId as string | undefined);
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const parsed = parseProspect(req.body);
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
    const d = parsed.data;
    const id = newId();
    const t = now();
    db.prepare(
      `INSERT INTO prospects (id, business_id, name, company, phone, email, service, contact_date, stage, priority, next_followup, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, b.id, d.name, d.company, d.phone, d.email, d.service, d.contactDate, d.stage, d.priority, d.nextFollowup, d.notes, t, t);
    logActivity({ businessId: b.id, agentId: 'sofia', kind: 'prospecto_creado', summary: `Nuevo prospecto: ${d.name}${d.company ? ` (${d.company})` : ''}.` });
    return reply.code(201).send(getProspect(id));
  });

  app.put<{ Params: { id: string } }>('/api/crm/prospects/:id', async (req, reply) => {
    const before = getProspect(req.params.id);
    if (!before) return reply.code(404).send({ error: 'Prospecto no encontrado.' });
    const parsed = parseProspect(req.body);
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
    const d = parsed.data;
    db.prepare(
      `UPDATE prospects SET name = ?, company = ?, phone = ?, email = ?, service = ?, contact_date = ?, stage = ?, priority = ?,
              next_followup = ?, notes = ?, updated_at = ? WHERE id = ?`,
    ).run(d.name, d.company, d.phone, d.email, d.service, d.contactDate, d.stage, d.priority, d.nextFollowup, d.notes, now(), before.id);
    if (before.stage !== d.stage)
      logActivity({
        businessId: before.businessId,
        agentId: 'sofia',
        kind: 'prospecto_etapa',
        summary: `${d.name} pasó de "${before.stage}" a "${d.stage}".`,
      });
    return getProspect(before.id);
  });

  app.delete<{ Params: { id: string } }>('/api/crm/prospects/:id', async (req, reply) => {
    const p = getProspect(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Prospecto no encontrado.' });
    db.prepare('DELETE FROM prospects WHERE id = ?').run(p.id);
    logActivity({ businessId: p.businessId, agentId: 'sofia', kind: 'prospecto_eliminado', summary: `Se eliminó el prospecto ${p.name}.` });
    return { ok: true };
  });

  // ---- Seguimientos ----
  app.get<{ Params: { id: string } }>('/api/crm/prospects/:id/followups', async (req, reply) => {
    if (!getProspect(req.params.id)) return reply.code(404).send({ error: 'Prospecto no encontrado.' });
    const rows = db
      .prepare('SELECT id, date, channel, note, created_at AS createdAt FROM followups WHERE prospect_id = ? ORDER BY date DESC, created_at DESC')
      .all(req.params.id);
    return { followups: rows };
  });

  app.post<{ Params: { id: string }; Body: { date?: string; channel?: string; note?: string; nextFollowup?: string | null } }>(
    '/api/crm/prospects/:id/followups',
    async (req, reply) => {
      const p = getProspect(req.params.id);
      if (!p) return reply.code(404).send({ error: 'Prospecto no encontrado.' });
      const note = text(req.body?.note, 4000);
      if (!note) return reply.code(400).send({ error: 'Escribe qué pasó en el seguimiento.' });
      const d = date(req.body?.date) ?? now().slice(0, 10);
      db.prepare('INSERT INTO followups (id, prospect_id, date, channel, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        newId(),
        p.id,
        d,
        oneOf(req.body?.channel, CHANNELS, 'otro'),
        note,
        now(),
      );
      // Al registrar un seguimiento se actualiza el próximo (o se limpia si se indica null).
      if (req.body && 'nextFollowup' in req.body)
        db.prepare('UPDATE prospects SET next_followup = ?, updated_at = ? WHERE id = ?').run(date(req.body.nextFollowup), now(), p.id);
      if (p.stage === 'nuevo') db.prepare("UPDATE prospects SET stage = 'contactado' WHERE id = ?").run(p.id);
      logActivity({ businessId: p.businessId, agentId: 'sofia', kind: 'seguimiento', summary: `Seguimiento a ${p.name}: ${note.slice(0, 80)}` });
      return reply.code(201).send(getProspect(p.id));
    },
  );

  // ---- Plantillas de mensajes ----
  app.get<{ Querystring: { businessId?: string } }>('/api/crm/templates', async (req, reply) => {
    const b = requireBusiness(req.query.businessId);
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const rows = db
      .prepare('SELECT id, name, body, updated_at AS updatedAt FROM message_templates WHERE business_id = ? ORDER BY name COLLATE NOCASE')
      .all(b.id);
    return { templates: rows };
  });

  app.post<{ Body: { businessId?: string; name?: string; body?: string } }>('/api/crm/templates', async (req, reply) => {
    const b = requireBusiness(req.body?.businessId);
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const name = text(req.body?.name, 120);
    const body = text(req.body?.body, 4000);
    if (!name || !body) return reply.code(400).send({ error: 'La plantilla necesita nombre y texto.' });
    const id = newId();
    db.prepare('INSERT INTO message_templates (id, business_id, name, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      b.id,
      name,
      body,
      now(),
      now(),
    );
    return reply.code(201).send({ id, name, body });
  });

  app.put<{ Params: { id: string }; Body: { name?: string; body?: string } }>('/api/crm/templates/:id', async (req, reply) => {
    const name = text(req.body?.name, 120);
    const body = text(req.body?.body, 4000);
    if (!name || !body) return reply.code(400).send({ error: 'La plantilla necesita nombre y texto.' });
    const res = db.prepare('UPDATE message_templates SET name = ?, body = ?, updated_at = ? WHERE id = ?').run(name, body, now(), req.params.id);
    if (!res.changes) return reply.code(404).send({ error: 'Plantilla no encontrada.' });
    return { id: req.params.id, name, body };
  });

  app.delete<{ Params: { id: string } }>('/api/crm/templates/:id', async (req, reply) => {
    const res = db.prepare('DELETE FROM message_templates WHERE id = ?').run(req.params.id);
    if (!res.changes) return reply.code(404).send({ error: 'Plantilla no encontrada.' });
    return { ok: true };
  });

  // Registro de que el usuario abrió WhatsApp con un mensaje preparado (el envío lo hace él).
  app.post<{ Params: { id: string }; Body: { templateName?: string } }>('/api/crm/prospects/:id/whatsapp-opened', async (req, reply) => {
    const p = getProspect(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Prospecto no encontrado.' });
    logActivity({
      businessId: p.businessId,
      agentId: 'sofia',
      kind: 'whatsapp_preparado',
      summary: `Se abrió WhatsApp con un mensaje para ${p.name}${req.body?.templateName ? ` (plantilla "${text(req.body.templateName, 120)}")` : ''}. El envío lo confirma el usuario.`,
    });
    return { ok: true };
  });

  // ---- Resumen para el panel de Sofía y el informe ----
  app.get<{ Querystring: { businessId?: string } }>('/api/crm/summary', async (req, reply) => {
    const b = requireBusiness(req.query.businessId);
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const t = iso(today);
    const week = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));
    const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    for (const r of db.prepare('SELECT stage, COUNT(*) AS n FROM prospects WHERE business_id = ? GROUP BY stage').all(b.id) as {
      stage: Stage;
      n: number;
    }[])
      byStage[r.stage] = r.n;
    const open = "stage NOT IN ('ganado','perdido')";
    const count = (where: string, ...params: string[]) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM prospects WHERE business_id = ? AND ${where}`).get(b.id, ...params) as { n: number }).n;
    const total = Object.values(byStage).reduce((a, n) => a + n, 0);
    const closed = byStage.ganado + byStage.perdido;
    return {
      today: t,
      total,
      byStage,
      overdue: count(`${open} AND next_followup < ?`, t),
      dueToday: count(`${open} AND next_followup = ?`, t),
      dueWeek: count(`${open} AND next_followup > ? AND next_followup <= ?`, t, week),
      winRate: closed ? byStage.ganado / closed : null,
    };
  });
}
