import { useEffect, useRef, useState } from 'react';
import { AGENT_BY_ID, STATUS_DOT, STATUS_LABEL, type AgentDefinition } from '../data/agents';
import { useOfficeStore } from '../store/useOfficeStore';
import { api, type ActivityEntry } from '../lib/api';
import { playSound } from '../lib/sound';
import { AgentAvatar } from './AgentAvatar';
import { AgentChat } from './AgentChat';
import { CloseIcon } from './Modal';

const PHASE_NAME: Record<number, string> = {
  3: 'Fase 3 · Sistema de tareas',
  4: 'Fase 4 · Generación y edición de video',
  5: 'Fase 5 · Calendario y publicación',
  6: 'Fase 6 · CRM comercial',
};

type Tab = 'crm' | 'chat' | 'ficha' | 'actividad';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 px-5 py-4 first:border-t-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Profile({ agent }: { agent: AgentDefinition }) {
  const runtime = useOfficeStore((s) => s.runtime[agent.id]);
  return (
    <div className="flex-1 overflow-y-auto pb-4">
      <Section title="Bandeja de tareas">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Pendientes', runtime.pendingTasks],
            ['En ejecución', runtime.runningTasks],
            ['Terminadas', runtime.doneTasks],
          ].map(([label, n]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-2 py-2.5">
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className="text-xl font-bold text-slate-900">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-slate-600">
          El tablero de tareas y la coordinación entre agentes se construyen en una próxima etapa (gratuita).
        </p>
      </Section>
      <Section title="Especialidad">
        <p className="text-sm text-slate-700">{agent.specialty}</p>
        <p className="mt-2 text-sm italic text-slate-500">{agent.personality}</p>
      </Section>
      <Section title="Funciones">
        <ul className="space-y-1.5">
          {agent.functions.map((f) => (
            <li key={f} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: agent.look.shirt }} />
              {f}
            </li>
          ))}
        </ul>
        {agent.id !== 'sofia' && (
          <p className="mt-3 text-xs text-slate-500">
            Herramientas propias a partir de: {PHASE_NAME[agent.activeFromPhase] ?? `Fase ${agent.activeFromPhase}`}
          </p>
        )}
      </Section>
      <Section title="Integraciones que usará">
        <ul className="flex flex-wrap gap-1.5">
          {agent.integrations.map((i) => (
            <li key={i} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600">
              {i}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function CrmTab() {
  const summary = useOfficeStore((s) => s.crmSummary);
  const hasBusiness = useOfficeStore((s) => Boolean(s.activeBusinessId));
  const openModal = useOfficeStore((s) => s.openModal);
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <p className="text-sm text-slate-600">
        Sofía lleva tu cartera de prospectos, seguimientos y mensajes de WhatsApp. Funciona gratis y los datos quedan en tu computadora.
      </p>
      {hasBusiness && summary && (
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {[
            ['Prospectos', summary.total, 'text-slate-900'],
            ['Vencidos', summary.overdue, summary.overdue ? 'text-rose-700' : 'text-slate-900'],
            ['Para hoy', summary.dueToday, summary.dueToday ? 'text-amber-700' : 'text-slate-900'],
            ['Ganados', summary.byStage.ganado, 'text-emerald-700'],
          ].map(([label, n, cls]) => (
            <div key={label as string} className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className={`text-xl font-bold ${cls}`}>{n}</dd>
            </div>
          ))}
        </dl>
      )}
      <button
        type="button"
        onClick={() => openModal(hasBusiness ? 'crm' : 'negocios')}
        className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        {hasBusiness ? 'Abrir CRM' : 'Registrar un negocio'}
      </button>
    </div>
  );
}

function AiOff({ agent }: { agent: AgentDefinition }) {
  const openModal = useOfficeStore((s) => s.openModal);
  return (
    <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-600">
      <p>
        <strong className="text-slate-800">El asistente con IA es opcional y de pago.</strong> Para que {agent.name} redacte por ti se
        necesita una clave de la API de Claude con saldo (aprox. US$ 0.01–0.05 por respuesta).
      </p>
      <p className="mt-2">Todo lo demás de la oficina funciona gratis sin esta función.</p>
      <button type="button" onClick={() => openModal('integraciones')} className="mt-3 rounded-xl border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
        Ver cómo activarlo
      </button>
    </div>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function Activity({ agent }: { agent: AgentDefinition }) {
  const businessId = useOfficeStore((s) => s.activeBusinessId);
  const last = useOfficeStore((s) => s.lastActivity);
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .activity({ agentId: agent.id, businessId: businessId ?? undefined, limit: 50 })
      .then((r) => !cancelled && setItems(r.activity))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [agent.id, businessId, last?.agentId === agent.id ? last.id : null]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {items?.length === 0 && <p className="text-sm text-slate-500">Sin actividad registrada.</p>}
      <ol className="space-y-2">
        {items?.map((a) => (
          <li key={a.id} className="rounded-xl border border-slate-100 px-3 py-2">
            <p className={`text-sm ${a.kind === 'error' ? 'text-rose-700' : 'text-slate-700'}`}>{a.summary}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{fmt(a.createdAt)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Panel lateral (escritorio) u hoja inferior (celular) del agente seleccionado. */
export function AgentPanel() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const runtime = useOfficeStore((s) => (s.selectedId ? s.runtime[s.selectedId] : null));
  const business = useOfficeStore((s) => s.businesses.find((b) => b.id === s.activeBusinessId) ?? null);
  const select = useOfficeStore((s) => s.select);
  const openModal = useOfficeStore((s) => s.openModal);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const aiEnabled = useOfficeStore((s) => s.aiEnabled);
  const [tab, setTab] = useState<Tab>('ficha');
  useEffect(() => {
    if (selectedId) setTab(selectedId === 'sofia' ? 'crm' : aiEnabled ? 'chat' : 'ficha');
  }, [selectedId, aiEnabled]);

  const close = () => {
    select(null);
    playSound('cerrar');
  };

  useEffect(() => {
    if (!selectedId) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !useOfficeStore.getState().modal) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!selectedId || !runtime) return null;
  const agent = AGENT_BY_ID[selectedId];

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="agent-panel-title"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex h-[70vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-panel
        md:inset-x-auto md:bottom-4 md:right-4 md:top-20 md:h-auto md:w-[440px] md:rounded-3xl"
    >
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" aria-hidden />
      <header className="flex items-start gap-3 px-5 pb-3 pt-3 md:pt-5">
        <AgentAvatar agent={agent} size={52} />
        <div className="min-w-0 flex-1">
          <h2 id="agent-panel-title" className="text-lg font-bold leading-tight text-slate-900">
            {agent.name}
          </h2>
          <p className="text-sm text-slate-600">{agent.role}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[runtime.status]}`} aria-hidden />
            Estado real: {runtime.status === 'trabajando' ? 'Respondiendo' : STATUS_LABEL[runtime.status]}
          </p>
          {runtime.status === 'error' && runtime.lastError && (
            <p className="mt-1 text-xs text-rose-600">{runtime.lastError}</p>
          )}
        </div>
        <button ref={closeBtn} type="button" onClick={close} className="icon-btn -mr-2 -mt-1" aria-label="Cerrar panel">
          <CloseIcon />
        </button>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-slate-200 px-4">
        {(
          [
            ...(agent.id === 'sofia' ? [['crm', 'CRM']] : []),
            ['ficha', 'Ficha'],
            ['actividad', 'Actividad'],
            ['chat', aiEnabled ? 'Chat IA' : 'IA (opcional)'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'crm' && <CrmTab />}
      {tab === 'chat' && !aiEnabled && <AiOff agent={agent} />}
      {tab === 'chat' &&
        aiEnabled &&
        (business ? (
          <AgentChat agent={agent} business={business} />
        ) : (
          <div className="flex-1 p-5">
            <p className="text-sm text-slate-600">
              Para conversar con {agent.name} primero registra un negocio: así sabrá para quién trabaja y no se mezclarán los clientes.
            </p>
            <button
              type="button"
              onClick={() => openModal('negocios')}
              className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Registrar un negocio
            </button>
          </div>
        ))}
      {tab === 'ficha' && <Profile agent={agent} />}
      {tab === 'actividad' && <Activity agent={agent} />}
    </aside>
  );
}
