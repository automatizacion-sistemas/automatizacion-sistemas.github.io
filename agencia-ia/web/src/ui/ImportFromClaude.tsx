import { useMemo, useState } from 'react';
import { tasksApi, type Assignee, type Business } from '../lib/api';
import { KINDS, extractItems, importRows, type ImportKind, type Row } from '../lib/claudeImport';
import { CloseIcon } from './Modal';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const btnPrimary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40';
const btnSecondary = 'rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

/** Botón que abre el asistente de importación. */
export function ImportButton({ onClick, label = 'Importar desde Claude' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className={`${btnSecondary} inline-flex items-center gap-1.5`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
      {label}
    </button>
  );
}

/**
 * Asistente en 3 pasos: copiar la instrucción para Claude, pegar la respuesta y revisar antes de importar.
 * Para la ficha del negocio no guarda: entrega los datos al formulario para que el usuario los revise.
 */
export function ImportFromClaude({
  kind,
  business,
  onClose,
  onImported,
  onFicha,
}: {
  kind: ImportKind;
  business: Business;
  onClose: () => void;
  onImported?: (count: number) => void;
  onFicha?: (data: Record<string, unknown>) => void;
}) {
  const def = KINDS[kind];
  const [extra, setExtra] = useState('');
  const [copied, setCopied] = useState(false);
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [chain, setChain] = useState(true);
  const [planName, setPlanName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; failed: string[] } | null>(null);

  const prompt = useMemo(
    () => def.prompt(business) + (extra.trim() ? `\n\nIndicaciones adicionales: ${extra.trim()}` : ''),
    [def, business, extra],
  );
  const validRows = rows?.filter((r) => !r.error) ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setParseError('El navegador no permitió copiar. Selecciona el texto de la instrucción y cópialo con Ctrl + C.');
    }
  };

  const review = () => {
    setResult(null);
    const out = extractItems(raw);
    if ('error' in out) {
      setRows(null);
      setParseError(out.error);
      return;
    }
    setParseError(null);
    setRows(out.items.map(def.normalize));
  };

  const doImport = async () => {
    if (!validRows.length) return;
    if (kind === 'ficha') {
      onFicha?.(validRows[0].data);
      onClose();
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      if (kind === 'tareas') {
        const r = await tasksApi.importMany(business.id, {
          name: planName.trim(),
          chain,
          tasks: validRows.map((r) => r.data as { title: string; description: string; agentId: Assignee; priority: string; dueDate: string | null }),
        });
        setResult({ created: r.tasks.length, failed: [] });
        onImported?.(r.tasks.length);
      } else {
        const r = await importRows(kind, business, validRows, setProgress);
        setResult(r);
        onImported?.(r.created);
      }
      setRows(null);
      setRaw('');
    } catch (e) {
      setResult({ created: 0, failed: [(e as Error).message] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={`Importar desde Claude: ${def.title}`} className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-panel sm:max-w-3xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Importar desde Claude · {def.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Trae lo que ya trabajaste en tu chat o proyecto de Claude. Gratis: usas tu propia cuenta de Claude, no la API.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="icon-btn -mr-2" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {/* Paso 1 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">1</span>
              Copia esta instrucción y pégala en tu chat o proyecto de Claude
            </h3>
            <label className="mt-2 block text-xs text-slate-500">
              Indicaciones adicionales (opcional)
              <input
                className={`${inputCls} mt-1`}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={kind === 'calendario' ? 'Ej.: solo diciembre, 3 publicaciones por semana' : 'Ej.: solo lo del mes de diciembre'}
              />
            </label>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-700">{prompt}</pre>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={copy} className={btnPrimary}>
                {copied ? 'Copiado ✓' : 'Copiar instrucción'}
              </button>
              <a href="https://claude.ai" target="_blank" rel="noreferrer" className={btnSecondary}>
                Abrir claude.ai ↗
              </a>
              <span className="text-xs text-slate-500">Pégala en el mismo chat o proyecto donde trabajaste, para que Claude tenga el contexto.</span>
            </div>
          </section>

          {/* Paso 2 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">2</span>
              Pega aquí la respuesta completa de Claude
            </h3>
            <textarea
              className={`${inputCls} mt-2 font-mono text-xs`}
              rows={7}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setRows(null);
              }}
              placeholder={'```json\n[ { ... } ]\n```'}
            />
            <button type="button" onClick={review} disabled={!raw.trim()} className={`${btnSecondary} mt-2`}>
              Revisar
            </button>
            {parseError && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{parseError}</p>}
          </section>

          {/* Paso 3 */}
          {rows && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">3</span>
                Revisa antes de importar
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {validRows.length} de {rows.length} listos para {def.agent}.
                {rows.length > validRows.length && ' Las filas con error no se importan; puedes corregirlas en Claude y volver a pegar.'}
              </p>
              <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 font-medium" />
                      {def.columns.map((c) => (
                        <th key={c} className="px-2 py-1.5 font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.error ? 'bg-rose-50/60' : ''}>
                        <td className="px-2 py-1.5 align-top" title={r.error ?? 'Listo'}>
                          {r.error ? <span className="text-rose-600">✕</span> : <span className="text-emerald-600">✓</span>}
                        </td>
                        {r.preview.map((v, j) => (
                          <td key={j} className="max-w-[16rem] px-2 py-1.5 align-top text-slate-700">
                            <span className="line-clamp-2">{v || '—'}</span>
                          </td>
                        ))}
                        {r.error && <td className="px-2 py-1.5 align-top text-rose-700">{r.error}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {kind === 'tareas' && (
                <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <label className="flex items-center gap-2 text-slate-700">
                    <input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} />
                    Encadenar en orden: cada tarea se habilita cuando apruebes la anterior
                  </label>
                  {chain && (
                    <input className={inputCls} value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Nombre del plan (ej.: Campaña de diciembre)" />
                  )}
                </div>
              )}
              {kind === 'calendario' && (
                <p className="mt-2 text-xs text-slate-500">Se crean como borradores: luego las envías a aprobación desde el calendario.</p>
              )}

              <button type="button" onClick={doImport} disabled={busy || !validRows.length} className={`${btnPrimary} mt-3`}>
                {busy
                  ? `Importando… ${progress}/${validRows.length}`
                  : kind === 'ficha'
                    ? 'Usar estos datos en la ficha'
                    : `Importar ${validRows.length}`}
              </button>
            </section>
          )}

          {result && (
            <div className={`rounded-xl px-3 py-2 text-sm ${result.failed.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
              <p className="font-semibold">
                {result.created} importado{result.created === 1 ? '' : 's'} correctamente.
              </p>
              {result.failed.map((f) => (
                <p key={f} className="text-xs">
                  {f}
                </p>
              ))}
              <button type="button" onClick={onClose} className="mt-2 text-xs font-semibold underline">
                Cerrar y ver
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
