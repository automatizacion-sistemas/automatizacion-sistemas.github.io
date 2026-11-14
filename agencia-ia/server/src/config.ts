import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Raíz del repositorio (server/src o server/dist → ../..). */
export const ROOT_DIR = path.resolve(here, '..', '..');

function str(name: string, fallback: string) {
  const v = process.env[name]?.trim();
  return v ? v : fallback;
}

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

const effortEnv = str('AGENT_EFFORT', 'medium') as Effort;

export const config = {
  port: Number(str('PORT', '8787')),
  /** Solo escucha en la propia computadora salvo que se indique otra cosa. */
  host: str('HOST', '127.0.0.1'),
  dataDir: path.resolve(ROOT_DIR, str('DATA_DIR', 'data')),
  anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  model: str('AGENT_MODEL', 'claude-opus-5-5'),
  effort: (EFFORTS as readonly string[]).includes(effortEnv) ? effortEnv : 'medium',
  /** Cantidad de mensajes previos que se envían como contexto en cada conversación. */
  historyLimit: 40,
};

/**
 * Precios de referencia en USD por millón de tokens (lista pública de Anthropic, nov-2026).
 * Solo se usan para mostrar un costo ESTIMADO; la factura real está en console.anthropic.com.
 */
export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
