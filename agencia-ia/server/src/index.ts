import fs from 'node:fs';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { db, newId, now } from './db.js';
import { addClient } from './events.js';
import { listActivity, logActivity } from './activity.js';
import { AGENT_IDS, COMMON_RULES, PERSONAS, allStatuses, isAgentId, markDone, markWorking, type AgentId } from './agents.js';
import {
  businessBrief,
  createBusiness,
  deleteBusiness,
  getActiveBusinessId,
  getBusiness,
  listBusinesses,
  logoPath,
  parseBusinessInput,
  saveLogo,
  setActiveBusinessId,
  updateBusiness,
  LOGO_TYPES,
} from './businesses.js';
import { describeError, streamChat, type ChatTurn } from './claude.js';
import { listIntegrations } from './integrations.js';
import { registerCrm } from './crm.js';
import { registerCalendar } from './calendar.js';
import { registerTasks } from './tasks.js';
import { registerVideo } from './video.js';
import { lanBanner, originAllowed, registerLan } from './lan.js';

const app = Fastify({ logger: { level: 'warn' } });
await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

// Accesos desde otros dispositivos: solo en modo celular y con PIN.
registerLan(app);

// Solo se aceptan cambios desde esta computadora o, en modo celular, desde la red local (protege contra páginas web ajenas).
app.addHook('onRequest', async (req, reply) => {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.origin;
  if (origin && !originAllowed(origin, req.headers.host)) return reply.code(403).send({ error: 'Origen no permitido.' });
});

const notFound = (reply: FastifyReply, what = 'Recurso') => reply.code(404).send({ error: `${what} no encontrado.` });

// ---------- Salud y eventos en vivo ----------

app.get('/api/health', async () => ({ ok: true, time: now(), ai: config.anthropicKeyPresent }));

app.get('/api/events', (req: FastifyRequest, reply: FastifyReply) => {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write(`event: agent_statuses\ndata: ${JSON.stringify(allStatuses())}\n\n`);
  addClient(res);
  req.raw.on('close', () => res.end());
});

app.get('/api/agents/status', async () => allStatuses());

// ---------- Negocios ----------

app.get('/api/businesses', async () => ({ businesses: listBusinesses(), activeId: getActiveBusinessId() }));

app.post('/api/businesses', async (req, reply) => {
  const parsed = parseBusinessInput(req.body);
  if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
  const b = createBusiness(parsed.data);
  logActivity({ businessId: b.id, kind: 'negocio_creado', summary: `Se creó el negocio "${b.name}".` });
  return reply.code(201).send(b);
});

app.put<{ Params: { id: string } }>('/api/businesses/:id', async (req, reply) => {
  const parsed = parseBusinessInput(req.body);
  if ('error' in parsed) return reply.code(400).send({ error: parsed.error });
  const b = updateBusiness(req.params.id, parsed.data);
  if (!b) return notFound(reply, 'Negocio');
  logActivity({ businessId: b.id, kind: 'negocio_actualizado', summary: `Se actualizó la ficha de "${b.name}".` });
  return b;
});

app.delete<{ Params: { id: string } }>('/api/businesses/:id', async (req, reply) => {
  const b = getBusiness(req.params.id);
  if (!b) return notFound(reply, 'Negocio');
  deleteBusiness(b.id);
  logActivity({ kind: 'negocio_eliminado', summary: `Se eliminó el negocio "${b.name}" y sus conversaciones.` });
  return { ok: true, activeId: getActiveBusinessId() };
});

app.post<{ Params: { id: string } }>('/api/businesses/:id/logo', async (req, reply) => {
  if (!getBusiness(req.params.id)) return notFound(reply, 'Negocio');
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'No se recibió ningún archivo.' });
  if (!LOGO_TYPES[file.mimetype]) return reply.code(400).send({ error: 'Formato no admitido. Usa PNG, JPG o WEBP.' });
  const data = await file.toBuffer();
  if (file.file.truncated) return reply.code(400).send({ error: 'El logotipo supera los 2 MB.' });
  saveLogo(req.params.id, file.mimetype, data);
  return getBusiness(req.params.id);
});

app.get<{ Params: { id: string } }>('/api/businesses/:id/logo', async (req, reply) => {
  const p = logoPath(req.params.id);
  if (!p || !fs.existsSync(p.file)) return notFound(reply, 'Logotipo');
  reply.header('Cache-Control', 'no-cache').header('X-Content-Type-Options', 'nosniff').type(p.mime);
  return reply.send(fs.createReadStream(p.file));
});

app.put<{ Body: { id?: string } }>('/api/active-business', async (req, reply) => {
  const id = req.body?.id;
  if (!id || !setActiveBusinessId(id)) return notFound(reply, 'Negocio');
  return { activeId: id };
});

// ---------- Conversaciones con los agentes ----------

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

const toMessage = (r: MessageRow) => ({
  id: r.id,
  role: r.role,
  content: r.content,
  model: r.model,
  inputTokens: r.input_tokens,
  outputTokens: r.output_tokens,
  costUsd: r.cost_usd,
  createdAt: r.created_at,
});

