/* ==========================================================================
   db.js — Base de datos y reglas de negocio: ventas y cobranzas
   ---------------------------------------------------------------------------
   Reglas principales:
   · Factura solo para clientes con RUC (11 dígitos); boleta para DNI u otros.
   · Numeración correlativa automática por serie (F001, B001).
   · Ventas al contado: se registra el cobro completo en el mismo momento.
   · Ventas al crédito: vencimiento = fecha + días de crédito del cliente, y
     no se puede superar su línea de crédito (si tiene una asignada).
   · Un cobro no puede ser mayor que el saldo ni anterior a la venta.
   · Los importes incluyen IGV (18 %): base = total ÷ 1,18.
   ========================================================================== */
window.DB = (function () {
  "use strict";

  let B = null;
  const IGV = 0.18;
  const DIAS_POR_VENCER = 7; // "vence pronto" si faltan 7 días o menos

  const ESQUEMA = `
    CREATE TABLE clientes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      documento      TEXT NOT NULL UNIQUE,           -- RUC (11) o DNI (8)
      nombre         TEXT NOT NULL,
      telefono       TEXT NOT NULL DEFAULT '',
      correo         TEXT NOT NULL DEFAULT '',
      dias_credito   INTEGER NOT NULL DEFAULT 30 CHECK (dias_credito >= 0),
      limite_credito REAL NOT NULL DEFAULT 0 CHECK (limite_credito >= 0),  -- 0 = sin límite
      creado         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE ventas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id   INTEGER NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
      fecha        TEXT NOT NULL,
      comprobante  TEXT NOT NULL CHECK (comprobante IN ('FACTURA','BOLETA')),
      serie        TEXT NOT NULL,
      numero       INTEGER NOT NULL,
      descripcion  TEXT NOT NULL DEFAULT '',
      total        REAL NOT NULL CHECK (total > 0),   -- incluye IGV
      condicion    TEXT NOT NULL CHECK (condicion IN ('CONTADO','CREDITO')),
      vencimiento  TEXT NOT NULL,
      creado       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE (serie, numero)
    );
    CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);
    CREATE INDEX idx_ventas_fecha ON ventas(fecha);

    CREATE TABLE cobros (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id  INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
      fecha     TEXT NOT NULL,
      monto     REAL NOT NULL CHECK (monto > 0),
      medio     TEXT NOT NULL,                       -- Efectivo, Transferencia, Yape/Plin, Depósito
      operacion TEXT NOT NULL DEFAULT '',            -- N° de operación bancaria
      creado    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX idx_cobros_venta ON cobros(venta_id);
    CREATE INDEX idx_cobros_fecha ON cobros(fecha);

    -- Cada venta con su cliente, lo cobrado y el saldo pendiente
    CREATE VIEW v_ventas AS
      SELECT v.*, c.nombre AS cliente, c.documento, c.telefono,
             v.serie || '-' || printf('%06d', v.numero) AS comprobante_numero,
             COALESCE((SELECT SUM(monto) FROM cobros WHERE venta_id = v.id), 0) AS cobrado,
             ROUND(v.total - COALESCE((SELECT SUM(monto) FROM cobros WHERE venta_id = v.id), 0), 2) AS saldo
      FROM ventas v JOIN clientes c ON c.id = v.cliente_id;
  `;

  const r2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };
  const hoy = SQLiteDemo.hoy, sumarDias = SQLiteDemo.sumarDias, diasEntre = SQLiteDemo.diasEntre;

  async function iniciar() {
    B = await SQLiteDemo.crear({
      idb: "demo-ventas-cobranzas",
      esquema: ESQUEMA,
      sembrar: function (base) { B = base; window.DATOS_EJEMPLO.cargar(api); }
    });
    return { nuevo: B.nuevo };
  }

  /* ---------- Estado de una venta ---------- */
  function estadoDe(v, fechaRef) {
    const ref = fechaRef || hoy();
    if (v.saldo <= 0.004) return { clave: "pagada", texto: "Pagada", dias: 0 };
    const dias = diasEntre(v.vencimiento, ref); // positivo = días de atraso
    if (dias > 0) return { clave: "vencida", texto: "Vencida", dias: dias };
    if (-dias <= DIAS_POR_VENCER) return { clave: "pronto", texto: dias === 0 ? "Vence hoy" : "Vence en " + (-dias) + " d", dias: dias };
    return { clave: "vigente", texto: "Vigente", dias: dias };
  }
  function conEstado(filas) {
    const h = hoy();
    filas.forEach(function (v) { v.estado = estadoDe(v, h); });
    return filas;
  }

  /* ---------- Clientes ---------- */
  function validarDocumento(doc) {
    if (/^\d{8}$/.test(doc)) return "DNI";
    if (/^(10|15|17|20)\d{9}$/.test(doc)) return "RUC";
    return null;
  }

  function listarClientes(texto) {
    const params = {};
    let where = "";
    if (texto) { where = "WHERE c.nombre LIKE :t OR c.documento LIKE :t"; params[":t"] = "%" + texto + "%"; }
    const filas = B.consultar(`
      SELECT c.*,
             COALESCE((SELECT SUM(saldo) FROM v_ventas WHERE cliente_id = c.id), 0) AS deuda,
             COALESCE((SELECT SUM(saldo) FROM v_ventas WHERE cliente_id = c.id AND saldo > 0 AND vencimiento < :hoy), 0) AS vencido,
             (SELECT COUNT(*) FROM ventas WHERE cliente_id = c.id) AS n_ventas
      FROM clientes c ${where} ORDER BY c.nombre`, Object.assign({ ":hoy": hoy() }, params));
    filas.forEach(function (c) {
      c.deuda = r2(c.deuda); c.vencido = r2(c.vencido);
      c.tipo_doc = validarDocumento(c.documento) || "Otro";
      c.disponible = c.limite_credito > 0 ? r2(c.limite_credito - c.deuda) : null;
    });
    return filas;
  }
  function obtenerCliente(id) { return listarClientes().find(function (c) { return c.id === Number(id); }) || null; }

  function guardarCliente(c) {
    const documento = String(c.documento || "").replace(/\s/g, "");
    const nombre = String(c.nombre || "").trim();
    if (!validarDocumento(documento)) throw new Error("El documento debe ser un DNI de 8 dígitos o un RUC de 11 dígitos (empieza con 10, 15, 17 o 20).");
    if (nombre.length < 3) throw new Error("Escribe el nombre o la razón social.");
    const dias = Number(c.dias_credito), limite = Number(c.limite_credito);
    if (!(Number.isInteger(dias) && dias >= 0 && dias <= 180)) throw new Error("Los días de crédito deben ser un número entero entre 0 y 180.");
    if (!(limite >= 0)) throw new Error("La línea de crédito debe ser 0 o un monto positivo.");
    const telefono = String(c.telefono || "").replace(/[^\d]/g, "");
    if (telefono && !/^9\d{8}$/.test(telefono)) throw new Error("El celular debe tener 9 dígitos y empezar con 9.");
    if (B.uno("SELECT id FROM clientes WHERE documento = ? AND id <> ?", [documento, c.id || 0])) throw new Error("Ya existe un cliente con el documento " + documento + ".");

    const valores = [documento, nombre, telefono, String(c.correo || "").trim(), dias, limite];
    if (c.id) {
      B.ejecutar("UPDATE clientes SET documento=?, nombre=?, telefono=?, correo=?, dias_credito=?, limite_credito=? WHERE id=?", valores.concat([c.id]));
    } else {
      B.ejecutar("INSERT INTO clientes (documento, nombre, telefono, correo, dias_credito, limite_credito) VALUES (?,?,?,?,?,?)", valores);
    }
    const id = c.id || B.ultimoId();
    B.guardar();
    return id;
  }

  function eliminarCliente(id) {
    const n = B.uno("SELECT COUNT(*) AS n FROM ventas WHERE cliente_id = ?", [id]).n;
    if (n > 0) throw new Error("No se puede eliminar: el cliente tiene " + n + " venta(s) registradas.");
    B.ejecutar("DELETE FROM clientes WHERE id = ?", [id]);
    B.guardar();
  }

  /* ---------- Ventas ---------- */
  function siguienteNumero(serie) {
    return B.uno("SELECT COALESCE(MAX(numero), 0) + 1 AS n FROM ventas WHERE serie = ?", [serie]).n;
  }
  function serieDe(comprobante) { return comprobante === "FACTURA" ? "F001" : "B001"; }

  /**
   * Registra una venta. Si es al contado, registra también su cobro.
   * opciones.sinValidar: solo para los datos de ejemplo.
   */
  function registrarVenta(v, opciones) {
    opciones = opciones || {};
    const cliente = B.uno("SELECT * FROM clientes WHERE id = ?", [v.cliente_id]);
    if (!cliente) throw new Error("Selecciona un cliente.");
    const total = r2(v.total);
    if (!(total > 0)) throw new Error("El importe total debe ser mayor que 0.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.fecha || "")) throw new Error("La fecha no es válida.");
    if (!opciones.sinValidar && v.fecha > hoy()) throw new Error("La fecha de la venta no puede ser posterior a hoy.");
    if (v.comprobante === "FACTURA" && validarDocumento(cliente.documento) !== "RUC") {
      throw new Error("Solo se puede emitir factura a clientes con RUC. Para " + cliente.nombre + " corresponde boleta.");
    }
    const credito = v.condicion === "CREDITO";
    let vencimiento = v.fecha;
    if (credito) {
      vencimiento = v.vencimiento || sumarDias(v.fecha, cliente.dias_credito);
      if (vencimiento < v.fecha) throw new Error("El vencimiento no puede ser anterior a la fecha de venta.");
      if (!opciones.sinValidar && cliente.limite_credito > 0) {
        const deuda = B.uno("SELECT COALESCE(SUM(saldo),0) AS d FROM v_ventas WHERE cliente_id = ?", [cliente.id]).d;
        if (deuda + total > cliente.limite_credito + 0.004) {
          throw new Error("Excede la línea de crédito de " + cliente.nombre + ": debe S/ " + r2(deuda).toFixed(2) +
            " de un límite de S/ " + cliente.limite_credito.toFixed(2) + ". Disponible: S/ " + r2(Math.max(0, cliente.limite_credito - deuda)).toFixed(2) + ".");
        }
      }
    }
    const serie = serieDe(v.comprobante);
    const numero = siguienteNumero(serie);
    B.ejecutar("INSERT INTO ventas (cliente_id, fecha, comprobante, serie, numero, descripcion, total, condicion, vencimiento) VALUES (?,?,?,?,?,?,?,?,?)",
      [cliente.id, v.fecha, v.comprobante, serie, numero, String(v.descripcion || "").trim(), total, v.condicion, vencimiento]);
    const id = B.ultimoId();
    if (!credito) {
      B.ejecutar("INSERT INTO cobros (venta_id, fecha, monto, medio, operacion) VALUES (?,?,?,?,?)", [id, v.fecha, total, v.medio || "Efectivo", ""]);
    }
    if (!opciones.sinGuardar) B.guardar();
    return { id: id, comprobante: serie + "-" + String(numero).padStart(6, "0") };
  }

  function listarVentas(filtro) {
    filtro = filtro || {};
    const cond = [], p = {};
    if (filtro.texto) { cond.push("(cliente LIKE :t OR documento LIKE :t OR comprobante_numero LIKE :t OR descripcion LIKE :t)"); p[":t"] = "%" + filtro.texto + "%"; }
    if (filtro.cliente_id) { cond.push("cliente_id = :c"); p[":c"] = filtro.cliente_id; }
    if (filtro.condicion) { cond.push("condicion = :cond"); p[":cond"] = filtro.condicion; }
    if (filtro.soloPendientes) cond.push("saldo > 0");
    const filas = conEstado(B.consultar("SELECT * FROM v_ventas" + (cond.length ? " WHERE " + cond.join(" AND ") : "") + " ORDER BY fecha DESC, id DESC", p));
    if (filtro.estado) return filas.filter(function (v) { return v.estado.clave === filtro.estado || (filtro.estado === "pendiente" && v.estado.clave !== "pagada"); });
    return filas;
  }
  function obtenerVenta(id) {
    const v = conEstado(B.consultar("SELECT * FROM v_ventas WHERE id = ?", [id]))[0];
    if (!v) return null;
    v.base = r2(v.total / (1 + IGV)); v.igv = r2(v.total - v.base);
    v.cobros = B.consultar("SELECT * FROM cobros WHERE venta_id = ? ORDER BY fecha, id", [id]);
    return v;
  }

  /* ---------- Cobros ---------- */
  function registrarCobro(c, opciones) {
    opciones = opciones || {};
    const v = B.uno("SELECT * FROM v_ventas WHERE id = ?", [c.venta_id]);
    if (!v) throw new Error("Selecciona el comprobante que se está cobrando.");
    const monto = r2(c.monto);
    if (!(monto > 0)) throw new Error("El monto debe ser mayor que 0.");
    if (monto > v.saldo + 0.004) throw new Error("El monto (S/ " + monto.toFixed(2) + ") supera el saldo pendiente de " + v.comprobante_numero + " (S/ " + v.saldo.toFixed(2) + ").");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fecha || "")) throw new Error("La fecha no es válida.");
    if (c.fecha < v.fecha) throw new Error("El cobro no puede ser anterior a la fecha de la venta (" + v.fecha.split("-").reverse().join("/") + ").");
    if (!opciones.sinValidar && c.fecha > hoy()) throw new Error("La fecha del cobro no puede ser posterior a hoy.");
    if (!c.medio) throw new Error("Indica el medio de pago.");
    B.ejecutar("INSERT INTO cobros (venta_id, fecha, monto, medio, operacion) VALUES (?,?,?,?,?)", [v.id, c.fecha, monto, c.medio, String(c.operacion || "").trim()]);
    if (!opciones.sinGuardar) B.guardar();
    return r2(v.saldo - monto);
  }
  function listarCobros(limite) {
    return B.consultar(`SELECT co.*, v.comprobante_numero, v.cliente FROM cobros co JOIN v_ventas v ON v.id = co.venta_id
                        ORDER BY co.fecha DESC, co.id DESC LIMIT ?`, [limite || 80]);
  }

  /* ---------- Cuentas por cobrar: antigüedad de saldos ---------- */
  const TRAMOS = [
    { clave: "por_vencer", titulo: "Por vencer", hasta: 0 },
    { clave: "d1_30", titulo: "1–30 días", hasta: 30 },
    { clave: "d31_60", titulo: "31–60 días", hasta: 60 },
    { clave: "d61_90", titulo: "61–90 días", hasta: 90 },
    { clave: "d90", titulo: "Más de 90", hasta: Infinity }
  ];
  function tramoDe(diasAtraso) {
    for (const t of TRAMOS) if (diasAtraso <= t.hasta) return t.clave;
    return "d90";
  }
  function antiguedad() {
    const pendientes = listarVentas({ soloPendientes: true });
    const porCliente = {}, totales = { total: 0 };
    TRAMOS.forEach(function (t) { totales[t.clave] = 0; });
    pendientes.forEach(function (v) {
      const fila = porCliente[v.cliente_id] = porCliente[v.cliente_id] || { cliente_id: v.cliente_id, cliente: v.cliente, documento: v.documento, telefono: v.telefono, total: 0, documentos: 0, max_atraso: 0 };
      if (fila.total === 0) TRAMOS.forEach(function (t) { fila[t.clave] = fila[t.clave] || 0; });
      const t = tramoDe(v.estado.dias);
      fila[t] = r2(fila[t] + v.saldo); fila.total = r2(fila.total + v.saldo); fila.documentos++;
      fila.max_atraso = Math.max(fila.max_atraso, v.estado.dias);
      totales[t] = r2(totales[t] + v.saldo); totales.total = r2(totales.total + v.saldo);
    });
    const filas = Object.values(porCliente).sort(function (a, b) { return b.total - a.total; });
    return { filas: filas, totales: totales, tramos: TRAMOS, pendientes: pendientes };
  }

  /* ---------- Estado de cuenta ---------- */
  function estadoCuenta(clienteId) {
    const movs = [];
    B.consultar("SELECT * FROM v_ventas WHERE cliente_id = ?", [clienteId]).forEach(function (v) {
      movs.push({ fecha: v.fecha, orden: 0, tipo: "Venta", detalle: (v.comprobante === "FACTURA" ? "Factura " : "Boleta ") + v.comprobante_numero + (v.condicion === "CONTADO" ? " (contado)" : " · vence " + v.vencimiento.split("-").reverse().join("/")), cargo: v.total, abono: 0 });
    });
    B.consultar("SELECT co.*, v.comprobante_numero FROM cobros co JOIN v_ventas v ON v.id = co.venta_id WHERE v.cliente_id = ?", [clienteId]).forEach(function (c) {
      movs.push({ fecha: c.fecha, orden: 1, tipo: "Cobro", detalle: c.medio + " · " + c.comprobante_numero + (c.operacion ? " · Op. " + c.operacion : ""), cargo: 0, abono: c.monto });
    });
    movs.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.orden - b.orden; });
    let saldo = 0;
    movs.forEach(function (m) { saldo = r2(saldo + m.cargo - m.abono); m.saldo = saldo; });
    return movs;
  }

  /* ---------- Dashboard ---------- */
  function resumen() {
    const h = hoy(), inicioMes = h.slice(0, 8) + "01";
    const ventasMes = B.uno("SELECT COALESCE(SUM(total),0) AS t, COUNT(*) AS n FROM ventas WHERE fecha >= ?", [inicioMes]);
    const cobradoMes = B.uno("SELECT COALESCE(SUM(monto),0) AS t FROM cobros WHERE fecha >= ?", [inicioMes]).t;
    const ant = antiguedad();
    const vencido = r2(ant.totales.total - ant.totales.por_vencer);
    return {
      ventasMes: r2(ventasMes.t), nVentasMes: ventasMes.n, cobradoMes: r2(cobradoMes),
      porCobrar: ant.totales.total, nPendientes: ant.pendientes.length,
      vencido: vencido, pctVencido: ant.totales.total ? Math.round(vencido / ant.totales.total * 100) : 0,
      antiguedad: ant,
      prioritarias: ant.pendientes.filter(function (v) { return v.estado.clave === "vencida"; }).sort(function (a, b) { return b.estado.dias - a.estado.dias || b.saldo - a.saldo; }),
      proximas: ant.pendientes.filter(function (v) { return v.estado.clave === "pronto"; }).sort(function (a, b) { return a.vencimiento < b.vencimiento ? -1 : 1; })
    };
  }

  /** Ventas y cobros por mes (últimos n meses) */
  function porMes(n) {
    const h = new Date(hoy() + "T00:00:00");
    const etiquetas = [], ventas = [], cobros = [];
    const nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(h.getFullYear(), h.getMonth() - i, 1);
      const clave = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      etiquetas.push(nombres[d.getMonth()] + " " + String(d.getFullYear()).slice(2));
      ventas.push(r2(B.uno("SELECT COALESCE(SUM(total),0) AS t FROM ventas WHERE substr(fecha,1,7) = ?", [clave]).t));
      cobros.push(r2(B.uno("SELECT COALESCE(SUM(monto),0) AS t FROM cobros WHERE substr(fecha,1,7) = ?", [clave]).t));
    }
    return { etiquetas: etiquetas, ventas: ventas, cobros: cobros };
  }

  const api = {
    iniciar: iniciar,
    reiniciar: function () { return B.reiniciar(); },
    exportarArchivo: function () { return B.exportar(); },
    esPersistente: function () { return B.esPersistente(); },
    uno: function (s, p) { return B.uno(s, p); },
    consultar: function (s, p) { return B.consultar(s, p); },
    validarDocumento: validarDocumento, listarClientes: listarClientes, obtenerCliente: obtenerCliente,
    guardarCliente: guardarCliente, eliminarCliente: eliminarCliente,
    registrarVenta: registrarVenta, listarVentas: listarVentas, obtenerVenta: obtenerVenta, siguienteNumero: siguienteNumero, serieDe: serieDe,
    registrarCobro: registrarCobro, listarCobros: listarCobros,
    antiguedad: antiguedad, estadoCuenta: estadoCuenta, resumen: resumen, porMes: porMes,
    hoy: hoy, sumarDias: sumarDias, r2: r2, IGV: IGV
  };
  return api;
})();
