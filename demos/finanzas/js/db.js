/* ==========================================================================
   db.js — Base de datos y reglas de negocio: control de ingresos y gastos
   ---------------------------------------------------------------------------
   · Cuatro tipos de movimiento:
       INGRESO        dinero que entra por la actividad del negocio
       GASTO          dinero que sale para operar el negocio
       RETIRO         dinero que el dueño saca para uso personal (NO es gasto
                      del negocio: se muestra aparte para no inflar los gastos)
       TRANSFERENCIA  dinero que pasa de una cuenta a otra (no afecta la utilidad)
   · Utilidad = ingresos − gastos. Resultado después de retiros = utilidad − retiros.
   · No se permite que una salida deje una cuenta con saldo negativo.
   · Importación de extractos: CSV "fecha;descripción;monto" (monto negativo =
     salida). Cada línea se categoriza con reglas de palabras clave y se detectan
     duplicados por fecha + monto + descripción.
   ========================================================================== */
window.DB = (function () {
  "use strict";

  let B = null;
  const TIPOS = ["INGRESO", "GASTO", "RETIRO", "TRANSFERENCIA"];

  const ESQUEMA = `
    CREATE TABLE cuentas (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre        TEXT NOT NULL UNIQUE,
      saldo_inicial REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE categorias (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL,
      tipo        TEXT NOT NULL CHECK (tipo IN ('INGRESO','GASTO','RETIRO')),
      presupuesto REAL NOT NULL DEFAULT 0 CHECK (presupuesto >= 0),   -- mensual, solo para gastos
      UNIQUE (nombre, tipo)
    );
    CREATE TABLE movimientos (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha             TEXT NOT NULL,
      tipo              TEXT NOT NULL CHECK (tipo IN ('INGRESO','GASTO','RETIRO','TRANSFERENCIA')),
      categoria_id      INTEGER REFERENCES categorias(id),
      cuenta_id         INTEGER NOT NULL REFERENCES cuentas(id),
      cuenta_destino_id INTEGER REFERENCES cuentas(id),
      monto             REAL NOT NULL CHECK (monto > 0),
      descripcion       TEXT NOT NULL DEFAULT '',
      comprobante       TEXT NOT NULL DEFAULT 'Sin comprobante',
      origen            TEXT NOT NULL DEFAULT 'Manual',      -- Manual | Importado
      CHECK ((tipo = 'TRANSFERENCIA') = (cuenta_destino_id IS NOT NULL)),
      CHECK (tipo = 'TRANSFERENCIA' OR categoria_id IS NOT NULL)
    );
    CREATE INDEX idx_mov_fecha ON movimientos(fecha);
    CREATE TABLE reglas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      palabra      TEXT NOT NULL UNIQUE,                    -- se busca dentro de la descripción
      categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE
    );
  `;

  const hoy = SQLiteDemo.hoy, sumarDias = SQLiteDemo.sumarDias, iso = SQLiteDemo.iso;
  const r2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };
  const fmtS = function (n) { return "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

  async function iniciar() {
    B = await SQLiteDemo.crear({ idb: "demo-ingresos-gastos", esquema: ESQUEMA, sembrar: function (base) { B = base; window.DATOS_EJEMPLO.cargar(api); } });
    return { nuevo: B.nuevo };
  }

  /* ---------- Catálogos ---------- */
  function cuentas() {
    return B.consultar(`SELECT c.*, ROUND(c.saldo_inicial
        + COALESCE((SELECT SUM(monto) FROM movimientos WHERE cuenta_id = c.id AND tipo = 'INGRESO'), 0)
        - COALESCE((SELECT SUM(monto) FROM movimientos WHERE cuenta_id = c.id AND tipo IN ('GASTO','RETIRO','TRANSFERENCIA')), 0)
        + COALESCE((SELECT SUM(monto) FROM movimientos WHERE cuenta_destino_id = c.id), 0), 2) AS saldo
      FROM cuentas c ORDER BY c.id`);
  }
  function saldoDe(cuentaId) { const c = cuentas().find(function (x) { return x.id === Number(cuentaId); }); return c ? c.saldo : 0; }
  function categorias(tipo) { return B.consultar("SELECT * FROM categorias" + (tipo ? " WHERE tipo = ?" : "") + " ORDER BY tipo, nombre", tipo ? [tipo] : undefined); }
  function actualizarPresupuesto(id, monto) {
    const m = Number(monto);
    if (!(m >= 0)) throw new Error("El presupuesto debe ser 0 o un monto positivo.");
    B.ejecutar("UPDATE categorias SET presupuesto = ? WHERE id = ? AND tipo = 'GASTO'", [r2(m), id]);
    B.guardar();
  }

  /* ---------- Movimientos ---------- */
  /**
   * Registra un movimiento. opciones.sinValidarSaldo: solo para datos de ejemplo e importación masiva ya validada.
   */
  function registrar(m, opciones) {
    opciones = opciones || {};
    if (TIPOS.indexOf(m.tipo) === -1) throw new Error("Tipo de movimiento no válido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha || "")) throw new Error("La fecha no es válida.");
    if (!opciones.sinValidarFecha && m.fecha > hoy()) throw new Error("La fecha no puede ser posterior a hoy.");
    const monto = r2(m.monto);
    if (!(monto > 0)) throw new Error("El monto debe ser mayor que 0.");
    const cuenta = B.uno("SELECT * FROM cuentas WHERE id = ?", [m.cuenta_id]);
    if (!cuenta) throw new Error("Selecciona la cuenta.");
    let categoria = null, destino = null;
    if (m.tipo === "TRANSFERENCIA") {
      destino = B.uno("SELECT * FROM cuentas WHERE id = ?", [m.cuenta_destino_id]);
      if (!destino) throw new Error("Selecciona la cuenta de destino.");
      if (destino.id === cuenta.id) throw new Error("La cuenta de origen y la de destino deben ser distintas.");
    } else {
      categoria = B.uno("SELECT * FROM categorias WHERE id = ?", [m.categoria_id]);
      if (!categoria) throw new Error("Selecciona la categoría.");
      if (categoria.tipo !== m.tipo) throw new Error("La categoría «" + categoria.nombre + "» no corresponde a este tipo de movimiento.");
    }
    if (m.tipo !== "INGRESO" && !opciones.sinValidarSaldo) {
      const saldo = saldoDe(cuenta.id);
      if (monto > saldo + 0.004) throw new Error("Saldo insuficiente en " + cuenta.nombre + ": hay " + fmtS(saldo) + " y la salida es de " + fmtS(monto) + ".");
    }
    B.ejecutar("INSERT INTO movimientos (fecha, tipo, categoria_id, cuenta_id, cuenta_destino_id, monto, descripcion, comprobante, origen) VALUES (?,?,?,?,?,?,?,?,?)",
      [m.fecha, m.tipo, categoria ? categoria.id : null, cuenta.id, destino ? destino.id : null, monto, String(m.descripcion || "").trim(), m.comprobante || "Sin comprobante", m.origen || "Manual"]);
    const id = B.ultimoId();
    if (!opciones.sinGuardar) B.guardar();
    return id;
  }

  function eliminar(id) {
    const m = B.uno("SELECT * FROM movimientos WHERE id = ?", [id]);
    if (!m) return;
    // Eliminar un ingreso o una transferencia de entrada no puede dejar una cuenta en negativo
    const afectada = m.tipo === "INGRESO" ? m.cuenta_id : m.tipo === "TRANSFERENCIA" ? m.cuenta_destino_id : null;
    if (afectada && saldoDe(afectada) - m.monto < -0.004) {
      const c = B.uno("SELECT nombre FROM cuentas WHERE id = ?", [afectada]);
      throw new Error("No se puede eliminar: " + c.nombre + " quedaría con saldo negativo.");
    }
    B.ejecutar("DELETE FROM movimientos WHERE id = ?", [id]);
    B.guardar();
  }

  function listar(filtro) {
    filtro = filtro || {};
    const cond = [], p = {};
    if (filtro.desde) { cond.push("m.fecha >= :d"); p[":d"] = filtro.desde; }
    if (filtro.hasta) { cond.push("m.fecha <= :h"); p[":h"] = filtro.hasta; }
    if (filtro.tipo) { cond.push("m.tipo = :t"); p[":t"] = filtro.tipo; }
    if (filtro.cuenta) { cond.push("(m.cuenta_id = :c OR m.cuenta_destino_id = :c)"); p[":c"] = Number(filtro.cuenta); }
    if (filtro.categoria) { cond.push("m.categoria_id = :cat"); p[":cat"] = Number(filtro.categoria); }
    if (filtro.texto) { cond.push("(m.descripcion LIKE :q OR ca.nombre LIKE :q)"); p[":q"] = "%" + filtro.texto + "%"; }
    return B.consultar(`SELECT m.*, ca.nombre AS categoria, cu.nombre AS cuenta, cd.nombre AS cuenta_destino
      FROM movimientos m LEFT JOIN categorias ca ON ca.id = m.categoria_id JOIN cuentas cu ON cu.id = m.cuenta_id LEFT JOIN cuentas cd ON cd.id = m.cuenta_destino_id
      ${cond.length ? "WHERE " + cond.join(" AND ") : ""} ORDER BY m.fecha DESC, m.id DESC`, p);
  }

  /* ---------- Reportes ---------- */
  function mesesHasta(n) {
    const d = new Date(hoy() + "T00:00:00"), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ clave: x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"), etiqueta: NOMBRES_MES[x.getMonth()] + " " + String(x.getFullYear()).slice(2) });
    }
    return out;
  }

  /** Totales de un periodo (AAAA-MM). hastaDia: solo hasta ese día del mes (para comparar meses en curso) */
  function totalesMes(clave, hastaDia) {
    const r = { INGRESO: 0, GASTO: 0, RETIRO: 0 };
    const hasta = clave + "-" + String(hastaDia || 31).padStart(2, "0");
    B.consultar("SELECT tipo, SUM(monto) AS t FROM movimientos WHERE substr(fecha,1,7) = ? AND fecha <= ? AND tipo <> 'TRANSFERENCIA' GROUP BY tipo", [clave, hasta]).forEach(function (x) { r[x.tipo] = r2(x.t); });
    r.utilidad = r2(r.INGRESO - r.GASTO);
    r.margen = r.INGRESO ? Math.round(r.utilidad / r.INGRESO * 1000) / 10 : 0;
    r.despuesRetiros = r2(r.utilidad - r.RETIRO);
    return r;
  }

  /** Estado de resultados de n meses: filas por categoría, columnas por mes */
  function estadoResultados(n) {
    const meses = mesesHasta(n);
    const datos = {};
    B.consultar(`SELECT substr(m.fecha,1,7) AS mes, m.categoria_id, SUM(m.monto) AS t FROM movimientos m
                 WHERE m.tipo <> 'TRANSFERENCIA' AND substr(m.fecha,1,7) >= ? GROUP BY mes, m.categoria_id`, [meses[0].clave])
      .forEach(function (x) { datos[x.categoria_id + "|" + x.mes] = r2(x.t); });
    const fila = function (c) {
      const valores = meses.map(function (m) { return datos[c.id + "|" + m.clave] || 0; });
      return { categoria: c, valores: valores, total: r2(valores.reduce(function (s, v) { return s + v; }, 0)) };
    };
    const seccion = function (tipo) {
      const filas = categorias(tipo).map(fila).filter(function (f) { return f.total > 0; }).sort(function (a, b) { return b.total - a.total; });
      const totales = meses.map(function (_, i) { return r2(filas.reduce(function (s, f) { return s + f.valores[i]; }, 0)); });
      return { filas: filas, totales: totales, total: r2(totales.reduce(function (s, v) { return s + v; }, 0)) };
    };
    const ing = seccion("INGRESO"), gas = seccion("GASTO"), ret = seccion("RETIRO");
    const utilidad = meses.map(function (_, i) { return r2(ing.totales[i] - gas.totales[i]); });
    return {
      meses: meses, ingresos: ing, gastos: gas, retiros: ret, utilidad: utilidad,
      utilidadTotal: r2(ing.total - gas.total),
      margen: meses.map(function (_, i) { return ing.totales[i] ? Math.round(utilidad[i] / ing.totales[i] * 1000) / 10 : 0; }),
      despuesRetiros: meses.map(function (_, i) { return r2(utilidad[i] - ret.totales[i]); })
    };
  }

  /** Presupuesto del mes en curso con proyección al cierre */
  function presupuesto() {
    const h = hoy(), clave = h.slice(0, 7);
    const d = new Date(h + "T00:00:00"), diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), dia = d.getDate();
    const gastado = {};
    B.consultar("SELECT categoria_id, SUM(monto) AS t FROM movimientos WHERE tipo = 'GASTO' AND substr(fecha,1,7) = ? GROUP BY categoria_id", [clave]).forEach(function (x) { gastado[x.categoria_id] = r2(x.t); });
    // Promedio de los 3 meses anteriores, como referencia
    const tres = mesesHasta(4).slice(0, 3).map(function (m) { return m.clave; });
    const prom = {};
    B.consultar("SELECT categoria_id, SUM(monto) AS t FROM movimientos WHERE tipo = 'GASTO' AND substr(fecha,1,7) IN (?,?,?) GROUP BY categoria_id", tres).forEach(function (x) { prom[x.categoria_id] = r2(x.t / 3); });
    return {
      dia: dia, diasMes: diasMes,
      filas: categorias("GASTO").map(function (c) {
        const g = gastado[c.id] || 0;
        // Proyección lineal del mes (los gastos fijos que ya se pagaron completos no se proyectan más allá de su promedio)
        const lineal = dia ? g / dia * diasMes : g;
        const proyeccion = r2(prom[c.id] ? Math.max(g, Math.min(lineal, Math.max(prom[c.id], g))) : lineal);
        const pct = c.presupuesto ? Math.round(g / c.presupuesto * 100) : null;
        let estado = "sin";
        if (c.presupuesto) estado = g > c.presupuesto ? "excedido" : proyeccion > c.presupuesto * 1.02 ? "riesgo" : "ok";
        return { categoria: c, gastado: g, promedio: prom[c.id] || 0, proyeccion: proyeccion, pct: pct, estado: estado };
      })
    };
  }

  /* ---------- Importación de extractos ---------- */
  function reglas() { return B.consultar("SELECT r.*, c.nombre AS categoria, c.tipo FROM reglas r JOIN categorias c ON c.id = r.categoria_id ORDER BY c.tipo, r.palabra"); }
  function agregarRegla(palabra, categoriaId) {
    const p = String(palabra || "").trim().toUpperCase();
    if (p.length < 3) throw new Error("La palabra clave debe tener al menos 3 caracteres.");
    if (B.uno("SELECT id FROM reglas WHERE palabra = ?", [p])) throw new Error("Ya existe una regla para «" + p + "».");
    if (!B.uno("SELECT id FROM categorias WHERE id = ?", [categoriaId])) throw new Error("Selecciona la categoría.");
    B.ejecutar("INSERT INTO reglas (palabra, categoria_id) VALUES (?,?)", [p, categoriaId]);
    B.guardar();
  }
  function eliminarRegla(id) { B.ejecutar("DELETE FROM reglas WHERE id = ?", [id]); B.guardar(); }

  function normalizar(t) { return String(t).toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
  function leerFecha(t) {
    t = String(t).trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return t;
    m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return null;
    const anio = m[3].length === 2 ? "20" + m[3] : m[3];
    const f = anio + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    const d = new Date(f + "T00:00:00");
    return isNaN(d) || iso(d) !== f ? null : f;
  }
  function leerMonto(t) {
    let s = String(t).replace(/S\/|\s/g, "").trim();
    if (!s) return null;
    // 1.234,56 → 1234.56 ; 1,234.56 → 1234.56 ; 1234,56 → 1234.56
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
    const n = Number(s);
    return isFinite(n) && n !== 0 ? n : null;
  }

  /**
   * Analiza el texto de un extracto. Devuelve filas con categoría sugerida y avisos.
   * Separador: punto y coma, tabulación o coma (se detecta en la primera línea).
   */
  function analizarExtracto(texto, cuentaId) {
    const lineas = String(texto || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lineas.length) throw new Error("Pega o carga el contenido del extracto.");
    const sep = lineas[0].indexOf(";") !== -1 ? ";" : lineas[0].indexOf("\t") !== -1 ? "\t" : ",";
    const rs = reglas().map(function (r) { return { palabra: normalizar(r.palabra), categoria_id: r.categoria_id, tipo: r.tipo, categoria: r.categoria }; });
    const existentes = {};
    B.consultar("SELECT fecha, monto, descripcion, tipo FROM movimientos WHERE cuenta_id = ? OR cuenta_destino_id = ?", [cuentaId, cuentaId]).forEach(function (m) {
      existentes[m.fecha + "|" + r2(m.monto) + "|" + normalizar(m.descripcion)] = true;
    });
    const vistas = {};
    const filas = [];
    lineas.forEach(function (linea, i) {
      const c = linea.split(sep).map(function (x) { return x.replace(/^"|"$/g, "").trim(); });
      if (c.length < 3) { filas.push({ linea: i + 1, error: "Faltan columnas (se esperan fecha, descripción y monto).", texto: linea }); return; }
      const fecha = leerFecha(c[0]);
      if (!fecha) {
        if (i === 0) return; // probablemente es el encabezado
        filas.push({ linea: i + 1, error: "Fecha no reconocida: " + c[0], texto: linea }); return;
      }
      const monto = leerMonto(c[c.length - 1]);
      if (monto === null) { filas.push({ linea: i + 1, error: "Monto no reconocido: " + c[c.length - 1], texto: linea }); return; }
      const descripcion = c.slice(1, c.length - 1).join(" ").trim();
      const tipo = monto > 0 ? "INGRESO" : "GASTO";
      const desc = normalizar(descripcion);
      const regla = rs.find(function (r) { return desc.indexOf(r.palabra) !== -1 && (r.tipo === tipo || (tipo === "GASTO" && r.tipo === "RETIRO")); });
      const clave = fecha + "|" + r2(Math.abs(monto)) + "|" + desc;
      const fila = {
        linea: i + 1, fecha: fecha, descripcion: descripcion, monto: r2(Math.abs(monto)),
        tipo: regla ? regla.tipo : tipo, categoria_id: regla ? regla.categoria_id : null, regla: regla ? regla.palabra : null,
        duplicado: Boolean(existentes[clave]) || Boolean(vistas[clave]), futura: fecha > hoy()
      };
      vistas[clave] = true;
      fila.importar = !fila.duplicado && !fila.futura;
      filas.push(fila);
    });
    return filas;
  }

  /** Importa las filas marcadas. Valida que ninguna salida deje la cuenta en negativo (en orden de fecha). */
  function importar(filas, cuentaId) {
    const sel = filas.filter(function (f) { return f.importar && !f.error; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    if (!sel.length) throw new Error("No hay líneas seleccionadas para importar.");
    sel.forEach(function (f) {
      if (!f.categoria_id) throw new Error("La línea " + f.linea + " («" + f.descripcion + "») no tiene categoría.");
      const cat = B.uno("SELECT tipo FROM categorias WHERE id = ?", [f.categoria_id]);
      if (!cat) throw new Error("Categoría no válida en la línea " + f.linea + ".");
      f.tipo = cat.tipo;
    });
    let saldo = saldoDe(cuentaId);
    sel.forEach(function (f) { saldo += f.tipo === "INGRESO" ? f.monto : -f.monto; });
    if (saldo < -0.004) throw new Error("Con estas líneas, la cuenta quedaría con saldo negativo (" + fmtS(saldo) + "). Revisa los montos o la cuenta elegida.");
    B.ejecutar("SAVEPOINT importar");
    try {
      sel.forEach(function (f) {
        registrar({ fecha: f.fecha, tipo: f.tipo, categoria_id: f.categoria_id, cuenta_id: cuentaId, monto: f.monto, descripcion: f.descripcion, origen: "Importado" }, { sinValidarSaldo: true, sinGuardar: true });
      });
      B.ejecutar("RELEASE importar");
    } catch (e) { B.ejecutar("ROLLBACK TO importar"); B.ejecutar("RELEASE importar"); throw e; }
    B.guardar();
    return sel.length;
  }

  const api = {
    iniciar: iniciar, reiniciar: function () { return B.reiniciar(); }, exportarArchivo: function () { return B.exportar(); }, esPersistente: function () { return B.esPersistente(); },
    uno: function (s, p) { return B.uno(s, p); }, consultar: function (s, p) { return B.consultar(s, p); }, ejecutar: function (s, p) { return B.ejecutar(s, p); },
    preparar: function (s) { return B.preparar(s); },
    cuentas: cuentas, saldoDe: saldoDe, categorias: categorias, actualizarPresupuesto: actualizarPresupuesto,
    registrar: registrar, eliminar: eliminar, listar: listar,
    mesesHasta: mesesHasta, totalesMes: totalesMes, estadoResultados: estadoResultados, presupuesto: presupuesto,
    reglas: reglas, agregarRegla: agregarRegla, eliminarRegla: eliminarRegla, analizarExtracto: analizarExtracto, importar: importar,
    leerFecha: leerFecha, leerMonto: leerMonto, normalizar: normalizar,
    hoy: hoy, sumarDias: sumarDias, iso: iso, r2: r2
  };
  return api;
})();
