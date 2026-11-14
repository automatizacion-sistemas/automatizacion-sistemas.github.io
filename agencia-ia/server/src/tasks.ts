import type { FastifyInstance } from 'fastify';
import { db, newId, now } from './db.js';
import { getBusiness } from './businesses.js';
import { logActivity } from './activity.js';
import { broadcast } from './events.js';

/**
 * Tablero de tareas: sistema central donde los agentes reciben trabajo y se pasan entregas.
 * En modo gratuito el trabajo lo ejecuta el usuario; el tablero ordena quién hace qué,
 * en qué orden, y qué se entregó en cada paso.
 */

export const ASSIGNEES = ['sofia', 'valeria', 'diego', 'usuario'] as const;
export const STATUSES = ['pendiente', 'en_curso', 'en_revision', 'terminada'] as const;
export const PRIORITIES = ['alta', 'normal', 'baja'] as const;
type Assignee = (typeof ASSIGNEES)[number];
type Status = (typeof STATUSES)[number];

const NAME: Record<Assignee, string> = { sofia: 'Sofía', valeria: 'Valeria', diego: 'Diego', usuario: 'Tú' };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : null;

// ---------------------------------------------------------------- Flujos de trabajo

interface FlowStep {
  agent: Assignee;
  title: string;
  description: string;
  /** Índice del paso del que depende (por defecto, el anterior). */
  after?: number | null;
}

export const FLOWS: Record<string, { name: string; description: string; steps: FlowStep[] }> = {
  video: {
    name: 'Campaña de video',
    description: 'Sofía define el objetivo, Valeria produce, Diego prepara las publicaciones, tú apruebas y Diego publica.',
    steps: [
      {
        agent: 'sofia',
        title: 'Definir objetivo comercial y oferta',
        description: 'A quién va dirigido, qué se ofrece, llamado a la acción y cómo se atenderá a los interesados.',
        after: null,
      },
      {
        agent: 'valeria',
        title: 'Concepto, guion y video',
        description: 'Con la oferta de Sofía: concepto, guion por escenas y el video en los formatos necesarios (9:16, 16:9, 1:1).',
      },
      {
        agent: 'diego',
        title: 'Preparar publicaciones',
        description: 'Textos, títulos y hashtags por red. Crea los borradores en el Calendario editorial y envíalos a aprobación.',
      },
      {
        agent: 'usuario',
        title: 'Revisar y aprobar la campaña',
        description: 'Revisa el video y las publicaciones. Aprueba las publicaciones en el Calendario editorial.',
      },
      {
        agent: 'diego',
        title: 'Publicar o programar en cada red',
        description: 'Publica o programa con la herramienta de cada red y márcalas como programadas o publicadas en el calendario.',
      },
      {
        agent: 'sofia',
        title: 'Preparar respuestas y seguimiento de interesados',
        description: 'Respuestas a preguntas frecuentes, plantillas de WhatsApp en el CRM y registro de quienes escriban.',
        after: 3,
      },
    ],
  },
  semana: {
    name: 'Publicaciones de la semana',
    description: 'Diego planifica, tú apruebas y Diego publica.',
    steps: [
      {
        agent: 'diego',
        title: 'Planificar las publicaciones de la semana',
        description: 'Crea los borradores en el Calendario editorial y envíalos a aprobación.',
        after: null,
      },
      { agent: 'usuario', title: 'Aprobar las publicaciones', description: 'Revisa y aprueba cada publicación en el calendario.' },
      {
        agent: 'diego',
        title: 'Publicar o programar y registrar',
        description: 'Publica o programa en cada red y márcalo en el calendario con su enlace.',
      },
    ],
  },
  seguimiento: {
    name: 'Ronda de seguimiento comercial',
    description: 'Sofía prepara los mensajes, tú los revisas y envías, y Sofía registra las respuestas.',
    steps: [
      {
        agent: 'sofia',
        title: 'Preparar mensajes de seguimiento',
        description: 'Revisa en el CRM los seguimientos vencidos y de hoy, y prepara el mensaje de cada prospecto.',
        after: null,
      },
      {
        agent: 'usuario',
        title: 'Revisar y enviar los mensajes',
        description: 'Desde el CRM abre WhatsApp con cada mensaje y envíalo tú mismo.',
      },
      {
        agent: 'sofia',
        title: 'Registrar respuestas y próximos pasos',
        description: 'Anota cada respuesta como seguimiento en el CRM y actualiza el estado y la próxima fecha.',
      },
    ],
  },
};

