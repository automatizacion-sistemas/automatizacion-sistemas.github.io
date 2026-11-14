import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { db, newId, now } from './db.js';
import { getBusiness } from './businesses.js';
import { logActivity } from './activity.js';
import { broadcast } from './events.js';
import { ffmpegStatus, probe, run } from './ffmpeg.js';

/**
 * Estudio de video de Valeria: montaje 100 % local y gratuito con FFmpeg.
 * Une clips e imágenes, recorta, agrega música y subtítulos, y exporta en 9:16, 16:9 y 1:1.
 * No genera video con IA: trabaja con el material que sube el usuario.
 */

export const MEDIA_DIR = path.join(config.dataDir, 'media');
fs.mkdirSync(MEDIA_DIR, { recursive: true });
const FONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts', 'Inter-Bold.otf');

const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const AUDIO_EXT = new Set(['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.opus', '.flac']);
const MAX_UPLOAD = 1024 * 1024 * 1024; // 1 GB por archivo

export const FORMATS = {
  vertical: { label: 'Vertical 9:16', w: 1080, h: 1920 },
  horizontal: { label: 'Horizontal 16:9', w: 1920, h: 1080 },
  cuadrado: { label: 'Cuadrado 1:1', w: 1080, h: 1080 },
} as const;
type FormatId = keyof typeof FORMATS;
const FITS = ['difuminado', 'rellenar', 'ajustar'] as const;
const POSITIONS = ['abajo', 'centro', 'arriba'] as const;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const HEX = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------- Datos

