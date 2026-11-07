/* ==========================================================================
   sqlite.js — Motor de base de datos compartido por todas las demos
   ---------------------------------------------------------------------------
   · Carga sql.js (SQLite compilado a WebAssembly). Si el navegador no admite
     WebAssembly, usa la versión JavaScript pura (sql-asm.js).
   · Guarda la base en el IndexedDB del navegador del visitante: cada persona
     trabaja con su propia copia y nada se envía a ningún servidor.

   Uso:
     const base = await SQLiteDemo.crear({
       idb: "demo-inventario",          // nombre único por demo
       esquema: "CREATE TABLE ...",     // SQL para crear las tablas
       sembrar: function (base) {...}   // carga los datos de ejemplo
     });
     base.consultar(sql, params) → filas   base.uno(sql, params) → fila | null
     base.ejecutar(sql, params)            base.preparar(sql) → sentencia sql.js
     base.guardar()  base.reiniciar()  base.exportar() → Uint8Array
     base.esPersistente()  base.nuevo (true si se cargaron datos de ejemplo)
   ========================================================================== */
window.SQLiteDemo = (function () {
  "use strict";

  // Carpeta de las librerías, calculada a partir de la ubicación de este archivo
  const LIB = new URL("../lib/", document.currentScript.src).href;
  const ALMACEN = "archivos", CLAVE = "base.sqlite";
  let moduloSQL = null;

  function cargarScript(src) {
    return new Promise(function (ok, error) {
      const s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = error;
      document.head.appendChild(s);
    });
  }

  async function cargarSQL() {
    if (moduloSQL) return moduloSQL;
    try {
      if (typeof window.initSqlJs !== "function") await cargarScript(LIB + "sql-wasm.js");
      moduloSQL = await window.initSqlJs({ locateFile: function (f) { return LIB + f; } });
    } catch (e) {
      console.warn("WebAssembly no disponible, se usa la versión JavaScript de SQLite.", e);
      window.initSqlJs = undefined;
      await cargarScript(LIB + "sql-asm.js");
      moduloSQL = await window.initSqlJs();
    }
    return moduloSQL;
  }

  /* ---------- IndexedDB ---------- */
  function abrirIDB(nombre) {
    return new Promise(function (ok, error) {
      try {
        const req = indexedDB.open(nombre, 1);
        req.onupgradeneeded = function () { req.result.createObjectStore(ALMACEN); };
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { error(req.error); };
      } catch (e) { error(e); }
    });
  }
  async function leer(nombre) {
    try {
      const idb = await abrirIDB(nombre);
      return await new Promise(function (ok) {
        const req = idb.transaction(ALMACEN, "readonly").objectStore(ALMACEN).get(CLAVE);
        req.onsuccess = function () { ok(req.result || null); };
        req.onerror = function () { ok(null); };
      });
    } catch (e) { return null; }
  }
  async function escribir(nombre, bytes) {
    const idb = await abrirIDB(nombre);
    await new Promise(function (ok, error) {
      const tx = idb.transaction(ALMACEN, "readwrite");
      tx.objectStore(ALMACEN).put(bytes, CLAVE);
      tx.oncomplete = ok; tx.onerror = function () { error(tx.error); };
    });
  }
  async function borrar(nombre) {
    try {
      const idb = await abrirIDB(nombre);
      await new Promise(function (ok) {
        const tx = idb.transaction(ALMACEN, "readwrite");
        tx.objectStore(ALMACEN).delete(CLAVE);
        tx.oncomplete = ok; tx.onerror = ok;
      });
    } catch (e) { /* sin almacenamiento disponible */ }
  }

  /* ---------- Fábrica de bases de datos ---------- */
  async function crear(opciones) {
    const SQL = await cargarSQL();
    let db = null, persistente = false, temporizador = null;

    const base = {
      nuevo: false,
      consultar: function (sql, params) {
        const stmt = db.prepare(sql);
        try {
          if (params) stmt.bind(params);
          const filas = [];
          while (stmt.step()) filas.push(stmt.getAsObject());
          return filas;
        } finally { stmt.free(); }
      },
      uno: function (sql, params) { return base.consultar(sql, params)[0] || null; },
      ejecutar: function (sql, params) { db.run(sql, params || []); },
      preparar: function (sql) { return db.prepare(sql); },
      ultimoId: function () { return base.uno("SELECT last_insert_rowid() AS id").id; },

      /** Guarda en IndexedDB; agrupa los cambios seguidos en una sola escritura */
      guardar: function () {
        clearTimeout(temporizador);
        temporizador = setTimeout(async function () {
          try {
            await escribir(opciones.idb, base.exportar());
            persistente = true;
          } catch (e) {
            persistente = false;
            console.warn("No se pudo guardar en este navegador:", e);
          }
        }, 300);
      },
      exportar: function () {
        const bytes = db.export();               // export() reabre la conexión…
        db.exec("PRAGMA foreign_keys = ON;");    // …y hay que reactivar las claves foráneas
        return bytes;
      },
      reiniciar: async function () {
        clearTimeout(temporizador);
        await borrar(opciones.idb);
        db.close();
        nueva();
        base.guardar();
      },
      esPersistente: function () { return persistente; }
    };

    function nueva() {
      db = new SQL.Database();
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec(opciones.esquema);
      db.exec("BEGIN");
      try {
        opciones.sembrar(base);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }

    const guardado = await leer(opciones.idb);
    if (guardado) {
      db = new SQL.Database(guardado);
      db.exec("PRAGMA foreign_keys = ON;");
      persistente = true;
    } else {
      nueva();
      base.nuevo = true;
      base.guardar();
    }
    return base;
  }

  /* ---------- Fechas (formato AAAA-MM-DD en hora local) ---------- */
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function hoy() { return iso(new Date()); }
  function sumarDias(fechaIso, dias) {
    const d = new Date(fechaIso + "T00:00:00"); d.setDate(d.getDate() + dias); return iso(d);
  }
  function diasEntre(desdeIso, hastaIso) {
    return Math.round((new Date(hastaIso + "T00:00:00") - new Date(desdeIso + "T00:00:00")) / 86400000);
  }

  /** Generador pseudoaleatorio con semilla: los datos de ejemplo salen siempre iguales */
  function semilla(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { crear: crear, iso: iso, hoy: hoy, sumarDias: sumarDias, diasEntre: diasEntre, semilla: semilla, LIB: LIB };
})();
