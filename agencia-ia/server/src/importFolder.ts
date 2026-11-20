import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { getSetting, setSetting } from './db.js';
import { isRemote } from './lan.js';

/**
 * Carpeta de importación: otra herramienta (por ejemplo, Claude con acceso a tus archivos)
 * deja archivos JSON en una carpeta de la laptop y la app los lee al pulsar "Importar".
 * Solo se leen nombres de archivo fijos dentro de esa carpeta; nunca rutas arbitrarias.
 */

/** Nombres aceptados por sección, en orden de preferencia. */
export const IMPORT_FILES: Record<string, string[]> = {
  calendario: ['diego.json', 'calendario.json'],
  tareas: ['tareas.json', 'plan.json'],
  prospectos: ['sofia.json', 'prospectos.json'],
  plantillas: ['sofia-plantillas.json', 'plantillas.json'],
  ficha: ['negocio.json', 'ficha.json'],
  subtitulos: ['valeria.json', 'subtitulos.json'],
};

const MAX_BYTES = 5 * 1024 * 1024;

function currentDir(): string | null {
  return getSetting('import_dir') ?? (process.env.IMPORT_DIR?.trim() || null);
}

function describe(dir: string | null) {
  const exists = !!dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  const files = exists
    ? Object.entries(IMPORT_FILES).flatMap(([kind, names]) =>
        names
          .map((n) => path.join(dir!, n))
          .filter((f) => fs.existsSync(f))
          .map((f) => {
            const st = fs.statSync(f);
            return { kind, name: path.basename(f), size: st.size, modifiedAt: st.mtime.toISOString() };
          }),
      )
    : [];
  return { dir, exists, files, names: IMPORT_FILES };
}

export function registerImportFolder(app: FastifyInstance) {
  app.get('/api/import/config', async () => describe(currentDir()));

  app.put<{ Body: { dir?: string } }>('/api/import/config', async (req, reply) => {
    // Elegir la carpeta solo se permite desde la propia laptop, no desde el celular.
    if (isRemote(req)) return reply.code(403).send({ error: 'La carpeta de importación solo se puede cambiar desde la laptop.' });
    const raw = typeof req.body?.dir === 'string' ? req.body.dir.trim().replace(/^"+|"+$/g, '') : '';
    if (!raw) {
      setSetting('import_dir', null);
      return describe(currentDir());
    }
    const dir = path.resolve(raw);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
      return reply.code(400).send({ error: `No existe la carpeta "${dir}". Revisa la ruta (puedes copiarla desde la barra de direcciones del Explorador).` });
    setSetting('import_dir', dir);
    return describe(dir);
  });

  app.get<{ Querystring: { kind?: string } }>('/api/import/file', async (req, reply) => {
    const names = req.query.kind ? IMPORT_FILES[req.query.kind] : undefined;
    if (!names) return reply.code(400).send({ error: 'Sección no válida.' });
    const dir = currentDir();
    if (!dir || !fs.existsSync(dir)) return reply.code(404).send({ error: 'Primero indica la carpeta de importación.' });
    for (const n of names) {
      const f = path.join(dir, n);
      if (!fs.existsSync(f)) continue;
      const st = fs.statSync(f);
      if (st.size > MAX_BYTES) return reply.code(400).send({ error: `${n} pesa más de 5 MB.` });
      const content = fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
      return { name: n, modifiedAt: st.mtime.toISOString(), content };
    }
    return reply.code(404).send({ error: `No hay ${names.join(' ni ')} en la carpeta.` });
  });
}