interface ProjectRow {
  id: string;
  business_id: string;
  name: string;
  fit: string;
  bg_color: string;
  clip_volume: number;
  music_volume: number;
  music_file: string | null;
  music_name: string | null;
  fades: number;
  subtitle_position: string;
  created_at: string;
  updated_at: string;
}
interface ClipRow {
  id: string;
  project_id: string;
  kind: 'video' | 'imagen';
  file: string;
  original_name: string;
  duration: number;
  width: number;
  height: number;
  has_audio: number;
  position: number;
  trim_start: number;
  trim_end: number | null;
  image_duration: number;
}
interface SubRow {
  id: string;
  start: number;
  end: number;
  text: string;
}
interface RenderRow {
  id: string;
  project_id: string;
  format: FormatId;
  quality: string;
  status: string;
  progress: number;
  file: string | null;
  size: number | null;
  duration: number | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

const projectDir = (id: string) => path.join(MEDIA_DIR, id);
const fileUrl = (projectId: string, rel: string) => `/api/video/files/${projectId}/${rel.split(path.sep).join('/')}`;

/** Duración efectiva de un elemento de la línea de tiempo. */
const clipLength = (c: ClipRow) =>
  c.kind === 'imagen' ? c.image_duration : Math.max(0.1, (c.trim_end ?? c.duration) - c.trim_start);

const toClip = (c: ClipRow) => ({
  id: c.id,
  kind: c.kind,
  name: c.original_name,
  url: fileUrl(c.project_id, path.join('clips', c.file)),
  duration: c.duration,
  width: c.width,
  height: c.height,
  hasAudio: Boolean(c.has_audio),
  trimStart: c.trim_start,
  trimEnd: c.trim_end,
  imageDuration: c.image_duration,
  length: clipLength(c),
});

const toRender = (r: RenderRow) => ({
  id: r.id,
  format: r.format,
  formatLabel: FORMATS[r.format]?.label ?? r.format,
  quality: r.quality,
  status: r.status,
  progress: r.progress,
  url: r.file ? fileUrl(r.project_id, path.join('renders', r.file)) : null,
  size: r.size,
  duration: r.duration,
  error: r.error,
  createdAt: r.created_at,
  finishedAt: r.finished_at,
});

function getProjectRow(id: string) {
  return db.prepare('SELECT * FROM video_projects WHERE id = ?').get(id) as unknown as ProjectRow | undefined;
}
function getClips(projectId: string) {
  return db.prepare('SELECT * FROM video_clips WHERE project_id = ? ORDER BY position, created_at').all(projectId) as unknown as ClipRow[];
}
function getSubs(projectId: string) {
  return db.prepare('SELECT id, start, end, text FROM video_subtitles WHERE project_id = ? ORDER BY start').all(projectId) as unknown as SubRow[];
}

function fullProject(id: string) {
  const p = getProjectRow(id);
  if (!p) return null;
  const clips = getClips(id);
  return {
    id: p.id,
    businessId: p.business_id,
    name: p.name,
    fit: p.fit,
    bgColor: p.bg_color,
    clipVolume: p.clip_volume,
    musicVolume: p.music_volume,
    music: p.music_file ? { name: p.music_name ?? 'Música', url: fileUrl(p.id, path.join('audio', p.music_file)) } : null,
    fades: Boolean(p.fades),
    subtitlePosition: p.subtitle_position,
    totalDuration: clips.reduce((a, c) => a + clipLength(c), 0),
    clips: clips.map(toClip),
    subtitles: getSubs(id),
    renders: (
      db.prepare('SELECT * FROM video_renders WHERE project_id = ? ORDER BY created_at DESC').all(id) as unknown as RenderRow[]
    ).map(toRender),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

const touch = (id: string) => db.prepare('UPDATE video_projects SET updated_at = ? WHERE id = ?').run(now(), id);

// ---------------------------------------------------------------- Motor de montaje

/** Filtro de encuadre: rellenar (recorta), ajustar (barras de color) o difuminado (fondo borroso). */
function fitGraph(input: string, out: string, w: number, h: number, fit: string, bg: string) {
  const base = `fps=30,setsar=1,format=yuv420p`;
  if (fit === 'rellenar') return `${input}scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${base}${out}`;
  if (fit === 'ajustar')
    return `${input}scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x${bg.slice(1)},${base}${out}`;
  // difuminado
  return (
    `${input}split=2[bgs][fgs];` +
    `[bgs]scale=${Math.round(w / 4)}:${Math.round(h / 4)}:force_original_aspect_ratio=increase,crop=${Math.round(w / 4)}:${Math.round(h / 4)},boxblur=10:2,scale=${w}:${h}[bgb];` +
    `[fgs]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgb];` +
    `[bgb][fgb]overlay=(W-w)/2:(H-h)/2,${base}${out}`
  );
}

/** Corta el texto en líneas que caben en el ancho del video. */
function wrap(textIn: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const para of textIn.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, 4);
}

interface Job {
  renderId: string;
  projectId: string;
  child: ChildProcess | null;
  cancelled: boolean;
}
const queue: string[] = [];
let current: Job | null = null;

function setRender(id: string, fields: Partial<Pick<RenderRow, 'status' | 'progress' | 'file' | 'size' | 'duration' | 'error' | 'finished_at'>>) {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE video_renders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(
    ...keys.map((k) => (fields as Record<string, string | number | null>)[k]),
    id,
  );
  const r = db.prepare('SELECT * FROM video_renders WHERE id = ?').get(id) as unknown as RenderRow | undefined;
  if (r) broadcast('render', { projectId: r.project_id, render: toRender(r) });
}

async function renderOne(job: Job) {
  const r = db.prepare('SELECT * FROM video_renders WHERE id = ?').get(job.renderId) as unknown as RenderRow;
  const p = getProjectRow(r.project_id)!;
  const clips = getClips(p.id);
  const subs = getSubs(p.id);
  const fmt = FORMATS[r.format];
  const scale = r.quality === 'borrador' ? 2 / 3 : 1;
  const W = Math.round((fmt.w * scale) / 2) * 2;
  const H = Math.round((fmt.h * scale) / 2) * 2;
  const total = clips.reduce((a, c) => a + clipLength(c), 0);
  const work = path.join(projectDir(p.id), `tmp-${r.id}`);
  fs.mkdirSync(work, { recursive: true });
  const crf = r.quality === 'borrador' ? '26' : '20';
  const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', crf, '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2'];

  const exec = async (args: string[], from: number, span: number, duration: number) => {
    if (job.cancelled) throw new Error('cancelado');
    const { child, done } = run(args, {
      cwd: work,
      onTime: (t) => {
        const pct = Math.min(0.99, from + span * Math.min(1, t / Math.max(0.1, duration)));
        setRender(r.id, { progress: Math.round(pct * 100) / 100 });
      },
    });
    job.child = child;
    await done;
    job.child = null;
  };

  try {
    setRender(r.id, { status: 'procesando', progress: 0 });
    // 1) Cada clip se normaliza al formato final (mismo tamaño, 30 fps y audio estéreo).
    let acc = 0;
    for (const [i, c] of clips.entries()) {
      const len = clipLength(c);
      const src = path.join(projectDir(p.id), 'clips', c.file);
      const inputs =
        c.kind === 'imagen'
          ? ['-loop', '1', '-framerate', '30', '-t', len.toFixed(3), '-i', src]
          : ['-ss', c.trim_start.toFixed(3), '-t', len.toFixed(3), '-i', src];
      const graph = [
        fitGraph('[0:v]', '[v]', W, H, p.fit, p.bg_color),
        c.kind === 'video' && c.has_audio
          ? `[0:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${len.toFixed(3)}[a]`
          : null,
      ]
        .filter(Boolean)
        .join(';');
      await exec(
        [
          ...inputs,
          '-f', 'lavfi', '-t', len.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo',
          '-filter_complex', graph,
          '-map', '[v]', '-map', c.kind === 'video' && c.has_audio ? '[a]' : '1:a',
          '-t', len.toFixed(3), ...enc, `seg_${i}.mp4`,
        ],
        (acc / total) * 0.65,
        (len / total) * 0.65,
        len,
      );
      acc += len;
    }

    // 2) Se unen los tramos sin volver a codificar.
    fs.writeFileSync(path.join(work, 'lista.txt'), clips.map((_, i) => `file 'seg_${i}.mp4'`).join('\n'));
    await exec(['-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-c', 'copy', 'unido.mp4'], 0.65, 0.05, total);

    // 3) Subtítulos, fundidos y música.
    fs.copyFileSync(FONT, path.join(work, 'fuente.otf'));
    const fontSize = Math.round(Math.min(W, H) * 0.058);
    const lineH = Math.round(fontSize * 1.45);
    const maxChars = Math.max(12, Math.floor((W * 0.86) / (fontSize * 0.56)));
    const vf: string[] = [];
    subs.forEach((s, i) => {
      const lines = wrap(s.text, maxChars);
      const block = lines.length * lineH;
      const anchor =
        p.subtitle_position === 'arriba'
          ? `${Math.round(H * 0.12)}`
          : p.subtitle_position === 'centro'
            ? `${Math.round((H - block) / 2)}`
            : `${Math.round(H * (r.format === 'vertical' ? 0.74 : 0.86) - block)}`;
      lines.forEach((line, j) => {
        const tf = `sub_${i}_${j}.txt`;
        fs.writeFileSync(path.join(work, tf), line, 'utf8');
        vf.push(
          `drawtext=fontfile=fuente.otf:textfile=${tf}:fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=${Math.round(fontSize * 0.28)}` +
            `:x=(w-text_w)/2:y=${anchor}+${j * lineH}:enable='between(t,${s.start.toFixed(2)},${s.end.toFixed(2)})'`,
        );
      });
    });
    const fade = p.fades && total > 2;
    if (fade) vf.push(`fade=t=in:st=0:d=0.5`, `fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6`);

    const musicPath = p.music_file ? path.join(projectDir(p.id), 'audio', p.music_file) : null;
    const graph: string[] = [`[0:v]${vf.length ? vf.join(',') : 'null'}[v]`];
    const audioMap = '[a]';
    const clipVol = p.clip_volume.toFixed(2);
    if (musicPath && fs.existsSync(musicPath)) {
      const fadeOut = Math.max(0, total - 2).toFixed(2);
      graph.push(
        `[0:a]volume=${clipVol}[ca]`,
        `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${p.music_volume.toFixed(2)},atrim=0:${total.toFixed(3)},afade=t=out:st=${fadeOut}:d=2[ma]`,
        `[ca][ma]amix=inputs=2:duration=first:dropout_transition=0:normalize=0${fade ? ',afade=t=in:st=0:d=0.5' : ''}[a]`,
      );
    } else {
      graph.push(`[0:a]volume=${clipVol}${fade ? `,afade=t=in:st=0:d=0.5,afade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6` : ''}[a]`);
    }
    const outName = `${p.name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'video'}-${r.format}-${r.id.slice(0, 6)}.mp4`;
    const rendersDir = path.join(projectDir(p.id), 'renders');
    fs.mkdirSync(rendersDir, { recursive: true });
    await exec(
      [
        '-i', 'unido.mp4',
        ...(musicPath && fs.existsSync(musicPath) ? ['-stream_loop', '-1', '-i', musicPath] : []),
        '-filter_complex', graph.join(';'),
        '-map', '[v]', '-map', audioMap,
        '-t', total.toFixed(3), ...enc, '-movflags', '+faststart',
        path.join(rendersDir, outName),
      ],
      0.7,
      0.3,
      total,
    );
    const size = fs.statSync(path.join(rendersDir, outName)).size;
    setRender(r.id, { status: 'listo', progress: 1, file: outName, size, duration: total, finished_at: now() });
    const business = getBusiness(p.business_id);
    logActivity({
      businessId: p.business_id,
      agentId: 'valeria',
      kind: 'video_exportado',
      summary: `Video "${p.name}" exportado en ${fmt.label} (${Math.round(total)} s${business ? `, ${business.name}` : ''}).`,
    });
  } catch (err) {
    const msg = (err as Error).message;
    const cancelled = job.cancelled || msg === 'cancelado';
    setRender(r.id, {
      status: cancelled ? 'cancelado' : 'error',
      error: cancelled ? null : msg,
      finished_at: now(),
    });
    if (!cancelled)
      logActivity({ businessId: p.business_id, agentId: 'valeria', kind: 'error', summary: `Falló la exportación de "${p.name}": ${msg.slice(0, 160)}` });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

async function pump() {
  if (current) return;
  const next = queue.shift();
  if (!next) return;
  const r = db.prepare('SELECT project_id, status FROM video_renders WHERE id = ?').get(next) as { project_id: string; status: string } | undefined;
  if (!r || r.status !== 'en_cola') return void pump();
  current = { renderId: next, projectId: r.project_id, child: null, cancelled: false };
  try {
    await renderOne(current);
  } finally {
    current = null;
    void pump();
  }
}

// Exportaciones que quedaron a medias si la app se cerró.
db.prepare("UPDATE video_renders SET status = 'error', error = 'Se interrumpió al cerrar la app. Vuelve a exportar.' WHERE status IN ('en_cola','procesando')").run();

// ---------------------------------------------------------------- Rutas

export function registerVideo(app: FastifyInstance) {
  // Archivos del estudio (clips, música y videos exportados) con soporte de reproducción parcial.
  app.register(fastifyStatic, { root: MEDIA_DIR, prefix: '/api/video/files/', decorateReply: false, index: false, list: false });

  app.get('/api/video/status', async () => ({ ffmpeg: await ffmpegStatus(true), formats: FORMATS }));

  app.get<{ Querystring: { businessId?: string } }>('/api/video/projects', async (req, reply) => {
    const b = req.query.businessId ? getBusiness(req.query.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.updated_at AS updatedAt,
                (SELECT COUNT(*) FROM video_clips c WHERE c.project_id = p.id) AS clips,
                (SELECT COUNT(*) FROM video_renders r WHERE r.project_id = p.id AND r.status = 'listo') AS exports
         FROM video_projects p WHERE p.business_id = ? ORDER BY p.updated_at DESC`,
      )
      .all(b.id);
    return { projects: rows };
  });

  app.post<{ Body: { businessId?: string; name?: string } }>('/api/video/projects', async (req, reply) => {
    const b = req.body?.businessId ? getBusiness(req.body.businessId) : null;
    if (!b) return reply.code(404).send({ error: 'Negocio no encontrado.' });
    const name = text(req.body.name, 120);
    if (!name) return reply.code(400).send({ error: 'Ponle un nombre al proyecto.' });
    const id = newId();
    db.prepare('INSERT INTO video_projects (id, business_id, name, bg_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id,
      b.id,
      name,
      HEX.test(b.colors[0] ?? '') ? b.colors[0] : '#000000',
      now(),
      now(),
    );
    fs.mkdirSync(projectDir(id), { recursive: true });
    logActivity({ businessId: b.id, agentId: 'valeria', kind: 'video_proyecto', summary: `Nuevo proyecto de video: "${name}".` });
    return reply.code(201).send(fullProject(id));
  });

  app.get<{ Params: { id: string } }>('/api/video/projects/:id', async (req, reply) => {
    const p = fullProject(req.params.id);
    return p ?? reply.code(404).send({ error: 'Proyecto no encontrado.' });
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/video/projects/:id', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const b = req.body ?? {};
    db.prepare(
      `UPDATE video_projects SET name = ?, fit = ?, bg_color = ?, clip_volume = ?, music_volume = ?, fades = ?, subtitle_position = ?, updated_at = ? WHERE id = ?`,
    ).run(
      text(b.name, 120) || p.name,
      (FITS as readonly string[]).includes(b.fit as string) ? (b.fit as string) : p.fit,
      typeof b.bgColor === 'string' && HEX.test(b.bgColor) ? b.bgColor : p.bg_color,
      num(b.clipVolume, 0, 2, p.clip_volume),
      num(b.musicVolume, 0, 2, p.music_volume),
      typeof b.fades === 'boolean' ? Number(b.fades) : p.fades,
      (POSITIONS as readonly string[]).includes(b.subtitlePosition as string) ? (b.subtitlePosition as string) : p.subtitle_position,
      now(),
      p.id,
    );
    return fullProject(p.id);
  });

  app.delete<{ Params: { id: string } }>('/api/video/projects/:id', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    if (current?.projectId === p.id) return reply.code(409).send({ error: 'Espera a que termine o cancela la exportación en curso.' });
    db.prepare('DELETE FROM video_projects WHERE id = ?').run(p.id);
    fs.rmSync(projectDir(p.id), { recursive: true, force: true });
    logActivity({ businessId: p.business_id, agentId: 'valeria', kind: 'video_eliminado', summary: `Se eliminó el proyecto de video "${p.name}" y sus archivos.` });
    return { ok: true };
  });

  /** Sube un clip de video o una imagen y la agrega al final de la línea de tiempo. */
  app.post<{ Params: { id: string } }>('/api/video/projects/:id/clips', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const st = await ffmpegStatus();
    if (!st.ok) return reply.code(503).send({ error: st.detail });
    const file = await req.file({ limits: { fileSize: MAX_UPLOAD } });
    if (!file) return reply.code(400).send({ error: 'No se recibió ningún archivo.' });
    const ext = path.extname(file.filename).toLowerCase();
    const kind = VIDEO_EXT.has(ext) ? 'video' : IMAGE_EXT.has(ext) ? 'imagen' : null;
    if (!kind) {
      file.file.resume();
      return reply.code(400).send({ error: 'Formato no admitido. Usa MP4, MOV, WEBM, MKV, JPG, PNG o WEBP.' });
    }
    const dir = path.join(projectDir(p.id), 'clips');
    fs.mkdirSync(dir, { recursive: true });
    const stored = `${newId()}${ext}`;
    const dest = path.join(dir, stored);
    await pipeline(file.file, fs.createWriteStream(dest));
    if (file.file.truncated) {
      fs.rmSync(dest, { force: true });
      return reply.code(400).send({ error: 'El archivo supera 1 GB.' });
    }
    let info;
    try {
      info = await probe(dest);
    } catch (err) {
      fs.rmSync(dest, { force: true });
      return reply.code(400).send({ error: `No se pudo leer el archivo: ${(err as Error).message}` });
    }
    if (!info.hasVideo || (kind === 'video' && info.duration <= 0)) {
      fs.rmSync(dest, { force: true });
      return reply.code(400).send({ error: 'El archivo no tiene una pista de video válida.' });
    }
    const pos = (db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM video_clips WHERE project_id = ?').get(p.id) as { n: number }).n;
    db.prepare(
      `INSERT INTO video_clips (id, project_id, kind, file, original_name, duration, width, height, has_audio, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), p.id, kind, stored, file.filename.slice(0, 200), kind === 'imagen' ? 0 : info.duration, info.width, info.height, info.hasAudio && kind === 'video' ? 1 : 0, pos, now());
    touch(p.id);
    return reply.code(201).send(fullProject(p.id));
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/video/clips/:id', async (req, reply) => {
    const c = db.prepare('SELECT * FROM video_clips WHERE id = ?').get(req.params.id) as unknown as ClipRow | undefined;
    if (!c) return reply.code(404).send({ error: 'Clip no encontrado.' });
    const b = req.body ?? {};
    if (c.kind === 'imagen') {
      db.prepare('UPDATE video_clips SET image_duration = ? WHERE id = ?').run(num(b.imageDuration, 0.5, 60, c.image_duration), c.id);
    } else {
      const start = num(b.trimStart, 0, Math.max(0, c.duration - 0.2), c.trim_start);
      const endRaw = b.trimEnd === null ? null : num(b.trimEnd, start + 0.2, c.duration, c.trim_end ?? c.duration);
      db.prepare('UPDATE video_clips SET trim_start = ?, trim_end = ? WHERE id = ?').run(start, endRaw !== null && endRaw >= c.duration - 0.01 ? null : endRaw, c.id);
    }
    touch(c.project_id);
    return fullProject(c.project_id);
  });

  app.post<{ Params: { id: string }; Body: { ids?: unknown } }>('/api/video/projects/:id/order', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x): x is string => typeof x === 'string') : [];
    ids.forEach((id, i) => db.prepare('UPDATE video_clips SET position = ? WHERE id = ? AND project_id = ?').run(i, id, p.id));
    touch(p.id);
    return fullProject(p.id);
  });

  app.delete<{ Params: { id: string } }>('/api/video/clips/:id', async (req, reply) => {
    const c = db.prepare('SELECT * FROM video_clips WHERE id = ?').get(req.params.id) as unknown as ClipRow | undefined;
    if (!c) return reply.code(404).send({ error: 'Clip no encontrado.' });
    if (current?.projectId === c.project_id) return reply.code(409).send({ error: 'Espera a que termine la exportación en curso.' });
    db.prepare('DELETE FROM video_clips WHERE id = ?').run(c.id);
    fs.rmSync(path.join(projectDir(c.project_id), 'clips', c.file), { force: true });
    touch(c.project_id);
    return fullProject(c.project_id);
  });

  app.post<{ Params: { id: string } }>('/api/video/projects/:id/music', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const file = await req.file({ limits: { fileSize: 200 * 1024 * 1024 } });
    if (!file) return reply.code(400).send({ error: 'No se recibió ningún archivo.' });
    const ext = path.extname(file.filename).toLowerCase();
    if (!AUDIO_EXT.has(ext)) {
      file.file.resume();
      return reply.code(400).send({ error: 'Formato no admitido. Usa MP3, M4A, WAV, OGG o FLAC.' });
    }
    const dir = path.join(projectDir(p.id), 'audio');
    fs.mkdirSync(dir, { recursive: true });
    const stored = `${newId()}${ext}`;
    await pipeline(file.file, fs.createWriteStream(path.join(dir, stored)));
    if (file.file.truncated) {
      fs.rmSync(path.join(dir, stored), { force: true });
      return reply.code(400).send({ error: 'El audio supera 200 MB.' });
    }
    const info = await probe(path.join(dir, stored)).catch(() => null);
    if (!info?.hasAudio) {
      fs.rmSync(path.join(dir, stored), { force: true });
      return reply.code(400).send({ error: 'El archivo no tiene audio válido.' });
    }
    if (p.music_file) fs.rmSync(path.join(dir, p.music_file), { force: true });
    db.prepare('UPDATE video_projects SET music_file = ?, music_name = ?, updated_at = ? WHERE id = ?').run(stored, file.filename.slice(0, 200), now(), p.id);
    return fullProject(p.id);
  });

