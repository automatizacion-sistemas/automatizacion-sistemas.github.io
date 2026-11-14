import { checkClaude, type IntegrationState } from './claude.js';

export interface IntegrationInfo {
  id: string;
  name: string;
  purpose: string;
  agents: string[];
  state: IntegrationState;
  detail: string;
  /** Lo que el usuario necesita tener para conectarla. */
  requirements: string[];
  /** Fase del plan en la que se conecta. */
  phase: number;
  /** Saldo o límites, solo si el proveedor los informa por API. */
  credits: string;
  docsUrl: string;
}

const PENDING: Omit<IntegrationInfo, 'state' | 'detail'>[] = [
  {
    id: 'runway',
    name: 'Runway',
    purpose: 'Generación de clips de video con IA',
    agents: ['Valeria'],
    requirements: ['Cuenta de desarrollador en Runway API', 'Créditos prepagados', 'Clave API'],
    phase: 4,
    credits: 'Runway informa el saldo de créditos por API; se mostrará al conectarla.',
    docsUrl: 'https://docs.dev.runwayml.com/',
  },
  {
    id: 'ffmpeg',
    name: 'FFmpeg (montaje local)',
    purpose: 'Unir clips, subtítulos, música y exportar 9:16, 16:9 y 1:1',
    agents: ['Valeria'],
    requirements: ['FFmpeg instalado en tu computadora (gratis)'],
    phase: 4,
    credits: 'No aplica: se ejecuta en tu computadora.',
    docsUrl: 'https://ffmpeg.org/download.html',
  },
  {
    id: 'adobe',
    name: 'Adobe Firefly Services',
    purpose: 'Herramientas creativas de Adobe por API',
    agents: ['Valeria'],
    requirements: ['Contrato empresarial de Firefly Services (no disponible en planes personales)'],
    phase: 4,
    credits: 'Depende del contrato.',
    docsUrl: 'https://developer.adobe.com/firefly-services/docs/',
  },
  {
    id: 'canva',
    name: 'Canva Connect',
    purpose: 'Diseños y plantillas de marca',
    agents: ['Valeria', 'Diego'],
    requirements: ['Cuenta de Canva', 'Integración privada creada en el portal de desarrolladores de Canva'],
    phase: 4,
    credits: 'Canva no informa saldo por API.',
    docsUrl: 'https://www.canva.dev/docs/connect/',
  },
  {
    id: 'meta',
    name: 'Meta Graph API (Facebook e Instagram)',
    purpose: 'Publicar, programar y leer métricas',
    agents: ['Diego'],
    requirements: [
      'App en Meta for Developers',
      'Página de Facebook',
      'Cuenta profesional de Instagram vinculada a la página',
      'Revisión de la app (App Review) para publicar en cuentas de clientes',
    ],
    phase: 5,
    credits: 'Gratis; Meta aplica límites de publicaciones por día.',
    docsUrl: 'https://developers.facebook.com/docs/graph-api/',
  },
  {
    id: 'tiktok',
    name: 'TikTok Content Posting API',
    purpose: 'Publicar videos en TikTok',
    agents: ['Diego'],
    requirements: ['App en TikTok for Developers', 'Auditoría de la app (sin ella solo publica en privado)'],
    phase: 5,
    credits: 'Gratis; TikTok aplica límites de publicación.',
    docsUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started/',
  },
  {
    id: 'youtube',
    name: 'YouTube Data API',
    purpose: 'Subir videos y leer métricas',
    agents: ['Diego'],
    requirements: ['Proyecto en Google Cloud', 'Verificación del proyecto (sin ella los videos quedan privados)'],
    phase: 5,
    credits: 'Cuota gratuita diaria (aprox. 6 subidas por día).',
    docsUrl: 'https://developers.google.com/youtube/v3',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business Platform',
    purpose: 'Mensajes comerciales con aprobación previa',
    agents: ['Sofía'],
    requirements: ['Meta Business verificado', 'Número dedicado', 'Plantillas de mensaje aprobadas'],
    phase: 6,
    credits: 'Se cobra por mensaje de plantilla según el país.',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
  },
];

export async function listIntegrations(forceClaude = false): Promise<IntegrationInfo[]> {
  const claude = await checkClaude(forceClaude);
  return [
    {
      id: 'claude',
      name: 'Claude API (Anthropic)',
      purpose: `Inteligencia de los tres agentes · modelo ${claude.model}, esfuerzo ${claude.effort}`,
      agents: ['Valeria', 'Diego', 'Sofía'],
      state: claude.state,
      detail: claude.detail,
      requirements: ['Cuenta en console.anthropic.com', 'Saldo prepagado', 'Clave API guardada en el archivo .env'],
      phase: 2,
      credits: 'Anthropic no informa el saldo por API: revísalo en console.anthropic.com → Billing. Abajo ves el gasto estimado que registra la app.',
      docsUrl: 'https://console.anthropic.com/settings/keys',
    },
    ...PENDING.map((p) => ({ ...p, state: 'desconectado' as const, detail: `Se conecta en la Fase ${p.phase}.` })),
  ];
}
