import fs from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';

/**
 * Ubicación de FFmpeg, en este orden:
 * 1. FFMPEG_PATH del archivo .env (si el usuario quiere usar su propia instalación).
 * 2. El FFmpeg que se descarga solo con `npm install` (paquete ffmpeg-static).
 * 3. El comando `ffmpeg` del sistema.
 */
function candidates(): string[] {
  const list: string[] = [];
  if (process.env.FFMPEG_PATH?.trim()) list.push(process.env.FFMPEG_PATH.trim());
  if (typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) list.push(ffmpegStatic);
  list.push('ffmpeg');
  return list;
}

export interface FfmpegStatus {
  ok: boolean;
  path: string | null;
  version: string | null;
  detail: string;
}

let cached: FfmpegStatus | null = null;

function tryVersion(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    let out = '';
    let child: ChildProcess;
    try {
      child = spawn(bin, ['-hide_banner', '-version'], { windowsHide: true });
    } catch {
      return resolve(null);
    }
    child.stdout?.on('data', (d) => (out += d));
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 ? out.split('\n')[0].trim() : null));
  });
}

export async function ffmpegStatus(force = false): Promise<FfmpegStatus> {
  if (cached && !force) return cached;
  for (const bin of candidates()) {
    const v = await tryVersion(bin);
    if (v) {
      cached = { ok: true, path: bin, version: v, detail: 'FFmpeg listo para montar videos en tu computadora.' };
      return cached;
    }
  }
  cached = {
    ok: false,
    path: null,
    version: null,
    detail:
      'No se encontró FFmpeg. Vuelve a ejecutar "npm install" (lo descarga solo) o instala FFmpeg y escribe su ruta en FFMPEG_PATH dentro del archivo .env.',
  };
  return cached;
}

export interface MediaInfo {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

/** Lee duración, tamaño y pistas de un archivo usando la salida de `ffmpeg -i`. */
export async function probe(file: string): Promise<MediaInfo> {
  const st = await ffmpegStatus();
  if (!st.ok || !st.path) throw new Error(st.detail);
  const stderr = await new Promise<string>((resolve, reject) => {
    let err = '';
    const child = spawn(st.path!, ['-hide_banner', '-i', file], { windowsHide: true });
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', () => resolve(err));
  });
  const dur = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  const video = /Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})/.exec(stderr);
  const rotation = /rotate\s*:\s*(-?\d+)|displaymatrix: rotation of (-?[\d.]+)/.exec(stderr);
  let width = video ? Number(video[1]) : 0;
  let height = video ? Number(video[2]) : 0;
  const rot = rotation ? Math.abs(Math.round(Number(rotation[1] ?? rotation[2]))) % 180 : 0;
  if (rot === 90) [width, height] = [height, width];
  return {
    duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
    width,
    height,
    hasAudio: /Stream #[^\n]*Audio:/.test(stderr),
    hasVideo: Boolean(video),
  };
}

/** Ejecuta FFmpeg informando el avance (segundos procesados). Devuelve el proceso para poder cancelarlo. */
export function run(
  args: string[],
  opts: { cwd: string; onTime?: (seconds: number) => void },
): { child: ChildProcess; done: Promise<void> } {
  const bin = cached?.path;
  if (!bin) throw new Error('FFmpeg no está disponible.');
  const child = spawn(bin, ['-hide_banner', '-nostdin', '-y', ...args], { cwd: opts.cwd, windowsHide: true });
  let tail = '';
  const done = new Promise<void>((resolve, reject) => {
    child.stderr?.on('data', (d: Buffer) => {
      const s = d.toString();
      tail = (tail + s).slice(-4000);
      const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
      if (m && opts.onTime) opts.onTime(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else if (signal) reject(new Error('cancelado'));
      else {
        const lines = tail.trim().split('\n').filter((l) => !/^\s*(frame=|size=)/.test(l));
        reject(new Error(lines.slice(-3).join(' ').slice(0, 500) || `FFmpeg terminó con código ${code}`));
      }
    });
  });
  return { child, done };
}
