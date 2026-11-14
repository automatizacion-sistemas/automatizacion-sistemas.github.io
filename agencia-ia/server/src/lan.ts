import os from 'node:os';
import { randomInt, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Modo celular: permite abrir la oficina desde otros dispositivos de la MISMA red Wi-Fi.
 * Se activa con `npm run celular`. Los accesos que no vienen de la propia laptop necesitan un PIN.
 * El servidor sigue escuchando solo en 127.0.0.1: los demás dispositivos entran a través de la web (Vite),
 * que añade la cabecera X-Forwarded-For con la IP real del dispositivo.
 */
export const LAN_MODE = process.argv.includes('--lan') || process.env.AGENCIA_LAN === '1';

const PIN = (process.env.ACCESS_PIN?.trim() || String(randomInt(100000, 1000000))).slice(0, 32);
const COOKIE = 'agencia_pin';

const PRIVATE_HOST = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/;
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;

/** Direcciones de esta laptop en la red local, para mostrarlas en la consola. */
export function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
    // Primero las de redes domésticas (192.168…, 10…), que son las del Wi-Fi.
    .sort((a, b) => Number(PRIVATE_HOST.test(b)) - Number(PRIVATE_HOST.test(a)));
}

/** IP del dispositivo que hace la petición (la real, no la del proxy de la web). */
function clientIp(req: FastifyRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.ip;
}

export const isRemote = (req: FastifyRequest) => !LOOPBACK.test(clientIp(req));

/**
 * Protección contra páginas web ajenas: solo se aceptan cambios cuyo origen sea esta misma app
 * (la dirección por la que se abrió la oficina) o la propia computadora.
 */
export function originAllowed(origin: string, hostHeader: string | undefined): boolean {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || LOOPBACK.test(host)) return true;
  return LAN_MODE && !!hostHeader && u.host === hostHeader;
}

function hasValidCookie(req: FastifyRequest): boolean {
  const raw = req.headers.cookie ?? '';
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(raw);
  if (!m) return false;
  const a = Buffer.from(decodeURIComponent(m[1]));
  const b = Buffer.from(PIN);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Freno a intentos repetidos de adivinar el PIN.
const fails = new Map<string, { n: number; until: number }>();

export function registerLan(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    if (!isRemote(req)) return;
    if (!LAN_MODE) return reply.code(403).send({ error: 'La app solo acepta conexiones desde esta computadora. Inicia con "npm run celular".' });
    if (req.url.startsWith('/api/acceso')) return;
    if (!hasValidCookie(req)) return reply.code(401).send({ error: 'Ingresa el PIN de acceso.', code: 'pin_requerido' });
  });

  app.post<{ Body: { pin?: string } }>('/api/acceso', async (req, reply) => {
    const ip = clientIp(req);
    const f = fails.get(ip);
    if (f && f.until > Date.now()) return reply.code(429).send({ error: 'Demasiados intentos. Espera 5 minutos.' });
    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const ok = pin.length === PIN.length && timingSafeEqual(Buffer.from(pin), Buffer.from(PIN));
    if (!ok) {
      const n = (f?.n ?? 0) + 1;
      fails.set(ip, { n, until: n >= 8 ? Date.now() + 5 * 60_000 : 0 });
      return reply.code(401).send({ error: 'PIN incorrecto.', code: 'pin_requerido' });
    }
    fails.delete(ip);
    reply.header('Set-Cookie', `${COOKIE}=${encodeURIComponent(PIN)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`);
    return { ok: true };
  });
}

export function lanBanner(webPort = 5173): string {
  if (!LAN_MODE) return '';
  const ips = lanAddresses();
  const urls = ips.length ? ips.map((ip) => `      http://${ip}:${webPort}`).join('\n') : '      (no se encontró una red Wi-Fi; revisa tu conexión)';
  return `\n  📱 MODO CELULAR ACTIVO · abre en el navegador del celular (misma red Wi-Fi):\n${urls}\n     PIN de acceso: ${PIN}${process.env.ACCESS_PIN ? ' (definido en .env)' : ' (cambia en cada inicio; fija uno con ACCESS_PIN en .env)'}\n`;
}
