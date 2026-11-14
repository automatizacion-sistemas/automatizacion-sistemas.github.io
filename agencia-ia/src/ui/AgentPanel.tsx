import { useEffect, useRef } from 'react';
import { AGENT_BY_ID, STATUS_DOT, STATUS_LABEL } from '../data/agents';
import { useOfficeStore } from '../store/useOfficeStore';
import { playSound } from '../lib/sound';
import { AgentAvatar } from './AgentAvatar';

const PHASE_NAME: Record<number, string> = {
  2: 'Fase 2 · Agentes y paneles',
  3: 'Fase 3 · Sistema de tareas',
  4: 'Fase 4 · Generación y edición de video',
  5: 'Fase 5 · Calendario y publicación',
  6: 'Fase 6 · CRM comercial',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

/** Panel lateral (escritorio) u hoja inferior (celular) con la ficha del agente. */
export function AgentPanel() {
  const selectedId = useOfficeStore((s) => s.selectedId);
  const runtime = useOfficeStore((s) => (s.selectedId ? s.runtime[s.selectedId] : null));
  const select = useOfficeStore((s) => s.select);
  const closeBtn = useRef<HTMLButtonElement>(null);

  const close = () => {
    select(null);
    playSound('cerrar');
  };

  useEffect(() => {
    if (!selectedId) return;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
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
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[62vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-panel
        md:inset-x-auto md:bottom-4 md:right-4 md:top-20 md:max-h-none md:w-[400px] md:rounded-3xl"
    >
      <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" aria-hidden />
      <header className="flex items-start gap-3 px-5 pb-4 pt-3 md:pt-5">
        <AgentAvatar agent={agent} size={56} />
        <div className="min-w-0 flex-1">
          <h2 id="agent-panel-title" className="text-lg font-bold leading-tight text-slate-900">
            {agent.name}
          </h2>
          <p className="text-sm text-slate-600">{agent.role}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[runtime.status]}`} aria-hidden />
            Estado real: {STATUS_LABEL[runtime.status]}
          </p>
        </div>
        <button ref={closeBtn} type="button" onClick={close} className="icon-btn -mr-2 -mt-1" aria-label="Cerrar panel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

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
            Aún no hay tareas. La asignación de tareas y la coordinación entre agentes se habilitan en la{' '}
            <strong className="font-semibold text-slate-800">Fase 3</strong>.
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
          <p className="mt-3 text-xs text-slate-500">
            Trabajo real a partir de: {PHASE_NAME[agent.activeFromPhase] ?? `Fase ${agent.activeFromPhase}`}
          </p>
        </Section>

        <Section title="Integraciones que usará">
          <ul className="flex flex-wrap gap-1.5">
            {agent.integrations.map((i) => (
              <li key={i} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600">
                {i} · <span className="text-slate-400">sin configurar</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">La configuración de credenciales llega en la Fase 2.</p>
        </Section>

        <Section title="Historial de actividades">
          <p className="text-sm text-slate-500">Sin actividad registrada.</p>
        </Section>
      </div>
    </aside>
  );
}
