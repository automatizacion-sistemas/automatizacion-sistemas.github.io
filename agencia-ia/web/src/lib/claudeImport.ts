/**
 * "Importar desde Claude": puente gratuito entre el chat de Claude del usuario y la oficina.
 * La app genera una instrucción para pegar en Claude; Claude responde con un bloque JSON;
 * el usuario lo pega aquí, revisa la vista previa e importa. No se usa la API de pago.
 */
import {
  NETWORKS,
  PRIORITIES,
  STAGES,
  calendar,
  crm,
  type Business,
  type BusinessInput,
  type NetworkId,
  type Priority,
  type Stage,
} from './api';

export type ImportKind = 'calendario' | 'tareas' | 'prospectos' | 'plantillas' | 'ficha';

export interface Row {
  /** Valores normalizados listos para guardar. */
  data: Record<string, unknown>;
  /** Columnas que se muestran en la vista previa. */
  preview: string[];
  error: string | null;
}

export interface KindDef {
  title: string;
  agent: string;
  columns: string[];
  prompt: (b: Business) => string;
  normalize: (item: Record<string, unknown>) => Row;
}

// ------------------------------------------------------------------ utilidades

const pad = (n: number) => String(n).padStart(2, '0');
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "Teléfono móvil" → "telefono_movil" */
const keyOf = (k: string) =>
  k
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const plain = (v: string) => keyOf(v).replace(/_/g, ' ');

function pick(item: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) if (n in item && item[n] !== null && item[n] !== '') return item[n];
  return undefined;
}

const str = (v: unknown, max = 6000): string => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(' ').slice(0, max).trim();
  return String(v).trim().slice(0, max);
};

/** Acepta 2026-11-20, 20/11/2026, 20-11-2026 y 20/11 (año actual). */
export function parseDate(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return valid(y, +m[2], +m[1]);
  }
  return null;
}
function valid(y: number, mo: number, d: number) {
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

/** Acepta 19:00, 7:00 pm, 7 pm, 19h. Devuelve '' si no hay hora. */
export function parseTime(v: unknown): string | null {
  const s = str(v).toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';
  const m = /^(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|h)?$/.exec(s);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  const ap = m[3]?.replace(/[.\s]/g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

function oneOf<T extends string>(v: unknown, options: { id: T; label: string }[], aliases: Record<string, T> = {}): T | null {
  const s = plain(str(v));
  if (!s) return null;
  for (const o of options) if (plain(o.id) === s || plain(o.label) === s) return o.id;
  for (const [a, id] of Object.entries(aliases)) if (s.includes(a)) return id;
  return null;
}

/** Extrae el arreglo JSON de la respuesta de Claude (con o sin ```json, con texto alrededor). */
export function extractItems(raw: string): { items: Record<string, unknown>[] } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: 'Pega la respuesta de Claude.' };
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.search(/[[{]/);
    const end = Math.max(c.lastIndexOf(']'), c.lastIndexOf('}'));
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(c.slice(start, end + 1).replace(/,\s*([\]}])/g, '$1'));
      const arr = Array.isArray(parsed)
        ? parsed
        : Object.values(parsed as Record<string, unknown>).find(Array.isArray) ?? [parsed];
      const items = (arr as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x))
        .map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [keyOf(k), v])));
      if (items.length) return { items };
    } catch {
      /* se prueba el siguiente candidato */
    }
  }
  return {
    error:
      'No encontré un bloque JSON válido en el texto. Pídele a Claude: "Responde solo con el bloque JSON, sin texto adicional" y vuelve a pegarlo.',
  };
}

const header = (b: Business) =>
  `Estoy usando una app llamada "Mi Agencia IA" para organizar el trabajo de mi negocio "${b.name}". ` +
  `Con todo lo que hemos trabajado en este chat o proyecto, prepárame la información en el formato exacto que indico. ` +
  `Hoy es ${todayIso()}. Usa fechas en formato AAAA-MM-DD y horas en formato 24 h (HH:MM).`;

const footer = `\n\nResponde SOLO con un bloque de código JSON (un arreglo de objetos), sin explicaciones antes ni después. Si un dato no existe, deja el texto vacío "" en lugar de inventarlo.`;

// ------------------------------------------------------------------ definiciones

