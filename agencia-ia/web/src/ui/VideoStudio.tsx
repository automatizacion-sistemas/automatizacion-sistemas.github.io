import { useCallback, useEffect, useRef, useState } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import {
  VIDEO_FORMATS,
  video,
  type Business,
  type ProjectSettings,
  type Subtitle,
  type VideoClip,
  type VideoFormat,
  type VideoProject,
  type VideoProjectSummary,
  type VideoRender,
} from '../lib/api';
import { Modal } from './Modal';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const btnPrimary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40';
const btnSecondary = 'rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';
const numCls = 'w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-indigo-500 focus:outline-none';

const secs = (n: number) => {
  const m = Math.floor(n / 60);
  const s = n - m * 60;
  return m ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)} s`;
};
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ Línea de tiempo

function ClipRow({
  clip,
  index,
  count,
  onChange,
  onMove,
  onRemove,
  onPreview,
}: {
  clip: VideoClip;
  index: number;
  count: number;
  onChange: (c: { trimStart?: number; trimEnd?: number | null; imageDuration?: number }) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const [start, setStart] = useState(clip.trimStart.toFixed(1));
  const [end, setEnd] = useState((clip.trimEnd ?? clip.duration).toFixed(1));
  const [img, setImg] = useState(clip.imageDuration.toFixed(1));
  useEffect(() => {
    setStart(clip.trimStart.toFixed(1));
    setEnd((clip.trimEnd ?? clip.duration).toFixed(1));
    setImg(clip.imageDuration.toFixed(1));
  }, [clip.trimStart, clip.trimEnd, clip.duration, clip.imageDuration]);

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
      <span className="w-5 text-center text-xs font-semibold text-slate-400">{index + 1}</span>
      <button type="button" onClick={onPreview} className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-900" title="Ver">
        {clip.kind === 'imagen' ? (
          <img src={clip.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={`${clip.url}#t=${Math.max(0.1, clip.trimStart)}`} preload="metadata" muted className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">{secs(clip.length)}</span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{clip.name}</p>
        <p className="text-[11px] text-slate-500">
          {clip.kind === 'imagen' ? 'Imagen' : `Video · ${secs(clip.duration)}`} · {clip.width}×{clip.height}
          {clip.kind === 'video' && !clip.hasAudio && ' · sin sonido'}
        </p>
      </div>
      {clip.kind === 'video' ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <label className="flex items-center gap-1">
            Desde
            <input
              className={numCls}
              type="number"
              step="0.1"
              min={0}
              max={clip.duration}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onBlur={() => Number(start) !== clip.trimStart && onChange({ trimStart: Number(start) })}
            />
          </label>
          <label className="flex items-center gap-1">
            hasta
            <input
              className={numCls}
              type="number"
              step="0.1"
              min={0}
              max={clip.duration}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={() => Number(end) !== (clip.trimEnd ?? clip.duration) && onChange({ trimEnd: Number(end) })}
            />
          </label>
        </div>
      ) : (
        <label className="flex items-center gap-1 text-xs text-slate-500">
          Duración
          <input
            className={numCls}
            type="number"
            step="0.5"
            min={0.5}
            max={60}
            value={img}
            onChange={(e) => setImg(e.target.value)}
            onBlur={() => Number(img) !== clip.imageDuration && onChange({ imageDuration: Number(img) })}
          />
          s
        </label>
      )}
      <div className="flex items-center gap-0.5">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="icon-btn h-8 w-8 disabled:opacity-30" aria-label="Subir">
          ↑
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => onMove(1)} className="icon-btn h-8 w-8 disabled:opacity-30" aria-label="Bajar">
          ↓
        </button>
        <button type="button" onClick={onRemove} className="icon-btn h-8 w-8 text-rose-600" aria-label="Quitar">
          ✕
        </button>
      </div>
    </li>
  );
}

// ------------------------------------------------------------------ Subtítulos

