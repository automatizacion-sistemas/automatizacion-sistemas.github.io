import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOfficeStore, type Modal as ModalId } from '../store/useOfficeStore';
import { AGENT_BY_ID, type AgentId } from '../data/agents';
import {
  TASK_COLUMNS,
  TASK_PRIORITIES,
  tasksApi,
  type Assignee,
  type Business,
  type Flow,
  type Task,
  type TaskAction,
  type TaskEvent,
} from '../lib/api';
import { AgentAvatar } from './AgentAvatar';
import { Modal } from './Modal';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const btnPrimary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40';
const btnSecondary = 'rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

const ASSIGNEES: { id: Assignee; label: string }[] = [
  { id: 'sofia', label: 'Sofía · comercial' },
  { id: 'valeria', label: 'Valeria · audiovisual' },
  { id: 'diego', label: 'Diego · community manager' },
  { id: 'usuario', label: 'Tú' },
];
const NAME: Record<Assignee, string> = { sofia: 'Sofía', valeria: 'Valeria', diego: 'Diego', usuario: 'Tú' };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function AssigneeAvatar({ id, size = 28 }: { id: Assignee; size?: number }) {
  if (id === 'usuario')
    return (
      <span
        className="grid shrink-0 place-items-center rounded-lg bg-slate-900 font-bold text-white"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
        aria-hidden
      >
        Tú
      </span>
    );
  return <AgentAvatar agent={AGENT_BY_ID[id as AgentId]} size={size} />;
}

const statusLabel = (t: Task) =>
  t.status === 'pendiente' && t.blocked ? 'Esperando entrega' : TASK_COLUMNS.find((c) => c.id === t.status)?.label ?? t.status;

const EVENT_LABEL: Record<string, string> = {
  creada: 'Creada',
  editada: 'Editada',
  reasignada: 'Reasignada',
  start: 'Iniciada',
  entregada: 'Entrega',
  approve: 'Aprobada',
  request_changes: 'Cambios pedidos',
  reopen: 'Reabierta',
  desbloqueada: 'Desbloqueada',
};

// ------------------------------------------------------------------ Nueva tarea