  app.delete<{ Params: { id: string } }>('/api/video/projects/:id/music', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    if (p.music_file) fs.rmSync(path.join(projectDir(p.id), 'audio', p.music_file), { force: true });
    db.prepare('UPDATE video_projects SET music_file = NULL, music_name = NULL, updated_at = ? WHERE id = ?').run(now(), p.id);
    return fullProject(p.id);
  });

  app.put<{ Params: { id: string }; Body: { subtitles?: unknown } }>('/api/video/projects/:id/subtitles', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const list = Array.isArray(req.body?.subtitles) ? req.body.subtitles : [];
    const clean: { start: number; end: number; text: string }[] = [];
    for (const raw of list.slice(0, 300) as Record<string, unknown>[]) {
      const t = text(raw?.text, 300);
      const start = num(raw?.start, 0, 36000, NaN);
      const end = num(raw?.end, 0, 36000, NaN);
      if (!t) continue;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        return reply.code(400).send({ error: `Revisa los tiempos del subtítulo "${t.slice(0, 30)}": el final debe ser mayor que el inicio.` });
      clean.push({ start, end, text: t });
    }
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM video_subtitles WHERE project_id = ?').run(p.id);
      for (const s of clean)
        db.prepare('INSERT INTO video_subtitles (id, project_id, start, end, text) VALUES (?, ?, ?, ?, ?)').run(newId(), p.id, s.start, s.end, s.text);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    touch(p.id);
    return fullProject(p.id);
  });

  /** Subtítulos en formato SRT, para subirlos aparte a YouTube o Facebook. */
  app.get<{ Params: { id: string } }>('/api/video/projects/:id/subtitles.srt', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const ts = (s: number) => {
      const ms = Math.round(s * 1000);
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const sec = Math.floor((ms % 60000) / 1000);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
    };
    const srt = getSubs(p.id)
      .map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.text}\n`)
      .join('\n');
    reply
      .header('Content-Type', 'application/x-subrip; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="subtitulos-${p.id.slice(0, 6)}.srt"`);
    return '﻿' + srt;
  });

  app.post<{ Params: { id: string }; Body: { formats?: unknown; quality?: string } }>('/api/video/projects/:id/render', async (req, reply) => {
    const p = getProjectRow(req.params.id);
    if (!p) return reply.code(404).send({ error: 'Proyecto no encontrado.' });
    const st = await ffmpegStatus();
    if (!st.ok) return reply.code(503).send({ error: st.detail });
    if (!getClips(p.id).length) return reply.code(400).send({ error: 'Agrega al menos un clip o imagen.' });
    const formats = (Array.isArray(req.body?.formats) ? req.body.formats : []).filter((f): f is FormatId => typeof f === 'string' && f in FORMATS);
    if (!formats.length) return reply.code(400).send({ error: 'Elige al menos un formato.' });
    const quality = req.body?.quality === 'borrador' ? 'borrador' : 'final';
    for (const f of [...new Set(formats)]) {
      const id = newId();
      db.prepare("INSERT INTO video_renders (id, project_id, format, quality, status, created_at) VALUES (?, ?, ?, ?, 'en_cola', ?)").run(id, p.id, f, quality, now());
      queue.push(id);
    }
    void pump();
    return fullProject(p.id);
  });

  app.post<{ Params: { id: string } }>('/api/video/renders/:id/cancel', async (req, reply) => {
    const r = db.prepare('SELECT * FROM video_renders WHERE id = ?').get(req.params.id) as unknown as RenderRow | undefined;
    if (!r) return reply.code(404).send({ error: 'Exportación no encontrada.' });
    if (current?.renderId === r.id) {
      current.cancelled = true;
      current.child?.kill('SIGKILL');
    } else if (r.status === 'en_cola') {
      const i = queue.indexOf(r.id);
      if (i >= 0) queue.splice(i, 1);
      setRender(r.id, { status: 'cancelado', finished_at: now() });
    }
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/video/renders/:id', async (req, reply) => {
    const r = db.prepare('SELECT * FROM video_renders WHERE id = ?').get(req.params.id) as unknown as RenderRow | undefined;
    if (!r) return reply.code(404).send({ error: 'Exportación no encontrada.' });
    if (r.status === 'procesando' || r.status === 'en_cola') return reply.code(409).send({ error: 'Cancélala primero.' });
    if (r.file) fs.rmSync(path.join(projectDir(r.project_id), 'renders', r.file), { force: true });
    db.prepare('DELETE FROM video_renders WHERE id = ?').run(r.id);
    return fullProject(r.project_id);
  });
}