// ---------------------------------------------------------------- Lectura

interface Row {
  id: string;
  business_id: string;
  flow_id: string | null;
  flow_name: string;
  step: number;
  title: string;
  description: string;
  agent_id: Assignee;
  status: Status;
  priority: string;
  due_date: string | null;
  depends_on: string | null;
  result: string;
  created_at: string;
  updated_at: string;
  dep_status?: Status | null;
  dep_title?: string | null;
  dep_agent?: Assignee | null;
  dep_result?: string | null;
}

const SELECT = `SELECT t.*, d.status AS dep_status, d.title AS dep_title, d.agent_id AS dep_agent, d.result AS dep_result
                FROM tasks t LEFT JOIN tasks d ON d.id = t.depends_on`;

const toTask = (r: Row) => ({
  id: r.id,
  businessId: r.business_id,
  flowId: r.flow_id,
  flowName: r.flow_name,
  step: r.step,
  title: r.title,
  description: r.description,
  agentId: r.agent_id,
  status: r.status,
  priority: r.priority,
  dueDate: r.due_date,
  dependsOn: r.depends_on,
  /** Bloqueada mientras la tarea previa no esté terminada. */
  blocked: Boolean(r.depends_on && r.dep_status !== 'terminada'),
  input: r.depends_on
    ? { taskId: r.depends_on, title: r.dep_title ?? '', agentId: r.dep_agent ?? null, status: r.dep_status ?? null, result: r.dep_result ?? '' }
    : null,
  result: r.result,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

type Task = ReturnType<typeof toTask>;

function getTask(id: string): Task | null {
  const r = db.prepare(`${SELECT} WHERE t.id = ?`).get(id) as unknown as Row | undefined;
  return r ? toTask(r) : null;
}

function addEvent(taskId: string, kind: string, note = '') {
  db.prepare('INSERT INTO task_events (id, task_id, kind, note, created_at) VALUES (?, ?, ?, ?, ?)').run(newId(), taskId, kind, note, now());
}

const agentForLog = (a: Assignee) => (a === 'usuario' ? null : a);

/** Avisa a la interfaz para que actualice bandejas y tablero. */
const changed = (businessId: string) => broadcast('tasks_changed', { businessId });

// ---------------------------------------------------------------- Rutas

export function registerTasks(app: FastifyInstance) {
  app.get('/api/tasks/flows', async () => ({
    flows: Object.entries(FLOWS).map(([id, f]) => ({
      id,
      name: f.name,
      description: f.description,
      steps: f.steps.map((s) => ({ agentId: s.agent, title: s.title })),
    })),
  }));

  app.get<{ Querystring: { businessId?: string } }>('/api/tasks', async (req, reply) => {
    const b = req.query.businessId ? getBusiness(req.query.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const rows = db
      .prepare(`${SELECT} WHERE t.business_id = ? ORDER BY COALESCE(t.due_date, '9999-12-31'), t.created_at, t.step`)
      .all(b.id) as unknown as Row[];
    return { tasks: rows.map(toTask) };
  });

  app.post<{ Body: Record<string, unknown> }>('/api/tasks', async (req, reply) => {
    const b = typeof req.body?.businessId === 'string' ? getBusiness(req.body.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const title = text(req.body.title, 200);
    if (!title) return reply.code(400).send({ error: 'La tarea necesita un título.' });
    const agent = oneOf(req.body.agentId, ASSIGNEES);
    if (!agent) return reply.code(400).send({ error: 'Elige a quién se asigna.' });
    const id = newId();
    const t = now();
    db.prepare(
      `INSERT INTO tasks (id, business_id, title, description, agent_id, priority, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      b.id,
      title,
      text(req.body.description, 6000),
      agent,
      oneOf(req.body.priority, PRIORITIES) ?? 'normal',
      typeof req.body.dueDate === 'string' && DATE.test(req.body.dueDate) ? req.body.dueDate : null,
      t,
      t,
    );
    addEvent(id, 'creada', `Asignada a ${NAME[agent]}.`);
    logActivity({ businessId: b.id, agentId: agentForLog(agent), kind: 'tarea_asignada', summary: `Nueva tarea para ${NAME[agent]}: ${title}.` });
    changed(b.id);
    return reply.code(201).send(getTask(id));
  });

  /** Crea todas las tareas de un flujo encadenadas: cada paso recibe la entrega del anterior. */
  app.post<{ Body: { businessId?: string; flowId?: string; objective?: string; dueDate?: string; priority?: string } }>(
    '/api/tasks/flow',
    async (req, reply) => {
      const b = req.body?.businessId ? getBusiness(req.body.businessId) : null;
      if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
      const flow = req.body.flowId ? FLOWS[req.body.flowId] : undefined;
      if (!flow) return reply.code(400).send({ error: 'Flujo no válido.' });
      const objective = text(req.body.objective, 300);
      if (!objective) return reply.code(400).send({ error: 'Describe el pedido (por ejemplo, "Video para promocionar mis servicios contables").' });
      const due = typeof req.body.dueDate === 'string' && DATE.test(req.body.dueDate) ? req.body.dueDate : null;
      const priority = oneOf(req.body.priority, PRIORITIES) ?? 'normal';
      const flowId = newId();
      const ids: string[] = [];
      db.exec('BEGIN');
      try {
        flow.steps.forEach((s, i) => {
          const id = newId();
          const after = s.after === undefined ? i - 1 : s.after;
          const t = now();
          db.prepare(
            `INSERT INTO tasks (id, business_id, flow_id, flow_name, step, title, description, agent_id, priority, due_date, depends_on, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            id,
            b.id,
            flowId,
            `${flow.name}: ${objective}`,
            i + 1,
            s.title,
            `Pedido: ${objective}\n\n${s.description}`,
            s.agent,
            priority,
            due,
            after !== null && after >= 0 ? ids[after] : null,
            t,
            t,
          );
          addEvent(id, 'creada', `Paso ${i + 1} de "${flow.name}". Asignada a ${NAME[s.agent]}.`);
          ids.push(id);
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      logActivity({
        businessId: b.id,
        kind: 'flujo_creado',
        summary: `Nuevo flujo "${flow.name}": ${objective}. ${flow.steps.length} tareas repartidas entre ${[...new Set(flow.steps.map((s) => NAME[s.agent]))].join(', ')}.`,
      });
      changed(b.id);
      return reply.code(201).send({ tasks: ids.map((id) => getTask(id)) });
    },
  );

  /** Importación en bloque (por ejemplo, un plan preparado en el chat de Claude). Opcionalmente encadenadas en orden. */
  app.post<{ Body: { businessId?: string; name?: string; chain?: boolean; tasks?: unknown } }>('/api/tasks/import', async (req, reply) => {
    const b = req.body?.businessId ? getBusiness(req.body.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const list = Array.isArray(req.body.tasks) ? (req.body.tasks as Record<string, unknown>[]).slice(0, 200) : [];
    const clean = list
      .map((t) => ({
        title: text(t?.title, 200),
        description: text(t?.description, 6000),
        agent: oneOf(t?.agentId, ASSIGNEES),
        priority: oneOf(t?.priority, PRIORITIES) ?? 'normal',
        due: typeof t?.dueDate === 'string' && DATE.test(t.dueDate) ? t.dueDate : null,
      }))
      .filter((t) => t.title && t.agent);
    if (!clean.length) return reply.code(400).send({ error: 'No hay tareas válidas para importar.' });
    const chain = Boolean(req.body.chain);
    const name = text(req.body.name, 200);
    const flowId = chain ? newId() : null;
    const ids: string[] = [];
    db.exec('BEGIN');
    try {
      clean.forEach((t, i) => {
        const id = newId();
        const ts = now();
        db.prepare(
          `INSERT INTO tasks (id, business_id, flow_id, flow_name, step, title, description, agent_id, priority, due_date, depends_on, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, b.id, flowId, chain ? name || 'Plan importado' : '', chain ? i + 1 : 0, t.title, t.description, t.agent, t.priority, t.due, chain && i > 0 ? ids[i - 1] : null, ts, ts);
        addEvent(id, 'creada', `Importada${chain ? ` (paso ${i + 1})` : ''}. Asignada a ${NAME[t.agent!]}.`);
        ids.push(id);
      });
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    logActivity({
      businessId: b.id,
      kind: 'tareas_importadas',
      summary: `Se importaron ${clean.length} tareas${name ? ` de "${name}"` : ''}${chain ? ' encadenadas en orden' : ''}.`,
    });
    changed(b.id);
    return reply.code(201).send({ tasks: ids.map((id) => getTask(id)) });
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/tasks/:id', async (req, reply) => {
    const task = getTask(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Tarea no encontrada.' });
    const title = text(req.body?.title, 200);
    if (!title) return reply.code(400).send({ error: 'La tarea necesita un título.' });
    const agent = oneOf(req.body?.agentId, ASSIGNEES) ?? task.agentId;
    db.prepare('UPDATE tasks SET title = ?, description = ?, agent_id = ?, priority = ?, due_date = ?, updated_at = ? WHERE id = ?').run(
      title,
      text(req.body?.description, 6000),
      agent,
      oneOf(req.body?.priority, PRIORITIES) ?? task.priority,
      typeof req.body?.dueDate === 'string' && DATE.test(req.body.dueDate) ? req.body.dueDate : null,
      now(),
      task.id,
    );
    if (agent !== task.agentId) {
      addEvent(task.id, 'reasignada', `De ${NAME[task.agentId]} a ${NAME[agent]}.`);
      logActivity({ businessId: task.businessId, agentId: agentForLog(agent), kind: 'tarea_asignada', summary: `${NAME[agent]} recibió la tarea "${title}" (antes de ${NAME[task.agentId]}).` });
    } else addEvent(task.id, 'editada');
    changed(task.businessId);
    return getTask(task.id);
  });

  app.post<{ Params: { id: string }; Body: { action?: string; note?: string; result?: string } }>('/api/tasks/:id/action', async (req, reply) => {
    const task = getTask(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Tarea no encontrada.' });
    const action = req.body?.action;
    const note = text(req.body?.note, 4000);
    const fail = (msg: string) => reply.code(409).send({ error: msg });
    let next: Status;
    let summary: string;
    const who = NAME[task.agentId];

    switch (action) {
      case 'start':
        if (task.status !== 'pendiente') return fail('Solo se puede iniciar una tarea pendiente.');
        if (task.blocked) return fail(`Espera la entrega de "${task.input?.title}".`);
        next = 'en_curso';
        summary = `${who} empezó "${task.title}".`;
        break;
      case 'deliver': {
        if (task.status !== 'en_curso') return fail('Solo se puede entregar una tarea en curso.');
        const result = text(req.body?.result, 8000);
        if (!result) return reply.code(400).send({ error: 'Describe qué se entregó (texto, enlace o ubicación del archivo).' });
        db.prepare('UPDATE tasks SET result = ? WHERE id = ?').run(result, task.id);
        // Lo que hace el usuario no necesita revisión; lo de los agentes, sí.
        next = task.agentId === 'usuario' ? 'terminada' : 'en_revision';
        summary =
          next === 'terminada' ? `Terminaste "${task.title}".` : `${who} entregó "${task.title}" y espera tu revisión.`;
        addEvent(task.id, 'entregada', result);
        break;
      }
      case 'approve':
        if (task.status !== 'en_revision') return fail('Solo se aprueba una tarea en revisión.');
        next = 'terminada';
        summary = `Aprobaste la entrega de ${who}: "${task.title}".`;
        break;
      case 'request_changes':
        if (task.status !== 'en_revision') return fail('Solo se piden cambios a una tarea en revisión.');
        if (!note) return reply.code(400).send({ error: 'Indica qué cambios hacen falta.' });
        next = 'en_curso';
        summary = `Pediste cambios a ${who} en "${task.title}": ${note.slice(0, 100)}`;
        break;
      case 'reopen':
        if (task.status !== 'terminada') return fail('Solo se reabre una tarea terminada.');
        next = 'en_curso';
        summary = `Se reabrió "${task.title}"${note ? `: ${note.slice(0, 100)}` : '.'}`;
        break;
      default:
        return reply.code(400).send({ error: 'Acción no válida.' });
    }

    db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?').run(next, now(), task.id);
    if (action !== 'deliver') addEvent(task.id, action as string, note);
    logActivity({ businessId: task.businessId, agentId: agentForLog(task.agentId), kind: `tarea_${action}`, summary });

    // Al terminar, se avisa a quien recibe la entrega.
    if (next === 'terminada') {
      const deps = db.prepare('SELECT id, agent_id, title FROM tasks WHERE depends_on = ?').all(task.id) as {
        id: string;
        agent_id: Assignee;
        title: string;
      }[];
      for (const d of deps) {
        addEvent(d.id, 'desbloqueada', `Recibió la entrega de ${who}: "${task.title}".`);
        logActivity({
          businessId: task.businessId,
          agentId: agentForLog(d.agent_id),
          kind: 'tarea_desbloqueada',
          summary: `${NAME[d.agent_id]} recibió la entrega de ${who} y ya puede empezar "${d.title}".`,
        });
      }
    }
    changed(task.businessId);
    return getTask(task.id);
  });

  app.delete<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    const task = getTask(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Tarea no encontrada.' });
    // Quien dependía de esta tarea pasa a depender de la anterior a ella (el flujo no se rompe).
    db.prepare('UPDATE tasks SET depends_on = ? WHERE depends_on = ?').run(task.dependsOn, task.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    logActivity({ businessId: task.businessId, agentId: agentForLog(task.agentId), kind: 'tarea_eliminada', summary: `Se eliminó la tarea "${task.title}".` });
    changed(task.businessId);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>('/api/tasks/:id/events', async (req, reply) => {
    if (!getTask(req.params.id)) return reply.code(404).send({ error: 'Tarea no encontrada.' });
    return {
      events: db
        .prepare('SELECT id, kind, note, created_at AS createdAt FROM task_events WHERE task_id = ? ORDER BY created_at DESC')
        .all(req.params.id),
    };
  });

  /** Bandejas reales por agente para la oficina y el centro de control. */
  app.get<{ Querystring: { businessId?: string } }>('/api/tasks/summary', async (req, reply) => {
    const b = req.query.businessId ? getBusiness(req.query.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const rows = db
      .prepare(`${SELECT} WHERE t.business_id = ?`)
      .all(b.id) as unknown as Row[];
    const empty = () => ({ pendiente: 0, bloqueada: 0, en_curso: 0, en_revision: 0, terminada: 0 });
    const byAgent = Object.fromEntries(ASSIGNEES.map((a) => [a, empty()])) as Record<Assignee, ReturnType<typeof empty>>;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let overdue = 0;
    for (const r of rows) {
      const t = toTask(r);
      const bucket = byAgent[t.agentId];
      if (t.status === 'pendiente' && t.blocked) bucket.bloqueada += 1;
      else bucket[t.status] += 1;
      if (t.status !== 'terminada' && t.dueDate && t.dueDate < today) overdue += 1;
    }
    const total = empty();
    for (const a of ASSIGNEES) for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += byAgent[a][k];
    return { byAgent, total, overdue };
  });
}