function Subtitles({ project, onSaved }: { project: VideoProject; onSaved: (p: VideoProject) => void }) {
  const [rows, setRows] = useState<Subtitle[]>(project.subtitles);
  const [script, setScript] = useState('');
  const [showScript, setShowScript] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(rows.map(({ start, end, text }) => ({ start, end, text }))) !==
    JSON.stringify(project.subtitles.map(({ start, end, text }) => ({ start, end, text })));

  const set = (i: number, patch: Partial<Subtitle>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => {
    const last = rows[rows.length - 1];
    const start = last ? last.end + 0.2 : 0.3;
    setRows([...rows, { start: Math.round(start * 10) / 10, end: Math.round(Math.min(start + 3, Math.max(start + 1, project.totalDuration)) * 10) / 10, text: '' }]);
  };

  /** Reparte las frases del guion a lo largo del video, en proporción a su largo. */
  const distribute = () => {
    const lines = script
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length || project.totalDuration <= 0) return;
    const total = project.totalDuration;
    const weights = lines.map((l) => Math.max(8, l.length));
    const sum = weights.reduce((a, b) => a + b, 0);
    let t = 0.2;
    const usable = total - 0.4;
    setRows(
      lines.map((text, i) => {
        const d = (weights[i] / sum) * usable;
        const row = { start: Math.round(t * 10) / 10, end: Math.round((t + d - 0.15) * 10) / 10, text };
        t += d;
        return row;
      }),
    );
    setShowScript(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const p = await video.saveSubtitles(project.id, rows.filter((r) => r.text.trim()));
      onSaved(p);
      setRows(p.subtitles);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-slate-500">Sin subtítulos. Agrégalos uno por uno o pega el guion.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            className={numCls}
            type="number"
            step="0.1"
            min={0}
            value={r.start}
            onChange={(e) => set(i, { start: Number(e.target.value) })}
            aria-label="Inicio (segundos)"
          />
          <span className="text-xs text-slate-400">→</span>
          <input className={numCls} type="number" step="0.1" min={0} value={r.end} onChange={(e) => set(i, { end: Number(e.target.value) })} aria-label="Fin (segundos)" />
          <input className={`${inputCls} min-w-[12rem] flex-1`} value={r.text} onChange={(e) => set(i, { text: e.target.value })} maxLength={300} placeholder="Texto en pantalla" />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="icon-btn h-8 w-8 text-rose-600" aria-label="Quitar subtítulo">
            ✕
          </button>
        </div>
      ))}
      {showScript && (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <textarea
            className={inputCls}
            rows={5}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={'Una frase por línea. Ej.:\n¿Tus planillas te quitan tiempo?\nNosotros las preparamos cada mes\nEscríbenos por WhatsApp'}
          />
          <p className="text-xs text-slate-500">Se reparten a lo largo de los {secs(project.totalDuration)} del video. Luego puedes ajustar los tiempos.</p>
          <button type="button" onClick={distribute} disabled={!script.trim() || project.totalDuration <= 0} className={btnSecondary}>
            Repartir en el video
          </button>
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" onClick={add} className={btnSecondary}>
          + Subtítulo
        </button>
        <button type="button" onClick={() => setShowScript((s) => !s)} className={btnSecondary}>
          Pegar guion
        </button>
        <button type="button" onClick={save} disabled={saving || !dirty} className={btnPrimary}>
          {saving ? 'Guardando…' : saved ? 'Guardado ✓' : 'Guardar subtítulos'}
        </button>
        {project.subtitles.length > 0 && (
          <a href={video.srtUrl(project.id)} className="text-xs font-medium text-indigo-600 hover:underline">
            Descargar .srt
          </a>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Exportaciones

function RenderRow({ r, onCancel, onRemove }: { r: VideoRender; onCancel: () => void; onRemove: () => void }) {
  const active = r.status === 'en_cola' || r.status === 'procesando';
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{r.formatLabel}</span>
        <span className="text-xs text-slate-500">{r.quality === 'borrador' ? 'borrador 720p' : 'final 1080p'}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            r.status === 'listo'
              ? 'bg-emerald-50 text-emerald-700'
              : r.status === 'error'
                ? 'bg-rose-50 text-rose-700'
                : r.status === 'cancelado'
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-sky-50 text-sky-700'
          }`}
        >
          {{ en_cola: 'En cola', procesando: 'Procesando', listo: 'Listo', error: 'Error', cancelado: 'Cancelado' }[r.status]}
        </span>
        <span className="ml-auto flex gap-1">
          {r.status === 'listo' && r.url && (
            <>
              <a href={r.url} target="_blank" rel="noreferrer" className={btnSecondary}>
                Ver
              </a>
              <a href={r.url} download className={btnSecondary}>
                Descargar{r.size ? ` (${mb(r.size)})` : ''}
              </a>
            </>
          )}
          {active ? (
            <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          ) : (
            <button type="button" onClick={onRemove} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
              Eliminar
            </button>
          )}
        </span>
      </div>
      {active && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.max(3, r.progress * 100)}%` }} />
        </div>
      )}
      {r.error && <p className="mt-1.5 text-xs text-rose-700">{r.error}</p>}
    </li>
  );
}

