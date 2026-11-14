import { useState } from 'react';
import { OfficeScene } from './scene/OfficeScene';
import { AgentDock } from './ui/AgentDock';
import { AgentPanel } from './ui/AgentPanel';
import { useOfficeStore } from './store/useOfficeStore';
import { playSound } from './lib/sound';

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      {on ? <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M22 9l-6 6M16 9l6 6" />}
    </svg>
  );
}

export default function App() {
  const soundOn = useOfficeStore((s) => s.soundOn);
  const toggleSound = useOfficeStore((s) => s.toggleSound);
  const resetView = useOfficeStore((s) => s.resetView);
  const selectedId = useOfficeStore((s) => s.selectedId);
  const [noteOpen, setNoteOpen] = useState(true);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <OfficeScene />
      </div>

      {/* Barra superior */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="glass pointer-events-auto flex items-center gap-3 rounded-2xl px-3 py-2 shadow-panel">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-sm font-extrabold text-white">IA</span>
          <div className="leading-tight">
            <h1 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">MI AGENCIA IA</h1>
            <p className="text-[11px] text-slate-500 sm:text-xs">Oficina virtual · Fase 1 de 7</p>
          </div>
        </div>
        <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1 shadow-panel">
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

      {/* Aviso: animación frente a estado real */}
      {noteOpen && !selectedId && (
        <div className="pointer-events-none absolute left-3 top-20 z-30 max-w-[300px] sm:left-4">
          <div className="glass pointer-events-auto rounded-2xl p-3.5 text-xs text-slate-600 shadow-panel">
            <div className="flex items-start justify-between gap-2">
              <p>
                <strong className="font-semibold text-slate-800">Los movimientos son ilustrativos.</strong> El estado real de
                cada agente se muestra en su etiqueta y en su panel. Haz clic en un trabajador para abrir su ficha.
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
    </div>
  );
}
