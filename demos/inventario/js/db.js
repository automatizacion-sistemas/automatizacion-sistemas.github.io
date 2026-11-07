/* ==========================================================================
   db.js — Base de datos SQLite del sistema de inventarios
   ---------------------------------------------------------------------------
   · Usa sql.js: SQLite real compilado a WebAssembly, corre en el navegador.
   · La base se guarda en IndexedDB, en el navegador de cada visitante, así que
     cada persona trabaja con su propia copia y nadie ve los datos de otro.
   · Valorización del kardex: COSTO PROMEDIO PONDERADO.
   ========================================================================== */
window.DB = (function () {
  "use strict";

  let B = null;        // base de datos (ver demos/comun/js/sqlite.js)

  /* ---------- Esquema ---------- */
  const ESQUEMA = `
    CREATE TABLE IF NOT EXISTS productos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo        TEXT    NOT NULL UNIQUE,
      nombre        TEXT    NOT NULL,
      categoria     TEXT    NOT NULL,
      unidad        TEXT    NOT NULL DEFAULT 'Unidad',
      precio_venta  REAL    NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
      stock_minimo  REAL    NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
      creado        TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS movimientos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id     INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      fecha           TEXT    NOT NULL,                       -- AAAA-MM-DD
      tipo            TEXT    NOT NULL CHECK (tipo IN ('ENTRADA','SALIDA')),
      motivo          TEXT    NOT NULL,                       -- Compra, Venta, Ajuste, Merma...
      cantidad        REAL    NOT NULL CHECK (cantidad > 0),
      costo_unitario  REAL    NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0), -- solo se usa en entradas
      referencia      TEXT    NOT NULL DEFAULT '',            -- N° de comprobante
      creado          TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos(producto_id, fecha, id);
    CREATE INDEX IF NOT EXISTS idx_mov_fecha    ON movimientos(fecha);

    -- Vista con el stock actual de cada producto
    CREATE VIEW IF NOT EXISTS v_stock AS
      SELECT p.*,
             COALESCE(SUM(CASE m.tipo WHEN 'ENTRADA' THEN m.cantidad ELSE -m.cantidad END), 0) AS stock
      FROM productos p
      LEFT JOIN movimientos m ON m.producto_id = p.id
      GROUP BY p.id;
  `;

  /* ---------- Acceso a la base ---------- */
  function consultar(sql, params) { return B.consultar(sql, params); }
  function uno(sql, params) { return B.uno(sql, params); }
  function ejecutar(sql, params) { B.ejecutar(sql, params); }
  function guardar() { B.guardar(); }

  async function iniciar() {
    B = await SQLiteDemo.crear({
      idb: "demo-inventario",
      esquema: ESQUEMA,
      sembrar: function (base) { B = base; window.DATOS_EJEMPLO.cargar(api); }
    });
    return { nuevo: B.nuevo };
  }
  function reiniciar() { return B.reiniciar(); }
  function exportarArchivo() { return B.exportar(); }

  /* ---------- Productos ---------- */
  function categorias() {
    return consultar("SELECT DISTINCT categoria FROM productos ORDER BY categoria").map(function (f) { return f.categoria; });
  }

  function listarProductos(filtro) {
    filtro = filtro || {};
    const cond = [], params = {};
    if (filtro.texto) { cond.push("(codigo LIKE :t OR nombre LIKE :t)"); params[":t"] = "%" + filtro.texto + "%"; }
    if (filtro.categoria) { cond.push("categoria = :c"); params[":c"] = filtro.categoria; }
    if (filtro.soloBajo) cond.push("stock <= stock_minimo");
    const sql = "SELECT * FROM v_stock" + (cond.length ? " WHERE " + cond.join(" AND ") : "") + " ORDER BY nombre";
    const productos = consultar(sql, params);
    // Agrega el costo promedio y el valor de cada producto desde el kardex
    const val = valorizacion();
    productos.forEach(function (p) {
      const v = val[p.id] || { costo: 0, valor: 0 };
      p.costo_promedio = v.costo; p.valor = v.valor;
    });
    return productos;
  }

  function obtenerProducto(id) { return uno("SELECT * FROM v_stock WHERE id = ?", [id]); }

  /** Crea o actualiza un producto. Devuelve el id. Lanza Error con mensaje claro si algo no es válido. */
  function guardarProducto(p) {
    const codigo = String(p.codigo || "").trim().toUpperCase();
    const nombre = String(p.nombre || "").trim();
    const categoria = String(p.categoria || "").trim();
    if (!codigo) throw new Error("El código es obligatorio.");
    if (!nombre) throw new Error("El nombre es obligatorio.");
    if (!categoria) throw new Error("La categoría es obligatoria.");
    const precio = Number(p.precio_venta), minimo = Number(p.stock_minimo);
    if (!(precio >= 0)) throw new Error("El precio de venta debe ser un número mayor o igual a 0.");
    if (!(minimo >= 0)) throw new Error("El stock mínimo debe ser un número mayor o igual a 0.");

    const repetido = uno("SELECT id FROM productos WHERE codigo = ? AND id <> ?", [codigo, p.id || 0]);
    if (repetido) throw new Error("Ya existe otro producto con el código " + codigo + ".");

    const valores = [codigo, nombre, categoria, p.unidad || "Unidad", precio, minimo];
    if (p.id) {
      ejecutar("UPDATE productos SET codigo=?, nombre=?, categoria=?, unidad=?, precio_venta=?, stock_minimo=? WHERE id=?", valores.concat([p.id]));
      guardar();
      return p.id;
    }
    ejecutar("INSERT INTO productos (codigo, nombre, categoria, unidad, precio_venta, stock_minimo) VALUES (?,?,?,?,?,?)", valores);
    const id = B.ultimoId();
    guardar();
    return id;
  }

  function eliminarProducto(id) {
    ejecutar("DELETE FROM productos WHERE id = ?", [id]); // los movimientos se borran en cascada
    guardar();
  }

  /* ---------- Movimientos ---------- */
  function movimientosDe(productoId) {
    return consultar("SELECT * FROM movimientos WHERE producto_id = ? ORDER BY fecha, id", [productoId]);
  }

  /**
   * Registra una entrada o salida. Antes de guardar, recalcula el kardex con el
   * nuevo movimiento y rechaza la operación si en algún momento el stock quedaría negativo.
   */
  function registrarMovimiento(m, opciones) {
    const producto = obtenerProducto(m.producto_id);
    if (!producto) throw new Error("Selecciona un producto válido.");
    if (m.tipo !== "ENTRADA" && m.tipo !== "SALIDA") throw new Error("Tipo de movimiento no válido.");
    const cantidad = Number(m.cantidad);
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha || "")) throw new Error("La fecha no es válida.");
    if (!(opciones && opciones.sinValidarFecha) && m.fecha > hoy()) throw new Error("La fecha no puede ser posterior a hoy.");
    const costo = m.tipo === "ENTRADA" ? Number(m.costo_unitario) : 0;
    if (m.tipo === "ENTRADA" && !(costo >= 0)) throw new Error("Ingresa el costo unitario de la entrada.");

    if (!(opciones && opciones.sinValidarStock)) {
      const simulados = movimientosDe(m.producto_id).concat([{ id: Infinity, fecha: m.fecha, tipo: m.tipo, cantidad: cantidad, costo_unitario: costo }]);
      simulados.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id - b.id; });
      let saldo = 0;
      for (const s of simulados) {
        saldo += s.tipo === "ENTRADA" ? s.cantidad : -s.cantidad;
        if (saldo < -1e-9) {
          const disponible = formatoCantidad(saldo + s.cantidad);
          if (s.id === Infinity) {
            throw new Error("Stock insuficiente de " + producto.nombre + ": al " + s.fecha.split("-").reverse().join("/") +
              " hay " + disponible + " disponibles y la salida es de " + formatoCantidad(cantidad) + ".");
          }
          throw new Error("No se puede registrar con esa fecha: el stock de " + producto.nombre +
            " quedaría negativo el " + s.fecha.split("-").reverse().join("/") + " por movimientos posteriores.");
        }
      }
    }
    ejecutar("INSERT INTO movimientos (producto_id, fecha, tipo, motivo, cantidad, costo_unitario, referencia) VALUES (?,?,?,?,?,?,?)",
      [m.producto_id, m.fecha, m.tipo, m.motivo || (m.tipo === "ENTRADA" ? "Compra" : "Venta"), cantidad, costo, String(m.referencia || "").trim()]);
    if (!(opciones && opciones.sinGuardar)) guardar();
  }

  /** Inserción masiva sin validaciones, solo para cargar los datos de ejemplo (mucho más rápida). */
  function insertarMovimientosEnLote(lista) {
    const stmt = B.preparar("INSERT INTO movimientos (producto_id, fecha, tipo, motivo, cantidad, costo_unitario, referencia) VALUES (?,?,?,?,?,?,?)");
    try {
      lista.forEach(function (m) { stmt.run([m.producto_id, m.fecha, m.tipo, m.motivo, m.cantidad, m.costo_unitario || 0, m.referencia || ""]); });
    } finally {
      stmt.free();
    }
  }

  function ultimosMovimientos(limite) {
    return consultar(`SELECT m.*, p.codigo, p.nombre, p.unidad FROM movimientos m JOIN productos p ON p.id = m.producto_id
                      ORDER BY m.fecha DESC, m.id DESC LIMIT ?`, [limite || 50]);
  }

  /* ---------- Kardex (costo promedio ponderado) ---------- */
  function calcularKardex(movs) {
    let cant = 0, valor = 0, promedio = 0;
    return movs.map(function (m) {
      const fila = { id: m.id, fecha: m.fecha, tipo: m.tipo, motivo: m.motivo, referencia: m.referencia, entrada: null, salida: null };
      if (m.tipo === "ENTRADA") {
        const total = m.cantidad * m.costo_unitario;
        cant += m.cantidad; valor += total;
        promedio = cant > 0 ? valor / cant : 0;
        fila.entrada = { cantidad: m.cantidad, costo: m.costo_unitario, total: total };
      } else {
        const total = m.cantidad * promedio;   // la salida se valoriza al costo promedio vigente
        cant -= m.cantidad; valor -= total;
        if (Math.abs(cant) < 1e-9) { cant = 0; valor = 0; }
        fila.salida = { cantidad: m.cantidad, costo: promedio, total: total };
      }
      fila.saldo = { cantidad: cant, costo: promedio, total: valor };
      return fila;
    });
  }
  function kardex(productoId) { return calcularKardex(movimientosDe(productoId)); }

  /** Costo promedio y valor actual de cada producto: { id: {costo, valor, cantidad} } */
  function valorizacion() {
    const todos = consultar("SELECT * FROM movimientos ORDER BY producto_id, fecha, id");
    const grupos = {};
    todos.forEach(function (m) { (grupos[m.producto_id] = grupos[m.producto_id] || []).push(m); });
    const res = {};
    Object.keys(grupos).forEach(function (id) {
      const k = calcularKardex(grupos[id]);
      const s = k[k.length - 1].saldo;
      res[id] = { costo: s.costo, valor: s.total, cantidad: s.cantidad };
    });
    return res;
  }

  /* ---------- Dashboard ---------- */
  function resumen() {
    const productos = listarProductos();
    const inicioMes = hoy().slice(0, 8) + "01";
    const movMes = uno("SELECT COUNT(*) AS n FROM movimientos WHERE fecha >= ?", [inicioMes]).n;
    const ventasMes = uno(`SELECT COALESCE(SUM(m.cantidad * p.precio_venta),0) AS total FROM movimientos m JOIN productos p ON p.id = m.producto_id
                           WHERE m.tipo='SALIDA' AND m.motivo='Venta' AND m.fecha >= ?`, [inicioMes]).total;
    const porCategoria = {};
    productos.forEach(function (p) { porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + p.valor; });
    return {
      totalProductos: productos.length,
      valorInventario: productos.reduce(function (s, p) { return s + p.valor; }, 0),
      stockBajo: productos.filter(function (p) { return p.stock <= p.stock_minimo; }),
      movimientosMes: movMes,
      ventasMes: ventasMes,
      porCategoria: porCategoria
    };
  }

  /** Valor de entradas y salidas (a costo) por semana, últimas N semanas */
  function flujoSemanal(semanas) {
    const val = {}; // costo de salidas según kardex
    const todos = consultar("SELECT * FROM movimientos ORDER BY producto_id, fecha, id");
    const grupos = {};
    todos.forEach(function (m) { (grupos[m.producto_id] = grupos[m.producto_id] || []).push(m); });
    const filas = [];
    Object.keys(grupos).forEach(function (id) { calcularKardex(grupos[id]).forEach(function (f) { filas.push(f); }); });

    const fin = new Date(hoy() + "T00:00:00");
    const etiquetas = [], entradas = [], salidas = [];
    for (let i = semanas - 1; i >= 0; i--) {
      const hasta = new Date(fin); hasta.setDate(fin.getDate() - i * 7);
      const desde = new Date(hasta); desde.setDate(hasta.getDate() - 6);
      const d = iso(desde), h = iso(hasta);
      etiquetas.push(d.slice(8) + "/" + d.slice(5, 7));
      let e = 0, s = 0;
      filas.forEach(function (f) {
        if (f.fecha < d || f.fecha > h) return;
        if (f.entrada && f.motivo !== "Inventario inicial") e += f.entrada.total;
        if (f.salida) s += f.salida.total;
      });
      entradas.push(Math.round(e * 100) / 100); salidas.push(Math.round(s * 100) / 100);
    }
    return { etiquetas: etiquetas, entradas: entradas, salidas: salidas };
  }

  /* ---------- Fechas y formatos ---------- */
  const iso = SQLiteDemo.iso, hoy = SQLiteDemo.hoy;
  function formatoCantidad(n) { return Number(n).toLocaleString("es-PE", { maximumFractionDigits: 2 }); }

  const api = {
    iniciar: iniciar, reiniciar: reiniciar, exportarArchivo: exportarArchivo,
    esPersistente: function () { return B.esPersistente(); },
    consultar: consultar, uno: uno,
    categorias: categorias, listarProductos: listarProductos, obtenerProducto: obtenerProducto,
    guardarProducto: guardarProducto, eliminarProducto: eliminarProducto,
    registrarMovimiento: registrarMovimiento, insertarMovimientosEnLote: insertarMovimientosEnLote, ultimosMovimientos: ultimosMovimientos,
    kardex: kardex, calcularKardex: calcularKardex, resumen: resumen, flujoSemanal: flujoSemanal,
    hoy: hoy, iso: iso, formatoCantidad: formatoCantidad
  };
  return api;
})();