// ------------------------------------------------------------------ Editor

function Editor({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const lastRender = useOfficeStore((s) => s.lastRender);
  const [p, setP] = useState<VideoProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);
  const [preview, setPreview] = useState<VideoClip | null>(null);
  const [formats, setFormats] = useState<VideoFormat[]>(['vertical']);
  const [quality, setQuality] = useState<'borrador' | 'final'>('final');
  const [clipVol, setClipVol] = useState(1);
  const [musicVol, setMusicVol] = useState(0.35);
  const [name, setName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);

  const apply = useCallback((proj: VideoProject) => {
    setP(proj);
    setClipVol(proj.clipVolume);
    setMusicVol(proj.musicVolume);
    setName(proj.name);
  }, []);

  useEffect(() => {
    video
      .get(projectId)
      .then(apply)
      .catch((e) => setError((e as Error).message));
  }, [projectId, apply]);

  // Avance de exportación en vivo.
  useEffect(() => {
    if (!lastRender || lastRender.projectId !== projectId) return;
    setP((cur) => {
      if (!cur) return cur;
      const exists = cur.renders.some((r) => r.id === lastRender.render.id);
      return {
        ...cur,
        renders: exists ? cur.renders.map((r) => (r.id === lastRender.render.id ? lastRender.render : r)) : [lastRender.render, ...cur.renders],
      };
    });
  }, [lastRender, projectId]);

  const call = async (fn: () => Promise<VideoProject>) => {
    setError(null);
    try {
      apply(await fn());
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = (s: Partial<ProjectSettings>) => call(() => video.update(projectId, s));

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploads(list.map((f) => ({ name: f.name, progress: 0 })));
    for (const [i, f] of list.entries()) {
      try {
        apply(await video.addClip(projectId, f, (pr) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: pr } : x)))));
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
    setUploads([]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!p) return;
    const ids = p.clips.map((c) => c.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    void call(() => video.order(projectId, ids));
  };

  if (!p)
    return (
      <div className="p-6">
        {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : <p className="text-sm text-slate-500">Cargando…</p>}
      </div>
    );

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Proyectos
        </button>
        <input
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-lg font-bold text-slate-900 hover:border-slate-200 focus:border-indigo-500 focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== p.name && save({ name })}
          aria-label="Nombre del proyecto"
        />
        <span className="text-sm text-slate-500">Duración total: {secs(p.totalDuration)}</span>
      </div>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <Section title="1. Clips e imágenes" hint="Se reproducen en este orden. Recorta cada clip con los segundos de inicio y fin.">
        {p.clips.length > 0 && (
          <ol className="space-y-2">
            {p.clips.map((c, i) => (
              <ClipRow
                key={c.id}
                clip={c}
                index={i}
                count={p.clips.length}
                onChange={(patch) => call(() => video.updateClip(c.id, patch))}
                onMove={(d) => move(i, d)}
                onPreview={() => setPreview(c)}
                onRemove={() => window.confirm(`¿Quitar "${c.name}" del proyecto? Se borra el archivo subido.`) && call(() => video.removeClip(c.id))}
              />
            ))}
          </ol>
        )}
        {uploads.map((u) => (
          <div key={u.name} className="mt-2 text-xs text-slate-600">
            Subiendo {u.name}… {Math.round(u.progress * 100)} %
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-indigo-500" style={{ width: `${u.progress * 100}%` }} />
            </div>
          </div>
        ))}
        <label className={`${btnSecondary} mt-3 inline-flex cursor-pointer`}>
          + Agregar clips o imágenes
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mkv,.mov,.m4v,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
            disabled={uploads.length > 0}
          />
        </label>
        <p className="mt-1 text-xs text-slate-400">MP4, MOV, WEBM, MKV, JPG, PNG o WEBP · hasta 1 GB por archivo · se guardan en tu computadora</p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="2. Encuadre" hint="Cómo se adapta cada clip al formato de salida.">
          <div className="space-y-2">
            {(
              [
                ['difuminado', 'Fondo difuminado', 'Muestra todo el clip con su propio fondo borroso. Ideal para pasar horizontal a vertical.'],
                ['rellenar', 'Rellenar (recortar)', 'Llena toda la pantalla recortando los bordes.'],
                ['ajustar', 'Ajustar con color', 'Muestra todo el clip con barras del color elegido.'],
              ] as const
            ).map(([id, label, hint]) => (
              <label key={id} className="flex cursor-pointer gap-2 text-sm">
                <input type="radio" name="fit" checked={p.fit === id} onChange={() => save({ fit: id })} className="mt-1" />
                <span>
                  <span className="font-medium text-slate-800">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
            {p.fit === 'ajustar' && (
              <label className="flex items-center gap-2 pl-6 text-sm text-slate-600">
                Color de las barras
                <input type="color" value={p.bgColor} onChange={(e) => save({ bgColor: e.target.value })} className="h-7 w-10 cursor-pointer rounded border-0 p-0" />
              </label>
            )}
            <label className="flex items-center gap-2 pt-1 text-sm text-slate-700">
              <input type="checkbox" checked={p.fades} onChange={(e) => save({ fades: e.target.checked })} />
              Fundido suave al inicio y al final
            </label>
          </div>
        </Section>

        <Section title="3. Sonido y música" hint="Usa música propia o con licencia libre para redes.">
          <label className="block text-sm text-slate-700">
            Volumen del sonido de los clips: <strong>{Math.round(clipVol * 100)} %</strong>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={clipVol}
              onChange={(e) => setClipVol(Number(e.target.value))}
              onPointerUp={() => save({ clipVolume: clipVol })}
              onKeyUp={() => save({ clipVolume: clipVol })}
              className="mt-1 w-full"
            />
          </label>
          {p.music ? (
            <div className="mt-3 space-y-2">
              <p className="truncate text-sm text-slate-800">
                🎵 {p.music.name}
                <button type="button" onClick={() => call(() => video.removeMusic(p.id))} className="ml-2 text-xs font-medium text-rose-600 hover:underline">
                  Quitar
                </button>
              </p>
              <audio src={p.music.url} controls className="h-9 w-full" preload="none" />
              <label className="block text-sm text-slate-700">
                Volumen de la música: <strong>{Math.round(musicVol * 100)} %</strong>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={musicVol}
                  onChange={(e) => setMusicVol(Number(e.target.value))}
                  onPointerUp={() => save({ musicVolume: musicVol })}
                  onKeyUp={() => save({ musicVolume: musicVol })}
                  className="mt-1 w-full"
                />
              </label>
              <p className="text-xs text-slate-400">La música se repite si es más corta que el video y baja suavemente al final.</p>
            </div>
          ) : (
            <label className={`${btnSecondary} mt-3 inline-flex cursor-pointer`}>
              + Agregar música
              <input
                ref={musicInput}
                type="file"
                accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploads([{ name: f.name, progress: 0 }]);
                  await call(() => video.setMusic(p.id, f, (pr) => setUploads([{ name: f.name, progress: pr }])));
                  setUploads([]);
                }}
              />
            </label>
          )}
        </Section>
      </div>

      <Section title="4. Subtítulos" hint="Texto en pantalla, con tiempos en segundos sobre el video final.">
        <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
          Posición
          <select
            className={inputCls.replace('w-full', 'w-auto')}
            value={p.subtitlePosition}
            onChange={(e) => save({ subtitlePosition: e.target.value as ProjectSettings['subtitlePosition'] })}
          >
            <option value="abajo">Abajo</option>
            <option value="centro">Centro</option>
            <option value="arriba">Arriba</option>
          </select>
        </label>
        <Subtitles key={p.subtitles.map((s) => s.id).join()} project={p} onSaved={apply} />
      </Section>

      <Section title="5. Exportar" hint="Se procesa en tu computadora con FFmpeg, gratis. Puedes seguir usando la app mientras tanto.">
        <div className="flex flex-wrap gap-2">
          {VIDEO_FORMATS.map((f) => {
            const on = formats.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFormats((l) => (on ? l.filter((x) => x !== f.id) : [...l, f.id]))}
                className={`rounded-xl border px-3 py-2 text-left text-sm ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
              >
                <span className="block font-semibold">{f.label}</span>
                <span className={`block text-[11px] ${on ? 'text-slate-300' : 'text-slate-500'}`}>{f.hint}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select className={inputCls.replace('w-full', 'w-auto')} value={quality} onChange={(e) => setQuality(e.target.value as 'borrador' | 'final')} aria-label="Calidad">
            <option value="final">Calidad final (1080p)</option>
            <option value="borrador">Borrador rápido (720p)</option>
          </select>
          <button
            type="button"
            disabled={!formats.length || !p.clips.length}
            onClick={() => call(() => video.render(p.id, formats, quality))}
            className={btnPrimary}
          >
            Exportar {formats.length > 1 ? `${formats.length} formatos` : ''}
          </button>
          {!p.clips.length && <span className="text-xs text-slate-500">Agrega al menos un clip.</span>}
        </div>
        {p.renders.length > 0 && (
          <ul className="mt-4 space-y-2">
            {p.renders.map((r) => (
              <RenderRow
                key={r.id}
                r={r}
                onCancel={() => video.cancelRender(r.id).catch((e) => setError((e as Error).message))}
                onRemove={() => window.confirm(`¿Eliminar el video exportado (${r.formatLabel})? Se borra el archivo.`) && call(() => video.removeRender(r.id))}
              />
            ))}
          </ul>
        )}
      </Section>

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {preview.kind === 'imagen' ? (
              <img src={preview.url} alt={preview.name} className="max-h-[80vh] rounded-xl" />
            ) : (
              <video
                src={preview.url}
                controls
                autoPlay
                className="max-h-[80vh] rounded-xl"
                onLoadedMetadata={(e) => (e.currentTarget.currentTime = preview.trimStart)}
              />
            )}
            <button type="button" onClick={() => setPreview(null)} className="mt-2 w-full text-center text-sm text-white/80 hover:text-white">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Estudio

function ProjectList({ business, onOpen }: { business: Business; onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<VideoProjectSummary[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ffmpeg, setFfmpeg] = useState<{ ok: boolean; detail: string } | null>(null);

  useEffect(() => {
    video
      .projects(business.id)
      .then((r) => setProjects(r.projects))
      .catch((e) => setError((e as Error).message));
    video
      .status()
      .then((s) => setFfmpeg(s.ffmpeg))
      .catch(() => undefined);
  }, [business.id]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const p = await video.create(business.id, name);
      onOpen(p.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (p: VideoProjectSummary) => {
    if (!window.confirm(`¿Eliminar el proyecto "${p.name}" con todos sus clips y videos exportados? No se puede deshacer.`)) return;
    try {
      await video.remove(p.id);
      setProjects((l) => (l ?? []).filter((x) => x.id !== p.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4 p-5 sm:p-6">
      {ffmpeg && !ffmpeg.ok && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{ffmpeg.detail}</p>}
      <p className="text-sm text-slate-600">
        Valeria monta tus videos: une clips e imágenes, recorta, agrega música y subtítulos, y exporta en vertical, horizontal y cuadrado. Todo
        se procesa en tu computadora, gratis. <span className="text-slate-400">No genera imágenes ni video con IA: usa el material que subas.</span>
      </p>
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-sm`} placeholder="Nombre del video (ej.: Spot planillas noviembre)" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        <button type="submit" className={btnPrimary}>
          + Nuevo proyecto
        </button>
      </form>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {projects?.length === 0 && <p className="text-sm text-slate-500">Aún no hay proyectos de video para {business.name}.</p>}
      {!!projects?.length && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-3">
              <button type="button" onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold text-slate-900 hover:underline">{p.name}</span>
                <span className="text-xs text-slate-500">
                  {p.clips} clip{p.clips === 1 ? '' : 's'} · {p.exports} exportado{p.exports === 1 ? '' : 's'} · editado{' '}
                  {new Date(p.updatedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                </span>
              </button>
              <button type="button" onClick={() => onOpen(p.id)} className={btnSecondary}>
                Abrir
              </button>
              <button type="button" onClick={() => remove(p)} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VideoStudio() {
  const openModal = useOfficeStore((s) => s.openModal);
  const business = useOfficeStore((s) => s.businesses.find((b) => b.id === s.activeBusinessId) ?? null);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Modal
      title="Estudio de video"
      subtitle={business ? `${business.name} · Valeria · montaje gratuito en tu computadora` : undefined}
      onClose={() => openModal(null)}
      wide
    >
      {!business ? (
        <div className="p-6">
          <p className="text-sm text-slate-600">Primero registra un negocio.</p>
          <button type="button" onClick={() => openModal('negocios')} className={`${btnPrimary} mt-3`}>
            Registrar negocio
          </button>
        </div>
      ) : openId ? (
        <Editor key={openId} projectId={openId} onBack={() => setOpenId(null)} />
      ) : (
        <ProjectList business={business} onOpen={setOpenId} />
      )}
    </Modal>
  );
}
