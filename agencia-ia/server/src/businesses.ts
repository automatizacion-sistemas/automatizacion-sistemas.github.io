import fs from 'node:fs';
import path from 'node:path';
import { db, getSetting, newId, now, setSetting, UPLOADS_DIR } from './db.js';

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

export interface BusinessInput {
  name: string;
  description: string;
  products: string;
  audience: string;
  goals: string;
  colors: string[];
  socials: Socials;
}

interface Row {
  id: string;
  name: string;
  description: string;
  products: string;
  audience: string;
  goals: string;
  colors: string;
  socials: string;
  logo_file: string | null;
  created_at: string;
  updated_at: string;
}

const toBusiness = (r: Row): Business => ({
  id: r.id,
  name: r.name,
  description: r.description,
  products: r.products,
  audience: r.audience,
  goals: r.goals,
  colors: JSON.parse(r.colors),
  socials: JSON.parse(r.socials),
  hasLogo: Boolean(r.logo_file),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const SOCIAL_KEYS: (keyof Socials)[] = ['facebook', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'web'];

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valida y normaliza lo que llega del formulario. Devuelve un mensaje de error o los datos limpios. */
export function parseBusinessInput(body: unknown): { error: string } | { data: BusinessInput } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name, 120);
  if (!name) return { error: 'El nombre comercial es obligatorio.' };
  const colors = Array.isArray(b.colors) ? b.colors.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 6) : [];
  const rawSocials = (b.socials ?? {}) as Record<string, unknown>;
  const socials: Socials = {};
  for (const k of SOCIAL_KEYS) {
    const v = text(rawSocials[k], 300);
    if (v) socials[k] = v;
  }
  return {
    data: {
      name,
      description: text(b.description, 4000),
      products: text(b.products, 6000),
      audience: text(b.audience, 4000),
      goals: text(b.goals, 4000),
      colors,
      socials,
    },
  };
}

export function listBusinesses(): Business[] {
  return (db.prepare('SELECT * FROM businesses ORDER BY name COLLATE NOCASE').all() as unknown as Row[]).map(toBusiness);
}

export function getBusiness(id: string): Business | null {
  const r = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id) as unknown as Row | undefined;
  return r ? toBusiness(r) : null;
}

export function createBusiness(input: BusinessInput): Business {
  const id = newId();
  const t = now();
  db.prepare(
    `INSERT INTO businesses (id, name, description, products, audience, goals, colors, socials, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name, input.description, input.products, input.audience, input.goals, JSON.stringify(input.colors), JSON.stringify(input.socials), t, t);
  if (!getSetting('active_business_id')) setSetting('active_business_id', id);
  return getBusiness(id)!;
}

export function updateBusiness(id: string, input: BusinessInput): Business | null {
  const res = db
    .prepare(
      `UPDATE businesses SET name = ?, description = ?, products = ?, audience = ?, goals = ?, colors = ?, socials = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(input.name, input.description, input.products, input.audience, input.goals, JSON.stringify(input.colors), JSON.stringify(input.socials), now(), id);
  return res.changes ? getBusiness(id) : null;
}

export function deleteBusiness(id: string): boolean {
  const row = db.prepare('SELECT logo_file FROM businesses WHERE id = ?').get(id) as { logo_file: string | null } | undefined;
  if (!row) return false;
  db.prepare('DELETE FROM businesses WHERE id = ?').run(id);
  if (row.logo_file) fs.rmSync(path.join(UPLOADS_DIR, row.logo_file), { force: true });
  if (getSetting('active_business_id') === id) {
    const next = db.prepare('SELECT id FROM businesses ORDER BY name COLLATE NOCASE LIMIT 1').get() as { id: string } | undefined;
    setSetting('active_business_id', next?.id ?? null);
  }
  return true;
}

export const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export function saveLogo(id: string, mime: string, data: Buffer): boolean {
  const ext = LOGO_TYPES[mime];
  if (!ext) return false;
  const row = db.prepare('SELECT logo_file FROM businesses WHERE id = ?').get(id) as { logo_file: string | null } | undefined;
  if (!row) return false;
  if (row.logo_file) fs.rmSync(path.join(UPLOADS_DIR, row.logo_file), { force: true });
  const file = `logo-${id}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, file), data);
  db.prepare('UPDATE businesses SET logo_file = ?, updated_at = ? WHERE id = ?').run(file, now(), id);
  return true;
}

export function logoPath(id: string): { file: string; mime: string } | null {
  const row = db.prepare('SELECT logo_file FROM businesses WHERE id = ?').get(id) as { logo_file: string | null } | undefined;
  if (!row?.logo_file) return null;
  const ext = path.extname(row.logo_file).slice(1);
  const mime = Object.entries(LOGO_TYPES).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
  return { file: path.join(UPLOADS_DIR, row.logo_file), mime };
}

export function getActiveBusinessId(): string | null {
  const id = getSetting('active_business_id');
  return id && getBusiness(id) ? id : null;
}

export function setActiveBusinessId(id: string): boolean {
  if (!getBusiness(id)) return false;
  setSetting('active_business_id', id);
  return true;
}

/** Ficha del negocio como contexto para los agentes. */
export function businessBrief(b: Business): string {
  const socials = Object.entries(b.socials)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  const lines = [
    `Negocio para el que trabajas ahora: ${b.name}`,
    b.description && `Descripción: ${b.description}`,
    b.products && `Productos y servicios: ${b.products}`,
    b.audience && `Público objetivo: ${b.audience}`,
    b.goals && `Objetivos comerciales: ${b.goals}`,
    b.colors.length ? `Colores corporativos: ${b.colors.join(', ')}` : '',
    socials && `Redes sociales: ${socials}`,
  ].filter(Boolean);
  return lines.join('\n');
}
