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

// ---------------- CRM (gratuito, local) ----------------

export const STAGES = [
  { id: 'nuevo', label: 'Nuevo', cls: 'bg-slate-100 text-slate-700' },
  { id: 'contactado', label: 'Contactado', cls: 'bg-sky-50 text-sky-700' },
  { id: 'interesado', label: 'Interesado', cls: 'bg-indigo-50 text-indigo-700' },
  { id: 'propuesta', label: 'Propuesta enviada', cls: 'bg-violet-50 text-violet-700' },
  { id: 'negociacion', label: 'Negociación', cls: 'bg-amber-50 text-amber-800' },
  { id: 'ganado', label: 'Ganado', cls: 'bg-emerald-50 text-emerald-700' },
  { id: 'perdido', label: 'Perdido', cls: 'bg-rose-50 text-rose-700' },
] as const;
export type Stage = (typeof STAGES)[number]['id'];

export const PRIORITIES = [
  { id: 'caliente', label: 'Caliente', dot: 'bg-rose-500' },
  { id: 'tibio', label: 'Tibio', dot: 'bg-amber-400' },
  { id: 'frio', label: 'Frío', dot: 'bg-sky-400' },
] as const;
export type Priority = (typeof PRIORITIES)[number]['id'];

export const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'llamada', label: 'Llamada' },
  { id: 'correo', label: 'Correo' },
  { id: 'reunion', label: 'Reunión' },
  { id: 'otro', label: 'Otro' },
] as const;

export interface Prospect {
  id: string;
  businessId: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  service: string;
  contactDate: string | null;
  stage: Stage;
  priority: Priority;
  nextFollowup: string | null;
  notes: string;
  followupCount: number;
  lastFollowup: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProspectInput = Pick<
  Prospect,
  'name' | 'company' | 'phone' | 'email' | 'service' | 'contactDate' | 'stage' | 'priority' | 'nextFollowup' | 'notes'
>;

export interface Followup {
  id: string;
  date: string;
  channel: string;
  note: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  body: string;
}

export interface CrmSummary {
  today: string;
  total: number;
  byStage: Record<Stage, number>;
  overdue: number;
  dueToday: number;
  dueWeek: number;
  winRate: number | null;
}

export const crm = {
  prospects: (businessId: string) => request<{ prospects: Prospect[] }>(`/api/crm/prospects?businessId=${businessId}`),
  createProspect: (businessId: string, p: ProspectInput) =>
    request<Prospect>('/api/crm/prospects', json('POST', { ...p, businessId })),
  updateProspect: (id: string, p: ProspectInput) => request<Prospect>(`/api/crm/prospects/${id}`, json('PUT', p)),
  deleteProspect: (id: string) => request<{ ok: true }>(`/api/crm/prospects/${id}`, { method: 'DELETE' }),
  followups: (id: string) => request<{ followups: Followup[] }>(`/api/crm/prospects/${id}/followups`),
  addFollowup: (id: string, f: { date: string; channel: string; note: string; nextFollowup?: string }) =>
    request<Prospect>(`/api/crm/prospects/${id}/followups`, json('POST', f)),
  whatsappOpened: (id: string, templateName?: string) =>
    request<{ ok: true }>(`/api/crm/prospects/${id}/whatsapp-opened`, json('POST', { templateName })),
  templates: (businessId: string) => request<{ templates: Template[] }>(`/api/crm/templates?businessId=${businessId}`),
  createTemplate: (businessId: string, t: { name: string; body: string }) =>
    request<Template>('/api/crm/templates', json('POST', { ...t, businessId })),
  updateTemplate: (id: string, t: { name: string; body: string }) => request<Template>(`/api/crm/templates/${id}`, json('PUT', t)),
  deleteTemplate: (id: string) => request<{ ok: true }>(`/api/crm/templates/${id}`, { method: 'DELETE' }),
  summary: (businessId: string) => request<CrmSummary>(`/api/crm/summary?businessId=${businessId}`),
};

export const health = () => request<{ ok: true; time: string; ai: boolean }>('/api/health');

/** Rellena {nombre}, {empresa}, {servicio} y {negocio}. */
export function fillTemplate(body: string, p: Prospect, businessName: string) {
  const vars: Record<string, string> = {
    nombre: p.name.split(' ')[0] ?? p.name,
    nombre_completo: p.name,
    empresa: p.company,
    servicio: p.service,
    negocio: businessName,
  };
  return body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k.toLowerCase()] ?? m);
}

/** Enlace oficial de WhatsApp (wa.me): abre la app con el texto; el usuario decide si lo envía. */
export function whatsappLink(phone: string, text: string): { url: string } | { error: string } {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return { error: 'El prospecto no tiene teléfono.' };
  if (digits.length < 10) return { error: 'Agrega el código de país al teléfono (por ejemplo, 51 para Perú).' };
  return { url: `https://wa.me/${digits}?text=${encodeURIComponent(text)}` };
}
