import { AGENTS, STATUS_DOT, STATUS_LABEL } from '../data/agents';
import { useOfficeStore } from '../store/useOfficeStore';
import { playSound } from '../lib/sound';
import { AgentAvatar } from './AgentAvatar';

/** Barra inferior con el equipo y su estado real. */
export function AgentDock() {
  const runtime = useOfficeStore((s) => s.runtime);
  const selectedId = useOfficeStore((s) => s.selectedId);
  const select = useOfficeStore((s) => s.select);
  const hover = useOfficeStore((s) => s.hover);

  return (
    <nav
      aria-label="Equipo de agentes"
      className="glass pointer-events-auto flex items-stretch gap-1 rounded-2xl p-1.5 shadow-panel"
    >
      {AGENTS.map((agent) => {
        const r = runtime[agent.id];
        const active = selectedId === agent.id;
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => {
              const next = active ? null : agent.id;
              select(next);
              playSound(next ? 'abrir' : 'cerrar');
            }}
            onMouseEnter={() => hover(agent.id)}
            onMouseLeave={() => hover(null)}
            aria-pressed={active}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:pr-4 ${
              active ? 'bg-slate-900 text-white' : 'hover:bg-slate-900/5'
            }`}
          >
            <span className="relative">
              <AgentAvatar agent={agent} size={40} />
              <span
                className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ring-2 ring-white ${STATUS_DOT[r.status]}`}
                aria-hidden
              />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-sm font-semibold leading-tight">{agent.name}</span>
              <span className={`block text-xs leading-tight ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                {agent.role}
              </span>
            </span>
            <span className="sr-only">Estado: {STATUS_LABEL[r.status]}</span>
          </button>
        );
      })}
    </nav>
  );
}
