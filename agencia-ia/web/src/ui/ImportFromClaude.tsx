import { useCallback, useEffect, useMemo, useState } from 'react';
import { importFolder, tasksApi, type Assignee, type Business, type ImportFolder } from '../lib/api';
import { KINDS, extractItems, importRows, markDuplicates, type ImportKind, type Row } from '../lib/claudeImport';
import { CloseIcon } from './Modal';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const btnPrimary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40';
const btnSecondary = 'rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};

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

/** Configuración y lectura de la carpeta de importación. */
function FolderSource({
  kind,
  folder,
  onFolder,
  onContent,
  prompt,
}: {
  kind: ImportKind;
  folder: ImportFolder | null;
  onFolder: (f: ImportFolder) => void;
  onContent: (content: string, label: string) => void;
  prompt: string;
}) {
  const [dir, setDir] = useState(folder?.dir ?? '');
  const [editing, setEditing] = useState(!folder?.dir);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setDir(folder?.dir ?? '');
    setEditing(!folder?.dir);
  }, [folder?.dir]);

  const names = folder?.names[kind] ?? [];
  const file = folder?.files.find((f) => f.kind === kind) ?? null;
  const sep = folder?.dir?.includes('\\') ? '\\' : '/';
  const target = folder?.dir ? `${folder.dir}${sep}${names[0]}` : names[0];
  const filePrompt = prompt.replace(
    /\n\nResponde SOLO[\s\S]*$/,
    `\n\nGuarda el resultado en el archivo "${target}" (codificación UTF-8), con SOLO el arreglo JSON, sin texto adicional. Si un dato no existe, deja el texto vacío "" en lugar de inventarlo. Si el archivo ya existe, reemplázalo.`,
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onFolder(await importFolder.setDir(dir));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await importFolder.read(kind);
      onContent(r.content, `${r.name} · guardado ${ago(r.modifiedAt)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      {editing ? (
        <div className="rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-900">Carpeta de importación</p>
          <p className="mt-0.5 text-xs text-slate-500">
            La carpeta de tu laptop donde se dejan los archivos JSON. Cópiala de la barra de direcciones del Explorador, por ejemplo{' '}
            <code className="rounded bg-slate-100 px-1">C:\1.JORGE LUIS\AUTOMATIZACION-SISTEMAS\00-IMPORTAR</code>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className={`${inputCls} min-w-[16rem] flex-1`} value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Ruta de la carpeta" />
            <button type="button" onClick={save} disabled={busy || !dir.trim()} className={btnPrimary}>
              Guardar
            </button>
            {folder?.dir && (
              <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-xs text-slate-500">
              Carpeta: <span className="break-all font-medium text-slate-700">{folder?.dir}</span>
            </p>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-indigo-600 hover:underline">
              Cambiar carpeta
            </button>
          </div>
          {!folder?.exists && <p className="mt-2 text-sm text-rose-700">La carpeta ya no existe. Revisa la ruta.</p>}
          {file ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={read} disabled={busy} className={btnPrimary}>
                {busy ? 'Leyendo…' : `Leer ${file.name}`}
              </button>
              <span className="text-xs text-slate-500">
                Guardado {ago(file.modifiedAt)} · {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Aún no hay{' '}
              {names.map((n, i) => (
                <span key={n}>
                  {i > 0 && ' ni '}
                  <strong>{n}</strong>
                </span>
              ))}{' '}
              en la carpeta.{' '}
              <button type="button" onClick={() => importFolder.config().then(onFolder).catch(() => undefined)} className="font-medium text-indigo-600 hover:underline">
                Volver a buscar
              </button>
            </p>
          )}
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {folder?.dir && (
        <details className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">Instrucción para que Claude (con acceso a tus archivos) deje el archivo listo</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{filePrompt}</pre>
          <button
            type="button"
            className={`${btnSecondary} mt-2`}
            onClick={() =>
              navigator.clipboard
                .writeText(filePrompt)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => undefined)
            }
          >
            {copied ? 'Copiada ✓' : 'Copiar instrucción'}
          </button>
        </details>
      )}
    </section>
  );
}

/**
 * Asistente de importación: desde un archivo de la carpeta de la laptop (recomendado) o copiando y pegando
 * la respuesta de Claude (respaldo). Siempre muestra una vista previa con errores y duplicados antes de guardar.
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
  const [source, setSource] = useState<'archivo' | 'pegar'>('archivo');
  const [folder, setFolder] = useState<ImportFolder | null>(null);
  const [extra, setExtra] = useState('');
  const [copied, setCopied] = useState(false);
  const [raw, setRaw] = useState('');
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [includeDupes, setIncludeDupes] = useState(false);
  const [chain, setChain] = useState(true);
  const [planName, setPlanName] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ created: number; failed: string[]; skipped: number } | null>(null);

  useEffect(() => {
    importFolder
      .config()
      .then(setFolder)
      .catch(() => setFolder({ dir: null, exists: false, files: [], names: {} as ImportFolder['names'] }));
  }, []);

  const prompt = useMemo(
    () => def.prompt(business) + (extra.trim() ? `\n\nIndicaciones adicionales: ${extra.trim()}` : ''),
    [def, business, extra],
  );
  const importable = rows?.filter((r) => !r.error && (includeDupes || !r.duplicate)) ?? [];
  const dupes = rows?.filter((r) => !r.error && r.duplicate).length ?? 0;

  const review = useCallback(
    async (text: string) => {
      setResult(null);
      const out = extractItems(text);
      if ('error' in out) {
        setRows(null);
        setParseError(out.error);
        return;
      }
      setParseError(null);
      setChecking(true);
      const normalized = out.items.map(def.normalize);
      try {
        setRows(await markDuplicates(def, business, normalized));
      } catch {
        setRows(normalized);
        setParseError('No se pudo comprobar duplicados (¿el servidor está encendido?). Revisa la lista con cuidado.');
      } finally {
        setChecking(false);
      }
    },
    [def, business],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setParseError('El navegador no permitió copiar. Selecciona el texto de la instrucción y cópialo con Ctrl + C.');
    }
  };

  const doImport = async () => {
    if (!importable.length) return;
    if (kind === 'ficha') {
      onFicha?.(importable[0].data);
      onClose();
      return;
    }
    const skipped = (rows?.length ?? 0) - importable.length;
    setBusy(true);
    setProgress(0);
    try {
      if (kind === 'tareas') {
        const r = await tasksApi.importMany(business.id, {
          name: planName.trim(),
          chain,
          tasks: importable.map((r) => r.data as { title: string; description: string; agentId: Assignee; priority: string; dueDate: string | null }),
        });
        setResult({ created: r.tasks.length, failed: [], skipped });
        onImported?.(r.tasks.length);
      } else {
        const r = await importRows(kind, business, importable, setProgress);
        setResult({ ...r, skipped });
        onImported?.(r.created);
      }
      setRows(null);
      setRaw('');
      setLoadedFrom(null);
    } catch (e) {
      setResult({ created: 0, failed: [(e as Error).message], skipped: 0 });
    } finally {
      setBusy(false);
    }
  };

  const step = (n: number, text: string) => (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs text-white">{n}</span>
      {text}
    </h3>
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Importar: ${def.title}`}
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-panel sm:max-w-3xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Importar · {def.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">Trae lo que preparaste con Claude. Gratis: no usa la API de pago.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="icon-btn -mr-2" aria-label="Cerrar">
            <CloseIcon />
          </button>
        </header>

        <div role="tablist" className="flex gap-1 border-b border-slate-200 px-4">
          {(
            [
              ['archivo', 'Desde archivo (carpeta de la laptop)'],
              ['pegar', 'Copiar y pegar'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={source === id}
              onClick={() => setSource(id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
                source === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {source === 'archivo' ? (
            folder ? (
              <FolderSource
                kind={kind}
                folder={folder}
                onFolder={setFolder}
                prompt={prompt}
                onContent={(content, label) => {
                  setRaw(content);
                  setLoadedFrom(label);
                  void review(content);
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">Consultando la carpeta…</p>
            )
          ) : (
            <>
              <section>
                {step(1, 'Copia esta instrucción y pégala en tu chat o proyecto de Claude')}
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
                </div>
              </section>
              <section>
                {step(2, 'Pega aquí la respuesta completa de Claude')}
                <textarea
                  className={`${inputCls} mt-2 font-mono text-xs`}
                  rows={7}
                  value={raw}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    setRows(null);
                    setLoadedFrom(null);
                  }}
                  placeholder={'```json\n[ { ... } ]\n```'}
                />
                <button type="button" onClick={() => review(raw)} disabled={!raw.trim() || checking} className={`${btnSecondary} mt-2`}>
                  Revisar
                </button>
              </section>
            </>
          )}

          {parseError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{parseError}</p>}
          {checking && <p className="text-sm text-slate-500">Revisando y buscando duplicados…</p>}

          {rows && (
            <section>
              {step(source === 'archivo' ? 2 : 3, 'Revisa antes de importar')}
              <p className="mt-1 text-xs text-slate-500">
                {loadedFrom && <span className="font-medium text-slate-700">{loadedFrom} · </span>}
                {importable.length} de {rows.length} se importarán para {def.agent}.
                {rows.some((r) => r.error) && ' Las filas con error no se importan.'}
              </p>
              {dupes > 0 && (
                <label className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <input type="checkbox" checked={includeDupes} onChange={(e) => setIncludeDupes(e.target.checked)} className="mt-0.5" />
                  <span>
                    <strong>{dupes} duplicado{dupes === 1 ? '' : 's'}</strong> (ya están en la app o se repiten en el archivo). Se omiten para no duplicar.
                    Marca esta casilla solo si quieres importarlos igual.
                  </span>
                </label>
              )}
              <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5 font-medium" />
                      {def.columns.map((c) => (
                        <th key={c} className="px-2 py-1.5 font-medium">
                          {c}
                        </th>
                      ))}
                      <th className="px-2 py-1.5 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r, i) => {
                      const skip = !!r.error || (!!r.duplicate && !includeDupes);
                      return (
                        <tr key={i} className={r.error ? 'bg-rose-50/60' : r.duplicate ? 'bg-amber-50/60' : ''}>
                          <td className="px-2 py-1.5 align-top">
                            {skip ? <span className="text-slate-400">–</span> : <span className="text-emerald-600">✓</span>}
                          </td>
                          {r.preview.map((v, j) => (
                            <td key={j} className={`max-w-[16rem] px-2 py-1.5 align-top ${skip ? 'text-slate-400' : 'text-slate-700'}`}>
                              <span className="line-clamp-2 whitespace-pre-line">{v || '—'}</span>
                            </td>
                          ))}
                          <td className="whitespace-nowrap px-2 py-1.5 align-top">
                            {r.error ? (
                              <span className="text-rose-700">{r.error}</span>
                            ) : r.duplicate === 'existente' ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Ya existe</span>
                            ) : r.duplicate === 'repetido' ? (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Repetido en el archivo</span>
                            ) : (
                              <span className="text-emerald-700">Nuevo</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
              {kind === 'calendario' && <p className="mt-2 text-xs text-slate-500">Se crean como borradores: luego las envías a aprobación desde el calendario.</p>}

              <button type="button" onClick={doImport} disabled={busy || !importable.length} className={`${btnPrimary} mt-3`}>
                {busy
                  ? `Importando… ${progress}/${importable.length}`
                  : kind === 'ficha'
                    ? 'Usar estos datos en la ficha'
                    : importable.length
                      ? `Importar ${importable.length}`
                      : 'Nada nuevo para importar'}
              </button>
            </section>
          )}

          {result && (
            <div className={`rounded-xl px-3 py-2 text-sm ${result.failed.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
              <p className="font-semibold">
                {result.created} importado{result.created === 1 ? '' : 's'} correctamente
                {result.skipped > 0 && ` · ${result.skipped} omitido${result.skipped === 1 ? '' : 's'} (duplicados o con error)`}.
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
