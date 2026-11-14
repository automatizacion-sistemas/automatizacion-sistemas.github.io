import { useState } from 'react';
import { OfficeScene } from './scene/OfficeScene';
import { AgentDock } from './ui/AgentDock';
import { AgentPanel } from './ui/AgentPanel';
import { BusinessLogo, BusinessManager } from './ui/BusinessManager';
import { IntegrationsModal } from './ui/IntegrationsModal';
import { useOfficeStore } from './store/useOfficeStore';
import { useServerEvents } from './lib/useServerEvents';
import { playSound } from './lib/sound';

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      {on ? <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M22 9l-6 6M16 9l6 6" />}
    </svg>
  );
}

function BusinessSwitcher() {
  const businesses = useOfficeStore((s) => s.businesses);
  const activeId = useOfficeStore((s) => s.activeBusinessId);
  const setActive = useOfficeStore((s) => s.setActiveBusiness);
  const openModal = useOfficeStore((s) => s.openModal);
  const active = businesses.find((b) => b.id === activeId) ?? null;

  if (!businesses.length)
    return (
      <button
        type="button"
        onClick={() => openModal('negocios')}
        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 sm:text-sm"
      >
        + Registrar negocio
      </button>
    );

  return (
    <div className="flex items-center gap-2">
      {active && <BusinessLogo business={active} size={32} />}
      <label className="sr-only" htmlFor="negocio-activo">
        Negocio activo
      </label>
      <select
        id="negocio-activo"
        value={activeId ?? ''}
        onChange={(e) => {
          if (e.target.value === '__gestionar') openModal('negocios');
          else void setActive(e.target.value);
        }}
        className="max-w-[9.5rem] cursor-pointer rounded-xl border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:outline-none sm:max-w-[14rem]"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
        <option value="__gestionar">Gestionar negocios…</option>
      </select>
    </div>
  );
}

export default function App() {
  useServerEvents();
  const soundOn = useOfficeStore((s) => s.soundOn);
  const toggleSound = useOfficeStore((s) => s.toggleSound);
  const resetView = useOfficeStore((s) => s.resetView);
  const selectedId = useOfficeStore((s) => s.selectedId);
  const serverOnline = useOfficeStore((s) => s.serverOnline);
  const modal = useOfficeStore((s) => s.modal);
  const openModal = useOfficeStore((s) => s.openModal);
  const businessesLoaded = useOfficeStore((s) => s.businessesLoaded);
  const hasBusinesses = useOfficeStore((s) => s.businesses.length > 0);
  const [noteOpen, setNoteOpen] = useState(true);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <OfficeScene />
      </div>

      {/* Barra superior */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-2 shadow-panel">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-sm font-extrabold text-white">IA</span>
          <div className="hidden leading-tight sm:block">
            <h1 className="text-base font-extrabold tracking-tight text-slate-900">MI AGENCIA IA</h1>
            <p className="text-xs text-slate-500">Oficina virtual · Fase 2 de 7</p>
          </div>
          <span className="hidden h-8 w-px bg-slate-200 sm:block" aria-hidden />
          <BusinessSwitcher />
        </div>
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1 shadow-panel">
          <button type="button" className="icon-btn" onClick={() => openModal('negocios')} aria-label="Negocios y clientes" title="Negocios y clientes">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" />
            </svg>
          </button>
          <button type="button" className="icon-btn" onClick={() => openModal('integraciones')} aria-label="Integraciones" title="Integraciones">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 01-12 0V7zM12 17v4" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              resetView();
              playSound('cerrar');
            }}
            aria-label="Volver a la vista general"
            title="Vista general"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const next = !soundOn;
              toggleSound();
              if (next) playSound('activar', true);
            }}
            aria-pressed={soundOn}
            aria-label={soundOn ? 'Desactivar sonidos' : 'Activar sonidos'}
            title={soundOn ? 'Sonido activado' : 'Sonido desactivado'}
          >
            <SoundIcon on={soundOn} />
          </button>
        </div>
      </header>

      {/* Avisos */}
      {!selectedId && (
        <div className="pointer-events-none absolute left-3 top-20 z-30 w-[min(320px,calc(100vw-1.5rem))] space-y-2 sm:left-4">
          {serverOnline === false && (
            <div className="pointer-events-auto rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-panel">
              <strong className="font-semibold">El servidor local no responde.</strong> Abre una terminal en la carpeta del proyecto y
              ejecuta <code className="rounded bg-white px-1">npm run dev</code>. Reintentando…
            </div>
          )}
          {serverOnline && businessesLoaded && !hasBusinesses && (
            <div className="glass pointer-events-auto rounded-2xl p-3.5 text-xs text-slate-600 shadow-panel">
              <strong className="font-semibold text-slate-800">Empieza registrando tu primer negocio.</strong> Los agentes usarán su ficha
              (servicios, público, objetivos) para trabajar.
              <button
                type="button"
                onClick={() => openModal('negocios')}
                className="mt-2 block rounded-xl bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800"
              >
                Registrar negocio
              </button>
            </div>
          )}
          {noteOpen && (
            <div className="glass pointer-events-auto rounded-2xl p-3.5 text-xs text-slate-600 shadow-panel">
              <div className="flex items-start justify-between gap-2">
                <p>
                  <strong className="font-semibold text-slate-800">Los movimientos son ilustrativos.</strong> El estado real de cada agente
                  lo informa el servidor y se ve en su etiqueta y en su panel. Haz clic en un trabajador para conversar con él.
                </p>
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="-mr-1 -mt-1 rounded-lg p-1 text-slate-400 hover:bg-slate-900/5 hover:text-slate-700"
                  aria-label="Ocultar aviso"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra del equipo */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 ${
          selectedId ? 'max-md:hidden md:justify-start' : ''
        }`}
      >
        <AgentDock />
      </div>

      <AgentPanel />
      {modal === 'negocios' && <BusinessManager />}
      {modal === 'integraciones' && <IntegrationsModal />}
    </div>
  );
}
