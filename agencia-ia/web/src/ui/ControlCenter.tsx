import { useState } from 'react';
import { useOfficeStore, type Modal } from '../store/useOfficeStore';

/** Centro de control: resumen real del negocio activo. Cada cifra abre su sección. */
export function ControlCenter() {
  const tasks = useOfficeStore((s) => s.tasksSummary);
  const cal = useOfficeStore((s) => s.calendarSummary);
  const crm = useOfficeStore((s) => s.crmSummary);
  const openModal = useOfficeStore((s) => s.openModal);
  // En celular empieza plegado para no tapar la oficina.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 640);

  const items: { label: string; value: number; modal: Modal; tone?: 'warn' | 'alert' }[] = [
    { label: 'Tareas pendientes', value: (tasks?.total.pendiente ?? 0) + (tasks?.total.bloqueada ?? 0), modal: 'tareas' },
    { label: 'En curso', value: tasks?.total.en_curso ?? 0, modal: 'tareas' },
    { label: 'Por revisar', value: tasks?.total.en_revision ?? 0, modal: 'tareas', tone: 'warn' },
    { label: 'Terminadas', value: tasks?.total.terminada ?? 0, modal: 'tareas' },
    { label: 'Publicaciones por aprobar', value: cal?.byStatus.pendiente ?? 0, modal: 'calendario', tone: 'warn' },
    { label: 'Publicaciones programadas', value: cal?.byStatus.programado ?? 0, modal: 'calendario' },
    { label: 'Prospectos', value: crm?.total ?? 0, modal: 'crm' },
    { label: 'Seguimientos hoy o vencidos', value: (crm?.dueToday ?? 0) + (crm?.overdue ?? 0), modal: 'crm', tone: 'alert' },
  ];

  return (
    <section className="glass pointer-events-auto rounded-2xl p-3 shadow-panel" aria-label="Centro de control">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-1 text-left"
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Centro de control</h2>
        {!open && (
          <span className="truncate text-xs text-slate-600">
            {(tasks?.total.pendiente ?? 0) + (tasks?.total.bloqueada ?? 0) + (tasks?.total.en_curso ?? 0)} tareas ·{' '}
            {(tasks?.total.en_revision ?? 0) + (cal?.byStatus.pendiente ?? 0)} por revisar
          </span>
        )}
        <span className="text-xs text-slate-400" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {items.map((it) => {
          const highlight = it.value > 0 && it.tone;
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => openModal(it.modal)}
              className={`rounded-xl px-2.5 py-1.5 text-left transition hover:ring-1 hover:ring-slate-300 ${
                highlight === 'alert' ? 'bg-rose-50' : highlight === 'warn' ? 'bg-amber-50' : 'bg-white/70'
              }`}
            >
              <span
                className={`block text-lg font-bold leading-tight ${
                  highlight === 'alert' ? 'text-rose-700' : highlight === 'warn' ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {it.value}
              </span>
              <span className="block text-[11px] leading-tight text-slate-500">{it.label}</span>
            </button>
          );
        })}
      </div>
      )}
      {!!tasks?.overdue && (
        <button type="button" onClick={() => openModal('tareas')} className="mt-2 w-full rounded-xl bg-rose-50 px-2.5 py-1.5 text-left text-xs font-medium text-rose-700">
          {tasks.overdue} tarea{tasks.overdue === 1 ? '' : 's'} con fecha vencida
        </button>
      )}
    </section>
  );
}
