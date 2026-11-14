import { useCallback, useEffect, useState } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import { api, type Integration, type IntegrationState, type Usage } from '../lib/api';
import { Modal } from './Modal';

const STATE: Record<IntegrationState, { label: string; cls: string }> = {
  conectado: { label: 'Conectado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  desconectado: { label: 'Desconectado', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  error_autenticacion: { label: 'Error de autenticación', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  permisos_insuficientes: { label: 'Permisos insuficientes', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  error: { label: 'Error', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const usd = (n: number) => `US$ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

/** Estado real de cada integración, consultado al servidor. */
export function IntegrationsModal() {
  const openModal = useOfficeStore((s) => s.openModal);
  const [items, setItems] = useState<Integration[] | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (recheck = false) => {
    setError(null);
    setChecking(recheck);
    try {
      const [i, u] = await Promise.all([recheck ? api.recheckClaude() : api.integrations(), api.usage()]);
      setItems(i.integrations);
      setUsage(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Modal
      title="Integraciones"
      subtitle="Estado verificado por el servidor local. Las claves se guardan en el archivo .env, nunca en el navegador."
      onClose={() => openModal(null)}
      wide
    >
      <div className="space-y-3 p-5 sm:p-6">
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {!items && !error && <p className="text-sm text-slate-500">Consultando…</p>}
        {items?.map((it) => (
          <article key={it.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">{it.name}</h3>
                <p className="text-sm text-slate-600">{it.purpose}</p>
                <p className="mt-0.5 text-xs text-slate-400">Usa: {it.agents.join(', ')} · Fase {it.phase}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATE[it.state].cls}`}>{STATE[it.state].label}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{it.detail}</p>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">Requisitos y créditos</summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-slate-600">
                {it.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">{it.credits}</p>
              <a href={it.docsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline">
                Documentación oficial ↗
              </a>
            </details>

            {it.id === 'claude' && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => load(true)}
                  disabled={checking}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {checking ? 'Verificando…' : 'Verificar conexión'}
                </button>
                {usage && (
                  <p className="text-xs text-slate-500">
                    Este mes: {usage.calls} respuestas · {usage.input.toLocaleString('es-PE')} tokens de entrada ·{' '}
                    {usage.output.toLocaleString('es-PE')} de salida · gasto estimado <strong className="text-slate-700">{usd(usage.cost)}</strong>
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </Modal>
  );
}