function NewTask({ business, onCreated, onCancel }: { business: Business; onCreated: (tasks: Task[]) => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'flujo' | 'simple'>('flujo');
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flowId, setFlowId] = useState('video');
  const [objective, setObjective] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState<Assignee>('valeria');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tasksApi
      .flows()
      .then((r) => setFlows(r.flows))
      .catch((e) => setError((e as Error).message));
  }, []);

  const flow = flows.find((f) => f.id === flowId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (mode === 'flujo') {
        const r = await tasksApi.createFlow(business.id, { flowId, objective, dueDate: dueDate || null, priority });
        onCreated(r.tasks);
      } else {
        onCreated([await tasksApi.create(business.id, { title, description, agentId, priority, dueDate: dueDate || null })]);
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
      <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Volver al tablero
      </button>

      <div className="flex rounded-xl border border-slate-300 p-0.5 text-sm font-medium sm:w-max">
        {(
          [
            ['flujo', 'Repartir entre el equipo'],
            ['simple', 'Tarea individual'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={`flex-1 rounded-lg px-3 py-1.5 ${mode === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'flujo' ? (
        <>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">¿Qué necesitas? *</span>
            <input
              className={`${inputCls} mt-1`}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ej.: Necesito un video publicitario para promocionar mis servicios contables"
              maxLength={300}
              required
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-800">Tipo de trabajo</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {flows.map((f) => (
                <label
                  key={f.id}
                  className={`cursor-pointer rounded-2xl border p-3 text-sm transition ${
                    flowId === f.id ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input type="radio" name="flow" value={f.id} checked={flowId === f.id} onChange={() => setFlowId(f.id)} className="sr-only" />
                  <span className="block font-semibold text-slate-900">{f.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{f.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {flow && (
            <ol className="space-y-1.5 rounded-2xl bg-slate-50 p-4">
              {flow.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
                  <span className="w-5 text-right text-xs font-semibold text-slate-400">{i + 1}</span>
                  <AssigneeAvatar id={s.agentId} size={24} />
                  <span>
                    <strong className="font-semibold">{NAME[s.agentId]}</strong> · {s.title}
                  </span>
                </li>
              ))}
              <li className="pt-1 text-xs text-slate-500">
                Cada paso se habilita cuando el anterior entrega su trabajo y tú lo apruebas.
              </li>
            </ol>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-800">Título *</span>
            <input className={`${inputCls} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-slate-800">Descripción</span>
            <textarea className={`${inputCls} mt-1`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Asignar a</span>
            <select className={`${inputCls} mt-1`} value={agentId} onChange={(e) => setAgentId(e.target.value as Assignee)}>
              {ASSIGNEES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Fecha límite</span>
          <input type="date" className={`${inputCls} mt-1`} value={dueDate} min={todayIso()} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Prioridad</span>
          <select className={`${inputCls} mt-1`} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Asignando…' : mode === 'flujo' ? `Asignar ${flow?.steps.length ?? ''} tareas` : 'Asignar tarea'}
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ Detalle

function TaskDetail({
  task,
  flowTasks,
  onChanged,
  onDeleted,
  onOpen,
  onBack,
  openModal,
}: {
  task: Task;
  flowTasks: Task[];
  onChanged: (t: Task) => void;
  onDeleted: (id: string) => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  openModal: (m: ModalId) => void;
}) {
  const [events, setEvents] = useState<TaskEvent[] | null>(null);
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    agentId: task.agentId,
    priority: task.priority,
    dueDate: task.dueDate ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(() => {
    tasksApi
      .events(task.id)
      .then((r) => setEvents(r.events))
      .catch(() => undefined);
  }, [task.id]);
  useEffect(loadEvents, [loadEvents, task.updatedAt]);

  const act = async (action: TaskAction, extra: { note?: string; result?: string } = {}) => {
    setSaving(true);
    setError(null);
    try {
      onChanged(await tasksApi.action(task.id, action, extra));
      setNote('');
      setResult('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onChanged(await tasksApi.update(task.id, { ...form, dueDate: form.dueDate || null }));
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar la tarea "${task.title}"? Si era parte de un flujo, el siguiente paso pasará a depender del anterior.`)) return;
    try {
      await tasksApi.remove(task.id);
      onDeleted(task.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const shortcut: { label: string; modal: ModalId } | null =
    task.agentId === 'valeria' || /video/i.test(task.title)
      ? { label: 'Abrir estudio de video', modal: 'video' }
      : task.agentId === 'diego' || /calendario/i.test(task.description)
      ? { label: 'Abrir calendario editorial', modal: 'calendario' }
      : task.agentId === 'sofia' || /crm/i.test(task.description)
        ? { label: 'Abrir CRM', modal: 'crm' }
        : null;

  return (
    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Volver al tablero
        </button>

        {editing ? (
          <form onSubmit={save} className="space-y-3">
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <textarea className={inputCls} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-3">
              <select className={inputCls} value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value as Assignee })} aria-label="Asignar a">
                {ASSIGNEES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
              <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} aria-label="Prioridad">
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    Prioridad {p.label.toLowerCase()}
                  </option>
                ))}
              </select>
              <input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} aria-label="Fecha límite" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className={btnPrimary}>
                Guardar
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <AssigneeAvatar id={task.agentId} size={44} />
              <div className="min-w-0 flex-1">
                {task.flowName && (
                  <p className="text-xs font-medium text-indigo-600">
                    {task.flowName} · paso {task.step}
                  </p>
                )}
                <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                <p className="text-sm text-slate-500">
                  {NAME[task.agentId]} · {statusLabel(task)}
                  {task.dueDate && ` · vence ${fmtDate(task.dueDate)}`}
                  {task.priority !== 'normal' && ` · prioridad ${task.priority}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEditing(true)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  Editar
                </button>
                <button type="button" onClick={remove} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
                  Eliminar
                </button>
              </div>
            </div>
            {task.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>}
          </>
        )}

        {task.input && (
          <section className={`rounded-2xl border p-4 ${task.blocked ? 'border-amber-200 bg-amber-50/50' : 'border-emerald-200 bg-emerald-50/40'}`}>
            <p className="text-xs font-semibold text-slate-600">
              {task.blocked ? '⏳ Esperando la entrega de' : '📥 Recibido de'} {task.input.agentId ? NAME[task.input.agentId] : '—'}
              {' · '}
              <button type="button" onClick={() => onOpen(task.input!.taskId)} className="underline hover:text-slate-900">
                {task.input.title}
              </button>
            </p>
            {task.input.result ? (
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{task.input.result}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Todavía no hay entrega.</p>
            )}
          </section>
        )}

        {task.result && (
          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-600">Entrega de {NAME[task.agentId]}</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{task.result}</p>
          </section>
        )}

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        {/* Acciones según el estado real */}
        <section className="space-y-2">
          {task.status === 'pendiente' &&
            (task.blocked ? (
              <p className="text-sm text-slate-500">Esta tarea se habilita cuando se apruebe la entrega anterior.</p>
            ) : (
              <button type="button" disabled={saving} onClick={() => act('start')} className={btnPrimary}>
                Empezar tarea
              </button>
            ))}

          {task.status === 'en_curso' && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-800">Entrega *</span>
                <textarea
                  className={`${inputCls} mt-1`}
                  rows={4}
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Qué se hizo: texto, enlace al archivo, ubicación en tu PC, decisiones tomadas… Esto lo recibirá el siguiente paso."
                />
              </label>
              <button type="button" disabled={saving || !result.trim()} onClick={() => act('deliver', { result })} className={btnPrimary}>
                {task.agentId === 'usuario' ? 'Marcar como terminada' : 'Entregar para revisión'}
              </button>
            </>
          )}

          {task.status === 'en_revision' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-sm font-semibold text-slate-900">Revisa la entrega de {NAME[task.agentId]}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => act('approve')}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Aprobar y pasar al siguiente
                </button>
              </div>
              <textarea
                className={`${inputCls} mt-3`}
                rows={2}
                placeholder="¿Qué hay que cambiar?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button type="button" disabled={saving || !note.trim()} onClick={() => act('request_changes', { note })} className={`${btnSecondary} mt-2`}>
                Pedir cambios
              </button>
            </div>
          )}

          {task.status === 'terminada' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const why = window.prompt('¿Por qué se reabre? (opcional)') ?? null;
                if (why !== null) void act('reopen', { note: why });
              }}
              className={btnSecondary}
            >
              Reabrir tarea
            </button>
          )}

          {shortcut && task.status !== 'terminada' && (
            <button type="button" onClick={() => openModal(shortcut.modal)} className={`${btnSecondary} ml-0 block`}>
              {shortcut.label} ↗
            </button>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        {flowTasks.length > 1 && (
          <section className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">Pasos del flujo</p>
            <ol className="mt-2 space-y-1.5">
              {flowTasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs ${
                      t.id === task.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotFor(t)}`} />
                    <span className="truncate">
                      {t.step}. {NAME[t.agentId]} · {t.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500">Historial</p>
          <ol className="mt-2 space-y-2">
            {events?.map((e) => (
              <li key={e.id} className="text-xs">
                <span className="font-semibold text-slate-700">{EVENT_LABEL[e.kind] ?? e.kind}</span>
                <span className="text-slate-400"> · {fmtTime(e.createdAt)}</span>
                {e.note && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-slate-600">{e.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}

function dotFor(t: Task) {
  if (t.status === 'terminada') return 'bg-emerald-500';
  if (t.status === 'en_revision') return 'bg-amber-500';
  if (t.status === 'en_curso') return 'bg-sky-500';
  return t.blocked ? 'bg-slate-300' : 'bg-slate-500';
}

// ------------------------------------------------------------------ Tablero

function TaskCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const overdue = task.dueDate && task.status !== 'terminada' && task.dueDate < todayIso();
  const prio = TASK_PRIORITIES.find((p) => p.id === task.priority);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:shadow ${
        task.blocked && task.status === 'pendiente' ? 'border-dashed border-slate-300 opacity-75' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start gap-2">
        <AssigneeAvatar id={task.agentId} size={26} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-slate-900">{task.title}</p>
          {task.flowName && <p className="mt-0.5 truncate text-[11px] text-indigo-600">{task.flowName}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <span>{NAME[task.agentId]}</span>
        {task.blocked && task.status === 'pendiente' && <span className="text-slate-400">⏳ espera a {task.input?.agentId ? NAME[task.input.agentId] : 'otro paso'}</span>}
        {task.dueDate && <span className={overdue ? 'font-semibold text-rose-600' : ''}>{overdue ? 'Vencida ' : 'Vence '}{fmtDate(task.dueDate)}</span>}
        {prio && task.priority !== 'normal' && (
          <span className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${prio.dot}`} />
            {prio.label}
          </span>
        )}
      </div>
    </button>
  );
}

export function TaskBoard() {
  const modal = useOfficeStore((s) => s.modal);
  const openModal = useOfficeStore((s) => s.openModal);
  const version = useOfficeStore((s) => s.tasksVersion);
  const refreshTasks = useOfficeStore((s) => s.refreshTasks);
  const business = useOfficeStore((s) => s.businesses.find((b) => b.id === s.activeBusinessId) ?? null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [view, setView] = useState<{ kind: 'tablero' } | { kind: 'nueva' } | { kind: 'detalle'; id: string }>(() =>
    modal === 'nueva_tarea' ? { kind: 'nueva' } : { kind: 'tablero' },
  );
  const [agentFilter, setAgentFilter] = useState<Assignee | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;
    tasksApi
      .list(business.id)
      .then((r) => setTasks(r.tasks))
      .catch((e) => setError((e as Error).message));
  }, [business, version]);

  const visible = useMemo(() => (tasks ?? []).filter((t) => !agentFilter || t.agentId === agentFilter), [tasks, agentFilter]);

  if (!business)
    return (
      <Modal title="Tablero de tareas" onClose={() => openModal(null)}>
        <div className="p-6">
          <p className="text-sm text-slate-600">Primero registra un negocio: cada negocio tiene su propio tablero.</p>
          <button type="button" onClick={() => openModal('negocios')} className={`${btnPrimary} mt-3`}>
            Registrar negocio
          </button>
        </div>
      </Modal>
    );

  const current = view.kind === 'detalle' ? tasks?.find((t) => t.id === view.id) ?? null : null;
  const upsert = (t: Task) => {
    setTasks((list) => (list ?? []).map((x) => (x.id === t.id ? t : x)));
    void refreshTasks();
  };

  return (
    <Modal
      title={view.kind === 'nueva' ? 'Asignar nueva tarea' : 'Tablero de tareas'}
      subtitle={`${business.name} · los agentes se pasan el trabajo en orden y tú apruebas cada entrega`}
      onClose={() => openModal(null)}
      wide
    >
      {error && <p className="m-5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {view.kind === 'nueva' && (
        <NewTask
          business={business}
          onCancel={() => setView({ kind: 'tablero' })}
          onCreated={(created) => {
            setTasks((l) => [...(l ?? []), ...created]);
            void refreshTasks();
            setView(created.length === 1 ? { kind: 'detalle', id: created[0].id } : { kind: 'tablero' });
          }}
        />
      )}

      {view.kind === 'detalle' && current && (
        <TaskDetail
          key={current.id}
          task={current}
          flowTasks={current.flowId ? (tasks ?? []).filter((t) => t.flowId === current.flowId).sort((a, b) => a.step - b.step) : []}
          onChanged={upsert}
          onOpen={(id) => setView({ kind: 'detalle', id })}
          onBack={() => setView({ kind: 'tablero' })}
          onDeleted={(id) => {
            setTasks((l) => (l ?? []).filter((t) => t.id !== id));
            void refreshTasks();
            setView({ kind: 'tablero' });
          }}
          openModal={openModal}
        />
      )}

      {view.kind === 'tablero' && (
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {([['', 'Todos'], ...ASSIGNEES.map((a) => [a.id, NAME[a.id]])] as [Assignee | '', string][]).map(([id, label]) => (
                <button
                  key={id || 'todos'}
                  type="button"
                  aria-pressed={agentFilter === id}
                  onClick={() => setAgentFilter(id)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                    agentFilter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setView({ kind: 'nueva' })} className={`${btnPrimary} ml-auto`}>
              + Asignar nueva tarea
            </button>
          </div>

          {tasks === null && !error && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}
          {tasks?.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center">
              <p className="text-sm text-slate-600">Todavía no hay tareas. Asigna la primera y el trabajo se repartirá entre el equipo.</p>
              <button type="button" onClick={() => setView({ kind: 'nueva' })} className={`${btnPrimary} mt-3`}>
                Asignar nueva tarea
              </button>
            </div>
          )}

          {!!tasks?.length && (
            <div className="mt-4 grid gap-3 overflow-x-auto md:grid-cols-4">
              {TASK_COLUMNS.map((col) => {
                const items = visible.filter((t) => t.status === col.id);
                return (
                  <section key={col.id} className="flex min-w-0 flex-col rounded-2xl bg-slate-50 p-2.5">
                    <header className="mb-2 px-1">
                      <h3 className="flex items-center justify-between text-sm font-semibold text-slate-800">
                        {col.label}
                        <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">{col.hint}</p>
                    </header>
                    <div className="space-y-2">
                      {items.map((t) => (
                        <TaskCard key={t.id} task={t} onOpen={() => setView({ kind: 'detalle', id: t.id })} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
