import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import {
  NETWORKS,
  OWNERS,
  POST_STATUSES,
  calendar,
  composePost,
  countHashtags,
  type Business,
  type NetworkId,
  type Post,
  type PostContent,
  type PostStatus,
} from '../lib/api';
import { Modal } from './Modal';
import { ImportButton, ImportFromClaude } from './ImportFromClaude';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const btnPrimary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40';
const btnSecondary = 'rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => iso(new Date());
const parse = (s: string) => new Date(`${s}T12:00:00`);
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const longDate = (s: string) => parse(s).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

const net = (id: string) => NETWORKS.find((n) => n.id === id) ?? NETWORKS[0];
const statusOf = (id: string) => POST_STATUSES.find((s) => s.id === id) ?? POST_STATUSES[0];

function NetworkDot({ id, size = 8 }: { id: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: net(id).color }} aria-hidden />;
}

function StatusBadge({ status }: { status: string }) {
  const s = statusOf(status);
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${s.cls}`}>{s.label}</span>;
}

/** Celdas del mes, empezando en lunes. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  // Quita la última semana si es entera del mes siguiente.
  return days[35].getMonth() !== month ? days.slice(0, 35) : days;
}

// ------------------------------------------------------------------ Editor

function PostEditor({
  business,
  post,
  defaultDate,
  onSaved,
  onDeleted,
  onBack,
}: {
  business: Business;
  post: Post | null;
  defaultDate: string;
  onSaved: (posts: Post[]) => void;
  onDeleted: (id: string) => void;
  onBack: () => void;
}) {
  const [c, setC] = useState<PostContent>(() =>
    post
      ? { date: post.date, time: post.time, title: post.title, body: post.body, hashtags: post.hashtags, media: post.media, owner: post.owner }
      : { date: defaultDate, time: '', title: '', body: '', hashtags: '', media: '', owner: 'diego' },
  );
  const [networks, setNetworks] = useState<NetworkId[]>(post ? [post.network] : ['instagram']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [url, setUrl] = useState(post?.postUrl ?? '');
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof PostContent>(k: K, v: PostContent[K]) => setC((x) => ({ ...x, [k]: v }));

  const dirty =
    !post ||
    c.date !== post.date ||
    c.time !== post.time ||
    c.title !== post.title ||
    c.body !== post.body ||
    c.hashtags !== post.hashtags ||
    c.media !== post.media ||
    c.owner !== post.owner ||
    networks[0] !== post.network;
  const locked = post?.status === 'publicado';
  const willNeedReapproval = !!post && dirty && (post.status === 'aprobado' || post.status === 'programado');

  const composed = composePost(c);
  const tags = countHashtags(c.hashtags);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!networks.length) return setError('Elige al menos una red social.');
    setSaving(true);
    setError(null);
    try {
      if (post) onSaved([await calendar.update(post.id, { ...c, network: networks[0] })]);
      else onSaved((await calendar.create(business.id, c, networks)).posts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const transition = async (status: PostStatus, extra: { note?: string; postUrl?: string } = {}) => {
    if (!post) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await calendar.setStatus(post.id, status, extra);
      setNote('');
      onSaved([updated]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!post || !window.confirm('¿Eliminar esta publicación del calendario? No se puede deshacer.')) return;
    try {
      await calendar.remove(post.id);
      onDeleted(post.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(composed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('El navegador no permitió copiar. Selecciona el texto y cópialo manualmente.');
    }
  };

  const n = net(networks[0] ?? 'instagram');
  const isYoutube = networks.length === 1 && networks[0] === 'youtube';

  return (
    <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_300px]">
      <form onSubmit={save} className="min-w-0 space-y-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Volver al calendario
        </button>

        <fieldset disabled={locked} className="space-y-3 disabled:opacity-70">
          <div>
            <span className="text-sm font-medium text-slate-800">{post ? 'Red social' : 'Redes sociales'}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {NETWORKS.map((nw) => {
                const on = networks.includes(nw.id);
                return (
                  <button
                    key={nw.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setNetworks((list) => (post ? [nw.id] : on ? list.filter((x) => x !== nw.id) : [...list, nw.id]))
                    }
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                      on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <NetworkDot id={nw.id} />
                    {nw.label}
                  </button>
                );
              })}
            </div>
            {!post && networks.length > 1 && (
              <p className="mt-1 text-xs text-slate-500">Se crea una publicación por red; luego puedes ajustar el texto de cada una.</p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Fecha *</span>
              <input type="date" className={`${inputCls} mt-1`} value={c.date} onChange={(e) => set('date', e.target.value)} required />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Hora</span>
              <input type="time" className={`${inputCls} mt-1`} value={c.time} onChange={(e) => set('time', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Responsable</span>
              <select className={`${inputCls} mt-1`} value={c.owner} onChange={(e) => set('owner', e.target.value)}>
                {OWNERS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Horarios sugeridos para {networks.length === 1 ? n.label : 'cada red'}:</span>{' '}
            {(networks.length === 1 ? n.hours : Array.from(new Set(networks.flatMap((id) => net(id).hours))).sort()).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => set('time', h)}
                className={`ml-1 rounded-lg px-1.5 py-0.5 font-medium ${c.time === h ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'}`}
              >
                {h}
              </button>
            ))}
            <span className="mt-1 block text-slate-400">
              Son un punto de partida general, no datos de tu cuenta. Ajústalos con las estadísticas de cada red.
            </span>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-800">{isYoutube ? 'Título del video' : 'Título interno'}</span>
            <input
              className={`${inputCls} mt-1`}
              value={c.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={200}
              placeholder={isYoutube ? 'Máximo 100 caracteres' : 'Para reconocerla en el calendario'}
            />
            {isYoutube && (
              <span className={`text-xs ${c.title.length > 100 ? 'text-rose-600' : 'text-slate-400'}`}>{c.title.length} / 100</span>
            )}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">{isYoutube ? 'Descripción' : 'Texto de la publicación'}</span>
            <textarea className={`${inputCls} mt-1`} rows={6} value={c.body} onChange={(e) => set('body', e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Hashtags</span>
            <input className={`${inputCls} mt-1`} value={c.hashtags} onChange={(e) => set('hashtags', e.target.value)} placeholder="#contabilidad #pymes" />
          </label>
          <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
            {networks.map((id) => {
              const nw = net(id);
              const over = composed.length > nw.limit || (nw.hashtagLimit !== null && tags > nw.hashtagLimit);
              return (
                <span key={id} className={over ? 'font-semibold text-rose-600' : ''}>
                  {nw.label}: {composed.length.toLocaleString('es-PE')} / {nw.limit.toLocaleString('es-PE')} caracteres
                  {nw.hashtagLimit !== null && ` · ${tags} / ${nw.hashtagLimit} hashtags`}
                </span>
              );
            })}
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-800">Material (video, imagen o carpeta)</span>
            <input
              className={`${inputCls} mt-1`}
              value={c.media}
              onChange={(e) => set('media', e.target.value)}
              placeholder="Ej.: Video planillas v2 (carpeta Drive / ruta en tu PC)"
            />
          </label>
        </fieldset>

        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {willNeedReapproval && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta publicación ya estaba {statusOf(post!.status).label.toLowerCase()}. Si guardas los cambios volverá a <strong>Pendiente de aprobación</strong>.
          </p>
        )}

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving || !dirty} className={btnPrimary}>
              {saving ? 'Guardando…' : post ? 'Guardar cambios' : networks.length > 1 ? `Crear ${networks.length} borradores` : 'Crear borrador'}
            </button>
            {post && (
              <button type="button" onClick={remove} className="rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                Eliminar
              </button>
            )}
          </div>
        )}
      </form>

      {/* Flujo de aprobación y publicación manual */}
      <aside className="space-y-3">
        {post ? (
          <>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Estado</p>
              <div className="mt-1">
                <StatusBadge status={post.status} />
              </div>
              {post.reviewNote && (
                <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                  <span className="font-semibold">Nota:</span> {post.reviewNote}
                </p>
              )}
              {post.postUrl && (
                <a href={post.postUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs font-medium text-indigo-600 hover:underline">
                  Ver publicación ↗
                </a>
              )}
            </div>

            {dirty && !locked ? (
              <p className="text-xs text-slate-500">Guarda los cambios para continuar con la aprobación.</p>
            ) : (
              <div className="space-y-2 rounded-2xl border border-slate-200 p-4">
                {post.status === 'borrador' && (
                  <button type="button" disabled={saving} onClick={() => transition('pendiente')} className={`${btnPrimary} w-full`}>
                    Enviar a aprobación
                  </button>
                )}

                {post.status === 'pendiente' && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => transition('aprobado')}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Aprobar
                    </button>
                    <textarea className={inputCls} rows={2} placeholder="¿Qué hay que corregir?" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button type="button" disabled={saving || !note.trim()} onClick={() => transition('borrador', { note })} className={`${btnSecondary} w-full`}>
                      Devolver a borrador
                    </button>
                  </>
                )}

                {(post.status === 'aprobado' || post.status === 'programado' || post.status === 'error') && (
                  <>
                    <p className="text-xs text-slate-600">
                      Publica o programa en la red con su herramienta gratuita y luego registra aquí lo que hiciste.
                    </p>
                    <button type="button" onClick={copy} className={`${btnSecondary} w-full`}>
                      {copied ? 'Texto copiado ✓' : 'Copiar texto y hashtags'}
                    </button>
                    <a href={net(post.network).studio.url} target="_blank" rel="noreferrer" className={`${btnSecondary} block w-full text-center`}>
                      Abrir {net(post.network).studio.label} ↗
                    </a>
                    {post.status === 'aprobado' && (
                      <button type="button" disabled={saving} onClick={() => transition('programado')} className={`${btnSecondary} w-full`}>
                        Ya lo programé en la red
                      </button>
                    )}
                    <input className={inputCls} placeholder="Enlace de la publicación (opcional)" value={url} onChange={(e) => setUrl(e.target.value)} />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => transition('publicado', url.trim() ? { postUrl: url.trim() } : {})}
                      className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Marcar como publicado
                    </button>
                  </>
                )}

                {(post.status === 'programado' || post.status === 'publicado') && (
                  <>
                    <textarea className={inputCls} rows={2} placeholder="¿Qué falló? (ej.: la red rechazó el video)" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button type="button" disabled={saving || !note.trim()} onClick={() => transition('error', { note })} className={`${btnSecondary} w-full text-rose-700`}>
                      Marcar con error
                    </button>
                  </>
                )}

                {post.status === 'programado' && (
                  <button type="button" disabled={saving} onClick={() => transition('aprobado')} className="w-full text-xs font-medium text-slate-500 hover:text-slate-800">
                    Quitar de programado
                  </button>
                )}
                {(post.status === 'aprobado' || post.status === 'error') && (
                  <button type="button" disabled={saving} onClick={() => transition('borrador')} className="w-full text-xs font-medium text-slate-500 hover:text-slate-800">
                    Volver a borrador
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Cómo funciona</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs">
              <li>Crea el borrador.</li>
              <li>Envíalo a aprobación y apruébalo.</li>
              <li>Copia el texto y publica o programa en la red (gratis).</li>
              <li>Marca aquí si quedó programado o publicado.</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              La app no publica por sí sola: conectar las API oficiales es opcional y requiere aprobación de cada red.
            </p>
          </div>
        )}
        {composed && (
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-500">Vista previa</p>
            {isYoutube && c.title && <p className="mt-1 text-sm font-semibold text-slate-900">{c.title}</p>}
            <p className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">{composed}</p>
          </div>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ Vista principal

function PostChip({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const s = statusOf(post.status);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={`${net(post.network).label} · ${s.label}${post.title ? ` · ${post.title}` : ''}`}
      className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium ring-1 ${s.cls} ${
        post.status === 'publicado' ? 'opacity-70' : ''
      }`}
    >
      <NetworkDot id={post.network} size={7} />
      {post.time && <span className="tabular-nums">{post.time}</span>}
      <span className="truncate">{post.title || net(post.network).label}</span>
    </button>
  );
}

export function CalendarModal() {
  const openModal = useOfficeStore((s) => s.openModal);
  const refreshSummary = useOfficeStore((s) => s.refreshCalendarSummary);
  const business = useOfficeStore((s) => s.businesses.find((b) => b.id === s.activeBusinessId) ?? null);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [mode, setMode] = useState<'mes' | 'lista'>(narrow ? 'lista' : 'mes');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [view, setView] = useState<{ kind: 'calendario' } | { kind: 'nuevo'; date: string } | { kind: 'editar'; id: string }>({
    kind: 'calendario',
  });
  const [netFilter, setNetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const from = iso(days[0]);
  const to = iso(days[days.length - 1]);

  const load = useCallback(() => {
    if (!business) return;
    calendar
      .posts(business.id, from, to)
      .then((r) => setPosts(r.posts))
      .catch((e) => setError((e as Error).message));
  }, [business, from, to]);
  useEffect(load, [load]);

  const visible = useMemo(
    () => (posts ?? []).filter((p) => (!netFilter || p.network === netFilter) && (!statusFilter || p.status === statusFilter)),
    [posts, netFilter, statusFilter],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of visible) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [visible]);

  if (!business)
    return (
      <Modal title="Calendario editorial" onClose={() => openModal(null)}>
        <div className="p-6">
          <p className="text-sm text-slate-600">Primero registra un negocio: cada negocio tiene su propio calendario.</p>
          <button type="button" onClick={() => openModal('negocios')} className={`${btnPrimary} mt-3`}>
            Registrar negocio
          </button>
        </div>
      </Modal>
    );

  const editing = view.kind === 'editar' ? posts?.find((p) => p.id === view.id) ?? null : null;
  const t = todayIso();
  const monthLabel = `${MONTHS[cursor.m]} ${cursor.y}`;
  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <Modal
      title="Calendario editorial"
      subtitle={`${business.name} · gestionado por Diego · gratuito, publicación manual con aprobación`}
      onClose={() => openModal(null)}
      wide
    >
      {error && <p className="m-5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {importing && (
        <ImportFromClaude
          kind="calendario"
          business={business}
          onClose={() => setImporting(false)}
          onImported={() => {
            load();
            void refreshSummary();
          }}
        />
      )}

      {view.kind !== 'calendario' && (view.kind === 'nuevo' || editing) ? (
        <PostEditor
          key={view.kind === 'nuevo' ? `nuevo-${view.date}` : view.id}
          business={business}
          post={editing}
          defaultDate={view.kind === 'nuevo' ? view.date : t}
          onBack={() => setView({ kind: 'calendario' })}
          onSaved={(saved) => {
            setPosts((list) => {
              const l = list ?? [];
              const ids = new Set(saved.map((p) => p.id));
              return [...l.filter((p) => !ids.has(p.id)), ...saved].sort((a, b) =>
                `${a.date}${a.time || '99:99'}`.localeCompare(`${b.date}${b.time || '99:99'}`),
              );
            });
            void refreshSummary();
            setView(saved.length === 1 ? { kind: 'editar', id: saved[0].id } : { kind: 'calendario' });
          }}
          onDeleted={(id) => {
            setPosts((l) => (l ?? []).filter((p) => p.id !== id));
            void refreshSummary();
            setView({ kind: 'calendario' });
          }}
        />
      ) : (
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shift(-1)} className="icon-btn" aria-label="Mes anterior">
                ‹
              </button>
              <h3 className="min-w-[9.5rem] text-center text-base font-bold capitalize text-slate-900">{monthLabel}</h3>
              <button type="button" onClick={() => shift(1)} className="icon-btn" aria-label="Mes siguiente">
                ›
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setCursor({ y: d.getFullYear(), m: d.getMonth() });
                }}
                className="ml-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Hoy
              </button>
            </div>
            <div className="flex rounded-xl border border-slate-300 p-0.5 text-xs font-medium">
              {(['mes', 'lista'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`rounded-lg px-2.5 py-1 capitalize ${mode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <select className={inputCls.replace('w-full', 'w-auto')} value={netFilter} onChange={(e) => setNetFilter(e.target.value)} aria-label="Filtrar por red">
              <option value="">Todas las redes</option>
              {NETWORKS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
            <select
              className={inputCls.replace('w-full', 'w-auto')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {POST_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="ml-auto flex flex-wrap gap-2">
              <ImportButton onClick={() => setImporting(true)} />
              <button type="button" onClick={() => setView({ kind: 'nuevo', date: t })} className={btnPrimary}>
                + Nueva publicación
              </button>
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {NETWORKS.map((n) => (
              <span key={n.id} className="flex items-center gap-1">
                <NetworkDot id={n.id} size={7} />
                {n.label}
              </span>
            ))}
          </div>

          {posts === null && !error && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}

          {posts !== null && mode === 'mes' && (
            <div className="mt-3 overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-7 overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 gap-px">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="bg-slate-50 px-2 py-1.5 text-center text-xs font-semibold text-slate-500">
                    {d}
                  </div>
                ))}
                {days.map((d) => {
                  const key = iso(d);
                  const inMonth = d.getMonth() === cursor.m;
                  const items = byDay.get(key) ?? [];
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setView({ kind: 'nuevo', date: key })}
                      onKeyDown={(e) => e.key === 'Enter' && setView({ kind: 'nuevo', date: key })}
                      aria-label={`Nueva publicación el ${longDate(key)}`}
                      className={`group min-h-[96px] cursor-pointer p-1.5 text-left align-top transition hover:bg-indigo-50/40 ${
                        inMonth ? 'bg-white' : 'bg-slate-50/80'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                            key === t ? 'bg-slate-900 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {d.getDate()}
                        </span>
                        <span className="text-xs font-bold text-slate-300 opacity-0 group-hover:opacity-100">+</span>
                      </div>
                      <div className="space-y-0.5">
                        {items.slice(0, 4).map((p) => (
                          <PostChip key={p.id} post={p} onOpen={() => setView({ kind: 'editar', id: p.id })} />
                        ))}
                        {items.length > 4 && <p className="px-1 text-[11px] text-slate-500">+{items.length - 4} más</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {posts !== null && mode === 'lista' && (
            <div className="mt-4 space-y-4">
              {visible.length === 0 && <p className="text-sm text-slate-500">No hay publicaciones en {monthLabel}.</p>}
              {[...byDay.entries()].map(([day, items]) => (
                <section key={day}>
                  <h4 className={`text-xs font-semibold uppercase tracking-wide ${day === t ? 'text-slate-900' : 'text-slate-500'}`}>
                    {longDate(day)}
                    {day === t && ' · hoy'}
                  </h4>
                  <ul className="mt-1.5 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {items.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setView({ kind: 'editar', id: p.id })}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                        >
                          <span className="w-11 shrink-0 text-sm tabular-nums text-slate-500">{p.time || '—'}</span>
                          <NetworkDot id={p.network} size={10} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">{p.title || net(p.network).label}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {net(p.network).label} · {OWNERS.find((o) => o.id === p.owner)?.label ?? p.owner}
                            </span>
                          </span>
                          <StatusBadge status={p.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