function loadThread(businessId: string, agentId: AgentId, limit = 200): MessageRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM (SELECT * FROM messages WHERE business_id = ? AND agent_id = ? ORDER BY created_at DESC LIMIT ${limit})
       ORDER BY created_at ASC`,
    )
    .all(businessId, agentId) as unknown as MessageRow[];
  return rows;
}

app.get<{ Params: { agentId: string }; Querystring: { businessId?: string } }>('/api/chat/:agentId', async (req, reply) => {
  const { agentId } = req.params;
  const businessId = req.query.businessId;
  if (!isAgentId(agentId)) return notFound(reply, 'Agente');
  if (!businessId || !getBusiness(businessId)) return notFound(reply, 'Negocio');
  return { messages: loadThread(businessId, agentId).map(toMessage) };
});

app.delete<{ Params: { agentId: string }; Querystring: { businessId?: string } }>('/api/chat/:agentId', async (req, reply) => {
  const { agentId } = req.params;
  const b = req.query.businessId ? getBusiness(req.query.businessId) : null;
  if (!isAgentId(agentId)) return notFound(reply, 'Agente');
  if (!b) return notFound(reply, 'Negocio');
  const res = db.prepare('DELETE FROM messages WHERE business_id = ? AND agent_id = ?').run(b.id, agentId);
  logActivity({
    businessId: b.id,
    agentId,
    kind: 'conversacion_borrada',
    summary: `Se borró la conversación con ${PERSONAS[agentId].name} (${res.changes} mensajes).`,
  });
  return { ok: true };
});

const busy = new Set<string>();

app.post<{ Params: { agentId: string }; Body: { businessId?: string; message?: string } }>(
  '/api/chat/:agentId',
  async (req, reply) => {
    const { agentId } = req.params;
    if (!isAgentId(agentId)) return notFound(reply, 'Agente');
    const business = req.body?.businessId ? getBusiness(req.body.businessId) : null;
    if (!business) return notFound(reply, 'Negocio');
    const text = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 20_000) : '';
    if (!text) return reply.code(400).send({ error: 'El mensaje está vacío.' });
    if (!config.anthropicKeyPresent)
      return reply.code(503).send({ error: 'Claude no está configurado: falta ANTHROPIC_API_KEY en el archivo .env.' });
    const key = `${business.id}:${agentId}`;
    if (busy.has(key)) return reply.code(409).send({ error: `${PERSONAS[agentId].name} todavía está respondiendo.` });
    busy.add(key);

    const persona = PERSONAS[agentId];
    const userMessageId = newId();
    db.prepare('INSERT INTO messages (id, business_id, agent_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      userMessageId,
      business.id,
      agentId,
      'user',
      text,
      now(),
    );
    const history: ChatTurn[] = loadThread(business.id, agentId, config.historyLimit).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    // La API exige que la conversación empiece con el usuario.
    while (history.length && history[0].role !== 'user') history.shift();

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    markWorking(agentId);
    let partial = '';
    try {
      const result = await streamChat({
        system: `${persona.prompt}\n\n${COMMON_RULES}\n\n${businessBrief(business)}`,
        turns: history,
        signal: abort.signal,
        onText: (d) => {
          partial += d;
          send('delta', { text: d });
        },
      });
      let content = result.text;
      if (result.stopReason === 'refusal') content ||= 'No puedo ayudar con esa solicitud.';
      if (result.stopReason === 'max_tokens') content += '\n\n_(Respuesta cortada por longitud. Pide que continúe.)_';
      const id = newId();
      const createdAt = now();
      db.prepare(
        `INSERT INTO messages (id, business_id, agent_id, role, content, model, input_tokens, output_tokens, cache_read_tokens, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        business.id,
        agentId,
        'assistant',
        content,
        result.model,
        result.inputTokens,
        result.outputTokens,
        result.cacheReadTokens,
        result.costUsd,
        createdAt,
      );
      logActivity({
        businessId: business.id,
        agentId,
        kind: 'respuesta',
        summary: `${persona.name} respondió en el chat de "${business.name}".`,
        detail: { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd },
      });
      send('done', {
        message: toMessage({
          id,
          role: 'assistant',
          content,
          model: result.model,
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          cost_usd: result.costUsd,
          created_at: createdAt,
        }),
        stopReason: result.stopReason,
      });
      markDone(agentId);
    } catch (err) {
      // Si no hubo respuesta, se retira el mensaje del usuario para no dejar la conversación incompleta.
      db.prepare('DELETE FROM messages WHERE id = ?').run(userMessageId);
      if (abort.signal.aborted) {
        markDone(agentId);
      } else {
        const { detail } = describeError(err);
        req.log.error({ err }, 'chat failed');
        logActivity({ businessId: business.id, agentId, kind: 'error', summary: `${persona.name} no pudo responder: ${detail}` });
        send('error', { error: detail, partial });
        markDone(agentId, detail);
      }
    } finally {
      busy.delete(key);
      res.end();
    }
  },
);

// ---------- Integraciones, actividad y consumo ----------

app.get('/api/integrations', async () => ({ integrations: await listIntegrations() }));
app.post('/api/integrations/claude/check', async () => ({ integrations: await listIntegrations(true) }));

app.get<{ Querystring: { agentId?: string; businessId?: string; limit?: string } }>('/api/activity', async (req) => ({
  activity: listActivity({
    agentId: req.query.agentId,
    businessId: req.query.businessId,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  }),
}));

app.get('/api/usage', async () => {
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
              COALESCE(SUM(cache_read_tokens),0) AS cacheRead, COALESCE(SUM(cost_usd),0) AS cost
       FROM messages WHERE role = 'assistant' AND created_at >= ?`,
    )
    .get(since.toISOString()) as { calls: number; input: number; output: number; cacheRead: number; cost: number };
  return { since: since.toISOString(), ...row };
});

registerCrm(app);
registerCalendar(app);
registerTasks(app);
registerVideo(app);

app.get('/api/agents', async () => ({
  agents: AGENT_IDS.map((id) => ({ id, name: PERSONAS[id].name, role: PERSONAS[id].role })),
}));

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(
    `\n  Mi Agencia IA · servidor en http://${config.host}:${config.port} · Claude: ${
      config.anthropicKeyPresent ? `clave configurada (${config.model})` : 'SIN clave (agrega ANTHROPIC_API_KEY en .env)'
    }`,
  );
  const lan = lanBanner();
  if (lan) console.log(lan);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
