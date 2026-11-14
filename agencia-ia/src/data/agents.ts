/**
 * Definición de los tres agentes de la agencia.
 * Son datos de configuración (identidad, rol, funciones), no resultados de trabajo.
 */

export type AgentId = 'valeria' | 'diego' | 'sofia';

/** Estado REAL de un agente. Lo fija el sistema de tareas (Fase 3); nunca la animación. */
export type AgentStatus = 'disponible' | 'trabajando' | 'esperando_aprobacion' | 'error';

export interface AgentLook {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  hairStyle: 'largo' | 'corto' | 'mono';
  accent: string;
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  specialty: string;
  personality: string;
  functions: string[];
  /** Integraciones que este agente usará; se configuran a partir de la Fase 2. */
  integrations: string[];
  /** Fase del plan en la que el agente empieza a trabajar de verdad. */
  activeFromPhase: number;
  look: AgentLook;
  /** Posición del puesto de trabajo en la oficina (metros). */
  desk: { position: [number, number, number]; rotationY: number };
}

export const AGENTS: AgentDefinition[] = [
  {
    id: 'valeria',
    name: 'Valeria',
    role: 'Productora audiovisual',
    specialty: 'Conceptos publicitarios, guiones y producción de video',
    personality:
      'Creativa y metódica. Piensa en escenas, ritmo y en lo que el público siente en los primeros tres segundos.',
    functions: [
      'Analizar el producto o servicio y el público objetivo',
      'Crear conceptos publicitarios y guiones',
      'Dividir el guion en escenas y redactar prompts audiovisuales',
      'Generar clips con proveedores de IA (previa aprobación de créditos)',
      'Montar, subtitular y exportar en 9:16, 16:9 y 1:1',
    ],
    integrations: ['Claude API', 'Runway', 'FFmpeg (montaje local)', 'Adobe', 'Canva'],
    activeFromPhase: 4,
    look: {
      shirt: '#7c3aed',
      pants: '#1e293b',
      skin: '#e0ac69',
      hair: '#3b2416',
      hairStyle: 'largo',
      accent: '#a78bfa',
    },
    desk: { position: [-4.4, 0, -0.6], rotationY: 0.55 },
  },
  {
    id: 'diego',
    name: 'Diego',
    role: 'Community Manager',
    specialty: 'Publicaciones, calendario editorial y redes sociales',
    personality:
      'Cercano y analítico. Escribe para cada red con su propio tono y cuida que nada salga sin revisión.',
    functions: [
      'Recibir los videos de producción y analizarlos',
      'Redactar títulos, descripciones y hashtags',
      'Armar el calendario editorial y sugerir horarios',
      'Programar publicaciones por API oficial (con aprobación)',
      'Consultar métricas cuando la plataforma lo permita',
    ],
    integrations: ['Claude API', 'Meta Graph API', 'TikTok Content Posting API', 'YouTube Data API'],
    activeFromPhase: 5,
    look: {
      shirt: '#0d9488',
      pants: '#334155',
      skin: '#c68642',
      hair: '#111827',
      hairStyle: 'corto',
      accent: '#2dd4bf',
    },
    desk: { position: [0, 0, -0.6], rotationY: 0.55 },
  },
  {
    id: 'sofia',
    name: 'Sofía',
    role: 'Asistente comercial',
    specialty: 'Ofertas, prospectos, seguimiento y propuestas',
    personality:
      'Organizada y persuasiva sin presionar. Nunca contacta a nadie sin tu autorización expresa.',
    functions: [
      'Crear ofertas y propuestas comerciales',
      'Organizar y clasificar prospectos en el CRM',
      'Redactar mensajes de WhatsApp y respuestas comerciales',
      'Registrar seguimientos y próximos contactos',
      'Preparar informes de oportunidades y ventas',
    ],
    integrations: ['Claude API', 'WhatsApp Business Platform'],
    activeFromPhase: 6,
    look: {
      shirt: '#d97706',
      pants: '#1f2937',
      skin: '#f1c27d',
      hair: '#6b3f1d',
      hairStyle: 'mono',
      accent: '#fbbf24',
    },
    desk: { position: [4.4, 0, -0.6], rotationY: 0.55 },
  },
];

export const AGENT_BY_ID: Record<AgentId, AgentDefinition> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a]),
) as Record<AgentId, AgentDefinition>;

export const STATUS_LABEL: Record<AgentStatus, string> = {
  disponible: 'Disponible',
  trabajando: 'Trabajando',
  esperando_aprobacion: 'Esperando aprobación',
  error: 'Error',
};

export const STATUS_DOT: Record<AgentStatus, string> = {
  disponible: 'bg-emerald-500',
  trabajando: 'bg-sky-500',
  esperando_aprobacion: 'bg-amber-500',
  error: 'bg-rose-500',
};
