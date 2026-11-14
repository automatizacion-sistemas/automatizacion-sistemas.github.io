import Anthropic from '@anthropic-ai/sdk';
import { config, PRICES } from './config.js';

let client: Anthropic | null = null;

/** El cliente lee ANTHROPIC_API_KEY del entorno (archivo .env). La clave nunca llega al navegador. */
export function getClient(): Anthropic | null {
  if (!config.anthropicKeyPresent) return null;
  client ??= new Anthropic();
  return client;
}

export type IntegrationState =
  | 'conectado'
  | 'desconectado'
  | 'error_autenticacion'
  | 'permisos_insuficientes'
  | 'error';

export interface ClaudeStatus {
  state: IntegrationState;
  detail: string;
  model: string;
  effort: string;
  checkedAt: string;
}

let cached: ClaudeStatus | null = null;

/** Verifica la clave consultando el modelo configurado (no consume tokens). */
export async function checkClaude(force = false): Promise<ClaudeStatus> {
  if (cached && !force && Date.now() - Date.parse(cached.checkedAt) < 60_000) return cached;
  const base = { model: config.model, effort: config.effort, checkedAt: new Date().toISOString() };
  const c = getClient();
  if (!c) {
    cached = { ...base, state: 'desconectado', detail: 'Falta ANTHROPIC_API_KEY en el archivo .env.' };
    return cached;
  }
  try {
    const m = await c.models.retrieve(config.model);
    cached = { ...base, state: 'conectado', detail: `Modelo disponible: ${m.display_name ?? m.id}` };
  } catch (err) {
    cached = { ...base, ...describeError(err) };
  }
  return cached;
}

export function describeError(err: unknown): { state: IntegrationState; detail: string } {
  if (err instanceof Anthropic.AuthenticationError)
    return { state: 'error_autenticacion', detail: 'La clave API no es válida o fue revocada.' };
  if (err instanceof Anthropic.PermissionDeniedError)
    return { state: 'permisos_insuficientes', detail: 'La clave no tiene permiso para este modelo o recurso.' };
  if (err instanceof Anthropic.NotFoundError)
    return { state: 'error', detail: `El modelo "${config.model}" no está disponible para esta cuenta.` };
  if (err instanceof Anthropic.RateLimitError)
    return { state: 'error', detail: 'Límite de uso alcanzado. Espera un momento o revisa los límites de tu cuenta.' };
  if (err instanceof Anthropic.APIConnectionError)
    return { state: 'error', detail: 'No hay conexión con la API de Anthropic. Revisa tu internet.' };
  if (err instanceof Anthropic.APIError) {
    // 400 por saldo insuficiente, 529 por sobrecarga, etc.: se muestra el mensaje del proveedor.
    return { state: 'error', detail: `Error ${err.status ?? ''} de la API: ${err.message}`.trim() };
  }
  return { state: 'error', detail: err instanceof Error ? err.message : 'Error desconocido.' };
}

/** Modelos que admiten la recuperación automática del servidor ante un rechazo (fallbacks "default"). */
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5']);

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  text: string;
  model: string;
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null;
}

export function estimateCost(model: string, u: { input: number; output: number; cacheRead: number; cacheWrite: number }) {
  const p = PRICES[model];
  if (!p) return null;
  return (u.input * p.input + u.cacheWrite * p.input * 1.25 + u.cacheRead * p.cacheRead + u.output * p.output) / 1_000_000;
}

/** Conversación con streaming. `onText` recibe el texto a medida que llega. */
export async function streamChat(opts: {
  system: string;
  turns: ChatTurn[];
  onText: (delta: string) => void;
  signal: AbortSignal;
}): Promise<ChatResult> {
  const c = getClient();
  if (!c) throw new Error('Falta ANTHROPIC_API_KEY en el archivo .env.');

  const useFallbacks = FALLBACK_MODELS.has(config.model);
  const stream = c.beta.messages.stream(
    {
      model: config.model,
      max_tokens: 16000,
      output_config: { effort: config.effort },
      cache_control: { type: 'ephemeral' },
      system: opts.system,
      messages: opts.turns.map((t) => ({ role: t.role, content: t.content })),
      ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    },
    { signal: opts.signal },
  );

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') opts.onText(event.delta.text);
  }
  const msg = await stream.finalMessage();

  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const u = {
    input: msg.usage.input_tokens ?? 0,
    output: msg.usage.output_tokens ?? 0,
    cacheRead: msg.usage.cache_read_input_tokens ?? 0,
    cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
  };
  return {
    text,
    model: msg.model,
    stopReason: msg.stop_reason ?? null,
    inputTokens: u.input,
    outputTokens: u.output,
    cacheReadTokens: u.cacheRead,
    cacheWriteTokens: u.cacheWrite,
    costUsd: estimateCost(msg.model, u),
  };
}