export const KINDS: Record<ImportKind, KindDef> = {
  calendario: {
    title: 'Calendario de publicaciones',
    agent: 'Diego',
    columns: ['Fecha', 'Hora', 'Red', 'Título', 'Texto'],
    prompt: (b) =>
      `${header(b)}\n\nNecesito el CALENDARIO DE PUBLICACIONES. Un objeto por cada publicación y por cada red social:\n` +
      '```json\n[\n  {\n    "fecha": "AAAA-MM-DD",\n    "hora": "19:00",\n    "red": "instagram | facebook | tiktok | youtube",\n    "titulo": "nombre corto de la publicación (en YouTube, el título del video)",\n    "texto": "texto completo de la publicación",\n    "hashtags": "#ejemplo #otro",\n    "material": "qué imagen o video lleva"\n  }\n]\n```' +
      footer,
    normalize: (it) => {
      const date = parseDate(pick(it, 'fecha', 'date', 'dia'));
      const time = parseTime(pick(it, 'hora', 'time', 'horario'));
      const network = oneOf<NetworkId>(pick(it, 'red', 'red_social', 'plataforma', 'network', 'canal'), NETWORKS.map((n) => ({ id: n.id, label: n.label })), {
        insta: 'instagram',
        ig: 'instagram',
        face: 'facebook',
        fb: 'facebook',
        tik: 'tiktok',
        you: 'youtube',
        yt: 'youtube',
        short: 'youtube',
        reel: 'instagram',
      });
      const title = str(pick(it, 'titulo', 'title', 'tema', 'nombre'), 200);
      const body = str(pick(it, 'texto', 'copy', 'descripcion', 'caption', 'contenido', 'text'), 63000);
      const tags = pick(it, 'hashtags', 'etiquetas', 'tags');
      const hashtags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ') : str(tags, 2000);
      const media = str(pick(it, 'material', 'media', 'recurso', 'imagen', 'video', 'formato'), 1000);
      const error = !date
        ? 'Fecha no válida'
        : time === null
          ? 'Hora no válida'
          : !network
            ? 'Red no reconocida (usa instagram, facebook, tiktok o youtube)'
            : !title && !body
              ? 'Sin título ni texto'
              : null;
      return {
        data: { date, time: time ?? '', network, title, body, hashtags, media },
        preview: [date ?? str(pick(it, 'fecha')), time ?? '', network ?? str(pick(it, 'red')), title, body],
        error,
      };
    },
  },

  tareas: {
    title: 'Plan de trabajo (tareas)',
    agent: 'el equipo',
    columns: ['Responsable', 'Tarea', 'Fecha límite', 'Prioridad'],
    prompt: (b) =>
      `${header(b)}\n\nNecesito el PLAN DE TRABAJO como lista de tareas, en el orden en que deben hacerse. ` +
      `Asigna cada tarea a uno de estos responsables: "sofia" (asistente comercial: ofertas, prospectos, WhatsApp, seguimiento), ` +
      `"valeria" (productora audiovisual: guiones, videos, imágenes), "diego" (community manager: publicaciones, calendario, redes) ` +
      `o "yo" (lo que debo hacer o aprobar personalmente):\n` +
      '```json\n[\n  {\n    "responsable": "sofia | valeria | diego | yo",\n    "titulo": "tarea concreta",\n    "descripcion": "detalle, entregable esperado",\n    "fecha_limite": "AAAA-MM-DD",\n    "prioridad": "alta | normal | baja"\n  }\n]\n```' +
      footer,
    normalize: (it) => {
      const agentId = oneOf(pick(it, 'responsable', 'asignado', 'agente', 'encargado', 'quien'), [
        { id: 'sofia', label: 'Sofia' },
        { id: 'valeria', label: 'Valeria' },
        { id: 'diego', label: 'Diego' },
        { id: 'usuario', label: 'yo' },
      ], {
        comercial: 'sofia',
        venta: 'sofia',
        audiovisual: 'valeria',
        video: 'valeria',
        product: 'valeria',
        community: 'diego',
        redes: 'diego',
        cm: 'diego',
        usuario: 'usuario',
        cliente: 'usuario',
        tu: 'usuario',
        due: 'usuario',
      });
      const title = str(pick(it, 'titulo', 'tarea', 'title', 'nombre'), 200);
      const dueRaw = pick(it, 'fecha_limite', 'fecha', 'vence', 'plazo', 'due_date');
      const dueDate = parseDate(dueRaw);
      const priority = oneOf(pick(it, 'prioridad', 'priority'), [
        { id: 'alta', label: 'Alta' },
        { id: 'normal', label: 'Normal' },
        { id: 'baja', label: 'Baja' },
      ], { media: 'normal', urgente: 'alta' }) ?? 'normal';
      const NAMES: Record<string, string> = { sofia: 'Sofía', valeria: 'Valeria', diego: 'Diego', usuario: 'Tú' };
      return {
        data: { agentId, title, description: str(pick(it, 'descripcion', 'detalle', 'description', 'entregable')), dueDate, priority },
        preview: [agentId ? NAMES[agentId] : str(pick(it, 'responsable')), title, dueDate ?? (dueRaw ? `${str(dueRaw)} (no válida)` : ''), priority],
        error: !title ? 'Sin título' : !agentId ? 'Responsable no reconocido' : null,
      };
    },
  },

  prospectos: {
    title: 'Prospectos (CRM)',
    agent: 'Sofía',
    columns: ['Nombre', 'Empresa', 'Teléfono', 'Estado', 'Próximo seguimiento'],
    prompt: (b) =>
      `${header(b)}\n\nNecesito la LISTA DE PROSPECTOS o clientes potenciales que hemos identificado. Usa solo datos reales que te haya dado; no inventes teléfonos ni correos:\n` +
      '```json\n[\n  {\n    "nombre": "",\n    "empresa": "",\n    "telefono": "con código de país, ej. +51 987 654 321",\n    "correo": "",\n    "servicio": "servicio de interés",\n    "estado": "nuevo | contactado | interesado | propuesta | negociacion | ganado | perdido",\n    "clasificacion": "caliente | tibio | frio",\n    "proximo_seguimiento": "AAAA-MM-DD",\n    "observaciones": ""\n  }\n]\n```' +
      footer,
    normalize: (it) => {
      const name = str(pick(it, 'nombre', 'name', 'contacto', 'prospecto'), 160);
      const stage = (oneOf<Stage>(pick(it, 'estado', 'etapa', 'status', 'estado_comercial'), STAGES.map((s) => ({ id: s.id, label: s.label })), {
        propuesta: 'propuesta',
        negoci: 'negociacion',
        cerrado: 'ganado',
        cliente: 'ganado',
        descart: 'perdido',
      }) ?? 'nuevo') as Stage;
      const priority = (oneOf<Priority>(pick(it, 'clasificacion', 'prioridad', 'temperatura'), PRIORITIES.map((p) => ({ id: p.id, label: p.label })), {
        alta: 'caliente',
        media: 'tibio',
        baja: 'frio',
      }) ?? 'tibio') as Priority;
      const email = str(pick(it, 'correo', 'email', 'mail', 'correo_electronico'), 200);
      const next = parseDate(pick(it, 'proximo_seguimiento', 'seguimiento', 'fecha_seguimiento', 'next'));
      return {
        data: {
          name,
          company: str(pick(it, 'empresa', 'company', 'negocio'), 160),
          phone: str(pick(it, 'telefono', 'celular', 'whatsapp', 'phone', 'movil'), 40),
          email,
          service: str(pick(it, 'servicio', 'servicio_de_interes', 'interes', 'producto'), 200),
          contactDate: parseDate(pick(it, 'fecha_contacto', 'fecha_de_contacto', 'contacto_fecha')) ?? todayIso(),
          stage,
          priority,
          nextFollowup: next,
          notes: str(pick(it, 'observaciones', 'notas', 'comentarios', 'notes')),
        },
        preview: [name, str(pick(it, 'empresa', 'company')), str(pick(it, 'telefono', 'celular', 'whatsapp')), STAGES.find((s) => s.id === stage)!.label, next ?? ''],
        error: !name ? 'Sin nombre' : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Correo no válido' : null,
      };
    },
  },

  plantillas: {
    title: 'Plantillas de mensajes (WhatsApp)',
    agent: 'Sofía',
    columns: ['Nombre', 'Mensaje'],
    prompt: (b) =>
      `${header(b)}\n\nNecesito PLANTILLAS DE MENSAJES DE WHATSAPP para prospectos y clientes (primer contacto, seguimiento, envío de propuesta, recordatorio, etc.). ` +
      `Puedes usar estas variables, que la app reemplaza sola: {nombre} (nombre del prospecto), {empresa}, {servicio} y {negocio}:\n` +
      '```json\n[\n  {\n    "nombre": "Primer contacto",\n    "texto": "Hola {nombre}, te saluda el equipo de {negocio}..."\n  }\n]\n```' +
      footer,
    normalize: (it) => {
      const name = str(pick(it, 'nombre', 'titulo', 'name', 'tipo'), 120);
      const body = str(pick(it, 'texto', 'mensaje', 'body', 'contenido'), 4000);
      return { data: { name, body }, preview: [name, body], error: !name || !body ? 'Falta nombre o texto' : null };
    },
  },

  ficha: {
    title: 'Ficha del negocio',
    agent: 'todos los agentes',
    columns: ['Campo', 'Valor'],
    prompt: (b) =>
      `${header(b)}\n\nNecesito la FICHA DEL NEGOCIO, resumida para que la use todo el equipo:\n` +
      '```json\n[\n  {\n    "nombre": "nombre comercial",\n    "descripcion": "",\n    "productos": "un producto o servicio por línea, con precio si lo hay",\n    "publico": "público objetivo",\n    "objetivos": "objetivos comerciales",\n    "colores": ["#123456", "#abcdef"],\n    "facebook": "", "instagram": "", "tiktok": "", "youtube": "", "whatsapp": "", "web": ""\n  }\n]\n```' +
      footer,
    normalize: (it) => {
      const colorsRaw = pick(it, 'colores', 'colors', 'colores_corporativos');
      const colors = (Array.isArray(colorsRaw) ? colorsRaw.map(String) : str(colorsRaw).split(/[\s,;]+/))
        .map((c) => c.trim())
        .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
        .slice(0, 6);
      const productsRaw = pick(it, 'productos', 'servicios', 'productos_y_servicios');
      const data: Partial<BusinessInput> = {
        name: str(pick(it, 'nombre', 'nombre_comercial', 'negocio'), 120),
        description: str(pick(it, 'descripcion', 'description'), 4000),
        products: Array.isArray(productsRaw) ? productsRaw.map((p) => (typeof p === 'object' ? Object.values(p as object).join(' – ') : String(p))).join('\n') : str(productsRaw),
        audience: str(pick(it, 'publico', 'publico_objetivo', 'audiencia', 'clientes'), 4000),
        goals: str(pick(it, 'objetivos', 'objetivos_comerciales', 'metas'), 4000),
        colors,
        socials: Object.fromEntries(
          (['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'web'] as const)
            .map((k) => [k, str(pick(it, k), 300)])
            .filter(([, v]) => v),
        ),
      };
      return {
        data: data as Record<string, unknown>,
        preview: ['Ficha', [data.name, data.description].filter(Boolean).join(' — ')],
        error: null,
      };
    },
  },
};

/** Guarda las filas válidas. Devuelve cuántas se crearon y los errores del servidor. */
export async function importRows(
  kind: Exclude<ImportKind, 'ficha' | 'tareas'>,
  business: Business,
  rows: Row[],
  onProgress: (done: number) => void,
): Promise<{ created: number; failed: string[] }> {
  let created = 0;
  const failed: string[] = [];
  for (const [i, r] of rows.entries()) {
    try {
      const d = r.data as Record<string, string | null>;
      if (kind === 'calendario')
        await calendar.create(
          business.id,
          { date: d.date!, time: d.time ?? '', title: d.title ?? '', body: d.body ?? '', hashtags: d.hashtags ?? '', media: d.media ?? '', owner: 'diego' },
          [d.network as NetworkId],
        );
      else if (kind === 'prospectos')
        await crm.createProspect(business.id, r.data as unknown as Parameters<typeof crm.createProspect>[1]);
      else await crm.createTemplate(business.id, { name: d.name!, body: d.body! });
      created += 1;
    } catch (e) {
      failed.push(`Fila ${i + 1}: ${(e as Error).message}`);
    }
    onProgress(i + 1);
  }
  return { created, failed };
}

