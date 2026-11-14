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

// ---------------- Calendario editorial (gratuito, publicación manual) ----------------

export const NETWORKS = [
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877f2',
    limit: 63206,
    hashtagLimit: null as number | null,
    hours: ['12:00', '13:00', '19:00', '20:00'],
    studio: { label: 'Meta Business Suite', url: 'https://business.facebook.com/latest/composer' },
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#d6249f',
    limit: 2200,
    hashtagLimit: 30 as number | null,
    hours: ['11:00', '12:00', '19:00', '21:00'],
    studio: { label: 'Meta Business Suite', url: 'https://business.facebook.com/latest/composer' },
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    color: '#111827',
    limit: 4000,
    hashtagLimit: null as number | null,
    hours: ['18:00', '19:00', '21:00', '22:00'],
    studio: { label: 'TikTok Studio', url: 'https://www.tiktok.com/tiktokstudio/upload' },
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: '#ff0000',
    limit: 5000,
    hashtagLimit: 15 as number | null,
    hours: ['17:00', '18:00', '20:00'],
    studio: { label: 'YouTube Studio', url: 'https://studio.youtube.com' },
  },
] as const;
export type NetworkId = (typeof NETWORKS)[number]['id'];

export const POST_STATUSES = [
  { id: 'borrador', label: 'Borrador', cls: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { id: 'pendiente', label: 'Pendiente de aprobación', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { id: 'aprobado', label: 'Aprobado', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { id: 'programado', label: 'Programado', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  { id: 'publicado', label: 'Publicado', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { id: 'error', label: 'Error', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
] as const;
export type PostStatus = (typeof POST_STATUSES)[number]['id'];

export const OWNERS = [
  { id: 'diego', label: 'Diego (CM)' },
  { id: 'valeria', label: 'Valeria (audiovisual)' },
  { id: 'sofia', label: 'Sofía (comercial)' },
  { id: 'usuario', label: 'Yo' },
] as const;

export interface Post {
  id: string;
  businessId: string;
  date: string;
  time: string;
  network: NetworkId;
  title: string;
  body: string;
  hashtags: string;
  media: string;
  status: PostStatus;
  owner: string;
  postUrl: string;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
}

export type PostContent = Pick<Post, 'date' | 'time' | 'title' | 'body' | 'hashtags' | 'media' | 'owner'>;

export interface CalendarSummary {
  today: string;
  byStatus: Record<PostStatus, number>;
  overdue: number;
  dueToday: number;
}

export const calendar = {
  posts: (businessId: string, from: string, to: string) =>
    request<{ posts: Post[] }>(`/api/calendar/posts?businessId=${businessId}&from=${from}&to=${to}`),
  create: (businessId: string, c: PostContent, networks: NetworkId[]) =>
    request<{ posts: Post[] }>('/api/calendar/posts', json('POST', { ...c, businessId, networks })),
  update: (id: string, c: PostContent & { network: NetworkId }) => request<Post>(`/api/calendar/posts/${id}`, json('PUT', c)),
  setStatus: (id: string, status: PostStatus, extra: { note?: string; postUrl?: string } = {}) =>
    request<Post>(`/api/calendar/posts/${id}/status`, json('POST', { status, ...extra })),
  remove: (id: string) => request<{ ok: true }>(`/api/calendar/posts/${id}`, { method: 'DELETE' }),
  summary: (businessId: string) => request<CalendarSummary>(`/api/calendar/summary?businessId=${businessId}`),
};

/** Texto final para pegar en la red: cuerpo + hashtags. */
export const composePost = (p: Pick<Post, 'body' | 'hashtags'>) => [p.body.trim(), p.hashtags.trim()].filter(Boolean).join('\n\n');
export const countHashtags = (s: string) => (s.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;

// ---------------- Tablero de tareas y coordinación ----------------

export type Assignee = 'sofia' | 'valeria' | 'diego' | 'usuario';
export type TaskStatus = 'pendiente' | 'en_curso' | 'en_revision' | 'terminada';

export const TASK_COLUMNS: { id: TaskStatus; label: string; hint: string }[] = [
  { id: 'pendiente', label: 'Pendiente', hint: 'Por empezar o esperando una entrega' },
  { id: 'en_curso', label: 'En curso', hint: 'Se está trabajando' },
  { id: 'en_revision', label: 'En revisión', hint: 'Entregada: espera tu aprobación' },
  { id: 'terminada', label: 'Terminada', hint: 'Aprobada y entregada al siguiente' },
];

export const TASK_PRIORITIES = [
  { id: 'alta', label: 'Alta', dot: 'bg-rose-500' },
  { id: 'normal', label: 'Normal', dot: 'bg-slate-400' },
  { id: 'baja', label: 'Baja', dot: 'bg-sky-400' },
] as const;

export interface Task {
  id: string;
  businessId: string;
  flowId: string | null;
  flowName: string;
  step: number;
  title: string;
  description: string;
  agentId: Assignee;
  status: TaskStatus;
  priority: string;
  dueDate: string | null;
  dependsOn: string | null;
  blocked: boolean;
  input: { taskId: string; title: string; agentId: Assignee | null; status: TaskStatus | null; result: string } | null;
  result: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: string;
  kind: string;
  note: string;
  createdAt: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  steps: { agentId: Assignee; title: string }[];
}

type Bucket = { pendiente: number; bloqueada: number; en_curso: number; en_revision: number; terminada: number };
export interface TasksSummary {
  byAgent: Record<Assignee, Bucket>;
  total: Bucket;
  overdue: number;
}

export type TaskAction = 'start' | 'deliver' | 'approve' | 'request_changes' | 'reopen';

export const tasksApi = {
  flows: () => request<{ flows: Flow[] }>('/api/tasks/flows'),
  list: (businessId: string) => request<{ tasks: Task[] }>(`/api/tasks?businessId=${businessId}`),
  create: (
    businessId: string,
    t: { title: string; description: string; agentId: Assignee; priority: string; dueDate: string | null },
  ) => request<Task>('/api/tasks', json('POST', { ...t, businessId })),
  createFlow: (businessId: string, f: { flowId: string; objective: string; dueDate: string | null; priority: string }) =>
    request<{ tasks: Task[] }>('/api/tasks/flow', json('POST', { ...f, businessId })),
  update: (id: string, t: { title: string; description: string; agentId: Assignee; priority: string; dueDate: string | null }) =>
    request<Task>(`/api/tasks/${id}`, json('PUT', t)),
  action: (id: string, action: TaskAction, extra: { note?: string; result?: string } = {}) =>
    request<Task>(`/api/tasks/${id}/action`, json('POST', { action, ...extra })),
  remove: (id: string) => request<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  importMany: (
    businessId: string,
    body: { name: string; chain: boolean; tasks: { title: string; description: string; agentId: Assignee; priority: string; dueDate: string | null }[] },
  ) => request<{ tasks: Task[] }>('/api/tasks/import', json('POST', { ...body, businessId })),
  events: (id: string) => request<{ events: TaskEvent[] }>(`/api/tasks/${id}/events`),
  summary: (businessId: string) => request<TasksSummary>(`/api/tasks/summary?businessId=${businessId}`),
};

// ---------------- Estudio de video (montaje local con FFmpeg) ----------------

export type VideoFormat = 'vertical' | 'horizontal' | 'cuadrado';
export const VIDEO_FORMATS: { id: VideoFormat; label: string; hint: string }[] = [
  { id: 'vertical', label: 'Vertical 9:16', hint: 'TikTok, Reels, Shorts, historias' },
  { id: 'horizontal', label: 'Horizontal 16:9', hint: 'YouTube, Facebook' },
  { id: 'cuadrado', label: 'Cuadrado 1:1', hint: 'Feed de Instagram y Facebook' },
];

export interface VideoClip {
  id: string;
  kind: 'video' | 'imagen';
  name: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  trimStart: number;
  trimEnd: number | null;
  imageDuration: number;
  length: number;
}

export interface VideoRender {
  id: string;
  format: VideoFormat;
  formatLabel: string;
  quality: string;
  status: 'en_cola' | 'procesando' | 'listo' | 'error' | 'cancelado';
  progress: number;
  url: string | null;
  size: number | null;
  duration: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface Subtitle {
  id?: string;
  start: number;
  end: number;
  text: string;
}

export interface VideoProject {
  id: string;
  businessId: string;
  name: string;
  fit: 'difuminado' | 'rellenar' | 'ajustar';
  bgColor: string;
  clipVolume: number;
  musicVolume: number;
  music: { name: string; url: string } | null;
  fades: boolean;
  subtitlePosition: 'abajo' | 'centro' | 'arriba';
  totalDuration: number;
  clips: VideoClip[];
  subtitles: Subtitle[];
  renders: VideoRender[];
}

export interface VideoProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  clips: number;
  exports: number;
}

export type ProjectSettings = Pick<VideoProject, 'name' | 'fit' | 'bgColor' | 'clipVolume' | 'musicVolume' | 'fades' | 'subtitlePosition'>;

/** Subida con barra de progreso (los videos pueden pesar cientos de MB). */
function upload<T>(url: string, file: File, onProgress: (p: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError('No hay conexión con el servidor local.', 0));
    xhr.onload = () => {
      let data: { error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* respuesta no JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(data?.error ?? `Error ${xhr.status}`, xhr.status));
    };
    const fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

export const video = {
  status: () => request<{ ffmpeg: { ok: boolean; version: string | null; detail: string } }>('/api/video/status'),
  projects: (businessId: string) => request<{ projects: VideoProjectSummary[] }>(`/api/video/projects?businessId=${businessId}`),
  create: (businessId: string, name: string) => request<VideoProject>('/api/video/projects', json('POST', { businessId, name })),
  get: (id: string) => request<VideoProject>(`/api/video/projects/${id}`),
  update: (id: string, s: Partial<ProjectSettings>) => request<VideoProject>(`/api/video/projects/${id}`, json('PUT', s)),
  remove: (id: string) => request<{ ok: true }>(`/api/video/projects/${id}`, { method: 'DELETE' }),
  addClip: (id: string, file: File, onProgress: (p: number) => void) => upload<VideoProject>(`/api/video/projects/${id}/clips`, file, onProgress),
  updateClip: (clipId: string, c: { trimStart?: number; trimEnd?: number | null; imageDuration?: number }) =>
    request<VideoProject>(`/api/video/clips/${clipId}`, json('PUT', c)),
  order: (id: string, ids: string[]) => request<VideoProject>(`/api/video/projects/${id}/order`, json('POST', { ids })),
  removeClip: (clipId: string) => request<VideoProject>(`/api/video/clips/${clipId}`, { method: 'DELETE' }),
  setMusic: (id: string, file: File, onProgress: (p: number) => void) => upload<VideoProject>(`/api/video/projects/${id}/music`, file, onProgress),
  removeMusic: (id: string) => request<VideoProject>(`/api/video/projects/${id}/music`, { method: 'DELETE' }),
  saveSubtitles: (id: string, subtitles: Subtitle[]) => request<VideoProject>(`/api/video/projects/${id}/subtitles`, json('PUT', { subtitles })),
  srtUrl: (id: string) => `/api/video/projects/${id}/subtitles.srt`,
  render: (id: string, formats: VideoFormat[], quality: 'borrador' | 'final') =>
    request<VideoProject>(`/api/video/projects/${id}/render`, json('POST', { formats, quality })),
  cancelRender: (renderId: string) => request<{ ok: true }>(`/api/video/renders/${renderId}/cancel`, { method: 'POST' }),
  removeRender: (renderId: string) => request<VideoProject>(`/api/video/renders/${renderId}`, { method: 'DELETE' }),
};
