import type { FastifyInstance } from 'fastify';
import { db, newId, now } from './db.js';
import { getBusiness } from './businesses.js';
import { logActivity } from './activity.js';

/**
 * Calendario editorial de Diego. Gratuito: no publica por API.
 * El usuario publica o programa en cada red y registra aquí el resultado.
 */

export const NETWORKS = ['facebook', 'instagram', 'tiktok', 'youtube'] as const;
export const STATUSES = ['borrador', 'pendiente', 'aprobado', 'programado', 'publicado', 'error'] as const;
export const OWNERS = ['diego', 'valeria', 'sofia', 'usuario'] as const;
type Status = (typeof STATUSES)[number];

const NETWORK_LABEL: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
const STATUS_LABEL: Record<Status, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de aprobación',
  aprobado: 'Aprobado',
  programado: 'Programado',
  publicado: 'Publicado',
  error: 'Error',
};

/** Cambios de estado permitidos. Aprobar es una decisión del usuario. */
const TRANSITIONS: Record<Status, Status[]> = {
  borrador: ['pendiente'],
  pendiente: ['aprobado', 'borrador'],
  aprobado: ['programado', 'publicado', 'borrador'],
  programado: ['publicado', 'error', 'aprobado'],
  publicado: ['error'],
  error: ['borrador', 'aprobado', 'publicado'],
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

interface Row {
  id: string;
  business_id: string;
  date: string;
  time: string;
  network: string;
  title: string;
  body: string;
  hashtags: string;
  media: string;
  status: Status;
  owner: string;
  post_url: string;
  review_note: string;
  created_at: string;
  updated_at: string;
}

const toPost = (r: Row) => ({
  id: r.id,
  businessId: r.business_id,
  date: r.date,
  time: r.time,
  network: r.network,
  title: r.title,
  body: r.body,
  hashtags: r.hashtags,
  media: r.media,
  status: r.status,
  owner: r.owner,
  postUrl: r.post_url,
  reviewNote: r.review_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function getPost(id: string) {
  const r = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as unknown as Row | undefined;
  return r ? toPost(r) : null;
}

function parseContent(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const date = typeof b.date === 'string' && DATE.test(b.date) ? b.date : null;
  if (!date) return { error: 'Indica la fecha de publicación.' } as const;
  const time = typeof b.time === 'string' && TIME.test(b.time) ? b.time : '';
  const owner = oneOf(b.owner, OWNERS) ?? 'diego';
  return {
    data: {
      date,
      time,
      owner,
      title: text(b.title, 200),
      body: text(b.body, 63000),
      hashtags: text(b.hashtags, 2000),
      media: text(b.media, 1000),
    },
  } as const;
}

const label = (p: { network: string; date: string; time: string }) =>
  `${NETWORK_LABEL[p.network] ?? p.network} del ${p.date}${p.time ? ` ${p.time}` : ''}`;

export function registerCalendar(app: FastifyInstance) {
  app.get<{ Querystring: { businessId?: string; from?: string; to?: string } }>('/api/calendar/posts', async (req, reply) => {
    const b = req.query.businessId ? getBusiness(req.query.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const from = req.query.from && DATE.test(req.query.from) ? req.query.from : '0000-01-01';
    const to = req.query.to && DATE.test(req.query.to) ? req.query.to : '9999-12-31';
    const rows = db
      .prepare("SELECT * FROM posts WHERE business_id = ? AND date BETWEEN ? AND ? ORDER BY date, CASE WHEN time = '' THEN '99:99' ELSE time END")
      .all(b.id, from, to) as unknown as Row[];
    return { posts: rows.map(toPost) };
  });

  /** Crea una publicación por cada red elegida (mismo contenido base, se ajusta luego por red). */
  app.post<{ Body: Record<string, unknown> & { businessId?: string; networks?: unknown } }>('/api/calendar/posts', async (req, reply) => {
    const b = typeof req.body?.businessId === 'string' ? getBusiness(req.body.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const parsed = parseContent(req.body);
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
    const networks = Array.isArray(req.body?.networks)
      ? [...new Set(req.body.networks.map((n) => oneOf(n, NETWORKS)).filter((n): n is (typeof NETWORKS)[number] => Boolean(n)))]
      : [];
    if (!networks.length) return reply.code(400).send({ error: 'Elige al menos una red social.' });
    const d = parsed.data;
    const t = now();
    const ids: string[] = [];
    for (const network of networks) {
      const id = newId();
      ids.push(id);
      db.prepare(
        `INSERT INTO posts (id, business_id, date, time, network, title, body, hashtags, media, status, owner, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?)`,
      ).run(id, b.id, d.date, d.time, network, d.title, d.body, d.hashtags, d.media, d.owner, t, t);
    }
    logActivity({
      businessId: b.id,
      agentId: 'diego',
      kind: 'publicacion_creada',
      summary: `Borrador para ${networks.map((n) => NETWORK_LABEL[n]).join(', ')} el ${d.date}${d.title ? `: "${d.title}"` : ''}.`,
    });
    return reply.code(201).send({ posts: ids.map((id) => getPost(id)) });
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/calendar/posts/:id', async (req, reply) => {
    const p = getPost(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Publicación no encontrada.' });
    if (p.status === 'publicado')
      return reply.code(409).send({ error: 'Ya está publicada: edítala en la red social. Aquí solo puedes registrar el enlace o un error.' });
    const parsed = parseContent(req.body);
    if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
    const d = parsed.data;
    const network = oneOf(req.body?.network, NETWORKS) ?? p.network;
    const contentChanged =
      d.title !== p.title || d.body !== p.body || d.hashtags !== p.hashtags || d.media !== p.media || d.date !== p.date || d.time !== p.time || network !== p.network;
    // Modificar algo ya aprobado o programado exige volver a aprobarlo.
    const needsReapproval = contentChanged && (p.status === 'aprobado' || p.status === 'programado');
    const status: Status = needsReapproval ? 'pendiente' : p.status;
    db.prepare(
      `UPDATE posts SET date = ?, time = ?, network = ?, title = ?, body = ?, hashtags = ?, media = ?, owner = ?, status = ?, updated_at = ? WHERE id = ?`,
    ).run(d.date, d.time, network, d.title, d.body, d.hashtags, d.media, d.owner, status, now(), p.id);
    if (needsReapproval)
      logActivity({
        businessId: p.businessId,
        agentId: 'diego',
        kind: 'publicacion_reaprobacion',
        summary: `Se modificó la publicación de ${label({ ...p, network })} que estaba ${STATUS_LABEL[p.status].toLowerCase()}: vuelve a requerir aprobación.`,
      });
    return getPost(p.id);
  });

  app.post<{ Params: { id: string }; Body: { status?: string; note?: string; postUrl?: string } }>(
    '/api/calendar/posts/:id/status',
    async (req, reply) => {
      const p = getPost(req.params.id);
      if (!p) return reply.code(404).send({ error: 'Publicación no encontrada.' });
      const next = oneOf(req.body?.status, STATUSES);
      if (!next) return reply.code(400).send({ error: 'Estado no válido.' });
      if (!TRANSITIONS[p.status].includes(next))
        return reply.code(409).send({ error: `No se puede pasar de "${STATUS_LABEL[p.status]}" a "${STATUS_LABEL[next]}".` });
      const note = text(req.body?.note, 2000);
      if ((next === 'error' || (p.status === 'pendiente' && next === 'borrador')) && !note)
        return reply.code(400).send({ error: next === 'error' ? 'Describe el error.' : 'Indica qué hay que corregir.' });
      const url = text(req.body?.postUrl, 500);
      if (url && !/^https?:\/\//i.test(url)) return reply.code(400).send({ error: 'El enlace debe empezar con http:// o https://' });
      db.prepare('UPDATE posts SET status = ?, review_note = ?, post_url = CASE WHEN ? <> \'\' THEN ? ELSE post_url END, updated_at = ? WHERE id = ?').run(
        next,
        note,
        url,
        url,
        now(),
        p.id,
      );
      const verb: Record<Status, string> = {
        borrador: p.status === 'pendiente' ? 'fue devuelta a borrador' : 'volvió a borrador',
        pendiente: 'se envió a aprobación',
        aprobado: 'fue aprobada',
        programado: 'quedó programada en la red',
        publicado: 'se marcó como publicada',
        error: 'se marcó con error',
      };
      logActivity({
        businessId: p.businessId,
        agentId: 'diego',
        kind: `publicacion_${next}`,
        summary: `La publicación de ${label(p)} ${verb[next]}${note ? `: ${note.slice(0, 100)}` : '.'}`,
      });
      return getPost(p.id);
    },
  );

  app.delete<{ Params: { id: string } }>('/api/calendar/posts/:id', async (req, reply) => {
    const p = getPost(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Publicación no encontrada.' });
    db.prepare('DELETE FROM posts WHERE id = ?').run(p.id);
    logActivity({ businessId: p.businessId, agentId: 'diego', kind: 'publicacion_eliminada', summary: `Se eliminó la publicación de ${label(p)}.` });
    return { ok: true };
  });

  app.get<{ Querystring: { businessId?: string } }>('/api/calendar/summary', async (req, reply) => {
    const b = req.query.businessId ? getBusiness(req.query.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
    for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM posts WHERE business_id = ? GROUP BY status').all(b.id) as {
      status: Status;
      n: number;
    }[])
      byStatus[r.status] = r.n;
    const n = (sql: string, ...params: string[]) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE business_id = ? AND ${sql}`).get(b.id, ...params) as { n: number }).n;
    return {
      today,
      byStatus,
      /** Aprobadas o programadas cuya fecha ya pasó y no se registraron como publicadas. */
      overdue: n("status IN ('aprobado','programado') AND date < ?", today),
      dueToday: n("status IN ('aprobado','programado') AND date = ?", today),
    };
  });
}
