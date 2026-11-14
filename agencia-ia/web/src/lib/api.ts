/** Cliente del servidor local. Todas las llamadas pasan por /api (el navegador nunca ve claves). */
import type { AgentId, AgentStatus } from '../data/agents';

export interface Socials {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  whatsapp?: string;
  web?: string;
}

export interface Business {
  id: string;
  name: string;
  description: string;
  products: string;
  audience: string;
  goals: string;
  colors: string[];
  socials: Socials;
  hasLogo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BusinessInput = Omit<Business, 'id' | 'hasLogo' | 'createdAt' | 'updatedAt'>;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  createdAt: string;
}

export type IntegrationState = 'conectado' | 'desconectado' | 'error_autenticacion' | 'permisos_insuficientes' | 'error';

export interface Integration {
  id: string;
  name: string;
  purpose: string;
  agents: string[];
  state: IntegrationState;
  detail: string;
  requirements: string[];
  phase: number;
  credits: string;
  docsUrl: string;
}

export interface ActivityEntry {
  id: string;
  businessId: string | null;
  agentId: string | null;
  kind: string;
  summary: string;
  detail: unknown;
  createdAt: string;
}

export interface Usage {
  since: string;
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cost: number;
}

export interface AgentStatusPayload {
  status: AgentStatus;
  lastError: string | null;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError('No hay conexión con el servidor local.', 0);
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Error ${res.status}`, res.status);
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  businesses: () => request<{ businesses: Business[]; activeId: string | null }>('/api/businesses'),
  createBusiness: (b: BusinessInput) => request<Business>('/api/businesses', json('POST', b)),
  updateBusiness: (id: string, b: BusinessInput) => request<Business>(`/api/businesses/${id}`, json('PUT', b)),
  deleteBusiness: (id: string) => request<{ ok: true; activeId: string | null }>(`/api/businesses/${id}`, { method: 'DELETE' }),
  uploadLogo: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('logo', file);
    return request<Business>(`/api/businesses/${id}/logo`, { method: 'POST', body: fd });
  },
  logoUrl: (b: Business) => `/api/businesses/${b.id}/logo?v=${encodeURIComponent(b.updatedAt)}`,
  setActive: (id: string) => request<{ activeId: string }>('/api/active-business', json('PUT', { id })),
  messages: (agentId: AgentId, businessId: string) =>
    request<{ messages: ChatMessage[] }>(`/api/chat/${agentId}?businessId=${businessId}`),
  clearChat: (agentId: AgentId, businessId: string) =>
    request<{ ok: true }>(`/api/chat/${agentId}?businessId=${businessId}`, { method: 'DELETE' }),
  integrations: () => request<{ integrations: Integration[] }>('/api/integrations'),
  recheckClaude: () => request<{ integrations: Integration[] }>('/api/integrations/claude/check', { method: 'POST' }),
  activity: (q: { agentId?: string; businessId?: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (q.agentId) p.set('agentId', q.agentId);
    if (q.businessId) p.set('businessId', q.businessId);
    if (q.limit) p.set('limit', String(q.limit));
    return request<{ activity: ActivityEntry[] }>(`/api/activity?${p}`);
  },
  usage: () => request<Usage>('/api/usage'),
};

/**
 * Envía un mensaje a un agente y lee la respuesta en streaming (SSE sobre POST).
 * Devuelve el mensaje final guardado por el servidor.
 */
export async function sendChat(opts: {
  agentId: AgentId;
  businessId: string;
  message: string;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}): Promise<ChatMessage> {
  let res: Response;
  try {
    res = await fetch(`/api/chat/${opts.agentId}`, {
      ...json('POST', { businessId: opts.businessId, message: opts.message }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('No hay conexión con el servidor local.', 0);
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.error ?? `Error ${res.status}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: ChatMessage | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event: (.*)$/m.exec(chunk)?.[1];
      const dataLine = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!event || !dataLine) continue;
      const data = JSON.parse(dataLine);
      if (event === 'delta') opts.onDelta(data.text);
      else if (event === 'done') final = data.message;
      else if (event === 'error') throw new ApiError(data.error, 502);
    }
  }
  if (!final) throw new ApiError('La respuesta se interrumpió antes de terminar.', 0);
  return final;
}
