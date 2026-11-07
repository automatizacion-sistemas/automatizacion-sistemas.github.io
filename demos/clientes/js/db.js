/* ==========================================================================
   db.js — Base de datos y reglas de negocio: seguimiento de clientes (CRM)
   ---------------------------------------------------------------------------
   · Cada cliente puede tener varias oportunidades de venta (cotizaciones).
   · Una oportunidad avanza por el embudo:
       PROSPECTO → COTIZADO → NEGOCIACION → GANADO | PERDIDO
   · Regla central: toda oportunidad abierta tiene SIEMPRE una fecha de próximo
     seguimiento (hoy o después) y una próxima acción. Así ninguna cotización
     queda olvidada. Al registrar un contacto se reprograma el seguimiento.
   · Ganar exige un monto mayor a cero; perder exige indicar el motivo.
   · No se permiten clientes duplicados (mismo celular, correo o RUC).
   · El RUC se valida con su dígito verificador (algoritmo de SUNAT).
   ========================================================================== */
window.DB = (function () {
  "use strict";

  let B = null;

  const ETAPAS = [
    { id: "PROSPECTO", nombre: "Nuevo contacto", prob: 10 },
    { id: "COTIZADO", nombre: "Cotización enviada", prob: 40 },
    { id: "NEGOCIACION", nombre: "Negociación", prob: 70 },
    { id: "GANADO", nombre: "Ganado", prob: 100 },
    { id: "PERDIDO", nombre: "Perdido", prob: 0 }
  ];
  const ABIERTAS = ["PROSPECTO", "COTIZADO", "NEGOCIACION"];
  const ORIGENES = ["WhatsApp", "Facebook / Instagram", "Referido", "Página web", "Llamada"];
  const VENDEDORES = ["Carla Mendoza", "Diego Ramos", "Rosa Torres"];
  const TIPOS_ACTIVIDAD = ["Llamada", "WhatsApp", "Correo", "Visita", "Cotización", "Nota"];
  const MOTIVOS = ["Precio alto", "Eligió a la competencia", "Sin presupuesto", "No volvió a responder", "Postergó la compra"];
  const DIAS_ESTANCADA = 14;

  const ESQUEMA = `
    CREATE TABLE clientes (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre   TEXT NOT NULL,                 -- persona de contacto
      empresa  TEXT NOT NULL DEFAULT '',      -- vacío si es un cliente particular
      ruc      TEXT UNIQUE,
      telefono TEXT NOT NULL UNIQUE,          -- celular de 9 dígitos
      email    TEXT UNIQUE,
      distrito TEXT NOT NULL DEFAULT '',
      origen   TEXT NOT NULL,                 -- cómo llegó el cliente
      creado   TEXT NOT NULL
    );
    CREATE TABLE oportunidades (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id     INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      titulo         TEXT NOT NULL,
      monto          REAL NOT NULL DEFAULT 0 CHECK (monto >= 0),
      etapa          TEXT NOT NULL CHECK (etapa IN ('PROSPECTO','COTIZADO','NEGOCIACION','GANADO','PERDIDO')),
      vendedor       TEXT NOT NULL,
      creada         TEXT NOT NULL,
      cerrada        TEXT,
      motivo_perdida TEXT,
      seguimiento    TEXT,                    -- fecha del próximo contacto
      accion         TEXT,                    -- qué hay que hacer ese día
      CHECK ((etapa IN ('GANADO','PERDIDO')) = (cerrada IS NOT NULL)),
      CHECK (etapa IN ('GANADO','PERDIDO') OR seguimiento IS NOT NULL),
      CHECK (etapa <> 'PERDIDO' OR motivo_perdida IS NOT NULL)
    );
    CREATE INDEX idx_opp_etapa ON oportunidades(etapa);
    CREATE TABLE actividades (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id     INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      oportunidad_id INTEGER REFERENCES oportunidades(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      tipo           TEXT NOT NULL,
      nota           TEXT NOT NULL,
      automatica     INTEGER NOT NULL DEFAULT 0   -- 1 = la generó el sistema (cambio de etapa)
    );
    CREATE INDEX idx_act_opp ON actividades(oportunidad_id, fecha);
    CREATE TABLE cambios_etapa (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      oportunidad_id INTEGER NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      desde          TEXT,
      hacia          TEXT NOT NULL
    );
  `;

  const hoy = SQLiteDemo.hoy, sumarDias = SQLiteDemo.sumarDias, diasEntre = SQLiteDemo.diasEntre;
  const r2 = function (n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; };
  const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];
  const etapa = function (id) { return ETAPAS.find(function (e) { return e.id === id; }); };

  async function iniciar() {
    B = await SQLiteDemo.crear({ idb: "demo-seguimiento-clientes", esquema: ESQUEMA, sembrar: function (base) { B = base; window.DATOS_EJEMPLO.cargar(api); } });
    return { nuevo: B.nuevo };
  }

  /* ---------- Validaciones ---------- */
  function limpiarTelefono(t) {
    let d = String(t || "").replace(/\D/g, "");
    if (d.length === 11 && d.indexOf("51") === 0) d = d.slice(2);
    return d;
  }
  /** Dígito verificador del RUC (módulo 11, factores 5 4 3 2 7 6 5 4 3 2) */
  function rucValido(ruc) {
    if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return false;
    const f = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < 10; i++) s += Number(ruc[i]) * f[i];
    let dv = 11 - (s % 11);
    if (dv === 10) dv = 0; else if (dv === 11) dv = 1;
    return dv === Number(ruc[10]);
  }
  function validarFechaSeguimiento(f) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f || "")) throw new Error("Indica la fecha del próximo seguimiento.");
    if (f < hoy()) throw new Error("El próximo seguimiento no puede ser una fecha pasada.");
    if (diasEntre(hoy(), f) > 180) throw new Error("El próximo seguimiento no puede ser a más de 6 meses.");
  }
  function texto(v, max) { return String(v == null ? "" : v).trim().replace(/\s+/g, " ").slice(0, max || 120); }

  /* ---------- Clientes ---------- */
  function normalizarCliente(d) {
    const c = {
      nombre: texto(d.nombre, 80), empresa: texto(d.empresa, 80), ruc: texto(d.ruc, 11).replace(/\D/g, "") || null,
      telefono: limpiarTelefono(d.telefono), email: texto(d.email, 80).toLowerCase() || null, distrito: texto(d.distrito, 40), origen: texto(d.origen, 30)
    };
    if (c.nombre.length < 3) throw new Error("Escribe el nombre del contacto (mínimo 3 letras).");
    if (!/^9\d{8}$/.test(c.telefono)) throw new Error("El celular debe tener 9 dígitos y empezar con 9.");
    if (c.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(c.email)) throw new Error("El correo no tiene un formato válido.");
    if (c.ruc && !rucValido(c.ruc)) throw new Error("El RUC no es válido: revisa los 11 dígitos (el último es un dígito verificador).");
    if (c.ruc && !c.empresa) throw new Error("Si indicas RUC, escribe también la razón social de la empresa.");
    if (ORIGENES.indexOf(c.origen) < 0) throw new Error("Elige cómo llegó el cliente.");
    return c;
  }
  function buscarDuplicado(c, excluirId) {
    const d = B.uno("SELECT id, nombre, empresa, telefono, email, ruc FROM clientes WHERE id <> ? AND (telefono = ? OR (email IS NOT NULL AND email = ?) OR (ruc IS NOT NULL AND ruc = ?))",
      [excluirId || 0, c.telefono, c.email || "", c.ruc || ""]);
    if (!d) return;
    const campo = d.telefono === c.telefono ? "el celular" : d.email === c.email ? "el correo" : "el RUC";
    throw new Error("Ya existe un cliente con " + campo + ": " + d.nombre + (d.empresa ? " (" + d.empresa + ")" : "") + ".");
  }
  function crearCliente(d, op) {
    const c = normalizarCliente(d);
    buscarDuplicado(c);
    B.ejecutar("INSERT INTO clientes (nombre, empresa, ruc, telefono, email, distrito, origen, creado) VALUES (?,?,?,?,?,?,?,?)",
      [c.nombre, c.empresa, c.ruc, c.telefono, c.email, c.distrito, c.origen, (op && op.fecha) || hoy()]);
    const id = B.ultimoId();
    if (!(op && op.sinGuardar)) B.guardar();
    return id;
  }
  function editarCliente(id, d) {
    const c = normalizarCliente(d);
    buscarDuplicado(c, id);
    B.ejecutar("UPDATE clientes SET nombre=?, empresa=?, ruc=?, telefono=?, email=?, distrito=?, origen=? WHERE id=?",
      [c.nombre, c.empresa, c.ruc, c.telefono, c.email, c.distrito, c.origen, id]);
    B.guardar();
  }
  function eliminarCliente(id) {
    B.ejecutar("DELETE FROM clientes WHERE id = ?", [id]);
    B.guardar();
  }
  function cliente(id) { return B.uno("SELECT * FROM clientes WHERE id = ?", [id]); }
  function listarClientes(filtro) {
    filtro = filtro || {};
    const w = [], p = [];
    if (filtro.texto) { w.push("(c.nombre LIKE ? OR c.empresa LIKE ? OR c.telefono LIKE ? OR c.distrito LIKE ?)"); const t = "%" + filtro.texto + "%"; p.push(t, t, t, t); }
    if (filtro.origen) { w.push("c.origen = ?"); p.push(filtro.origen); }
    let sql = `SELECT c.*,
        (SELECT COUNT(*) FROM oportunidades o WHERE o.cliente_id = c.id AND o.etapa IN ('PROSPECTO','COTIZADO','NEGOCIACION')) AS abiertas,
        (SELECT COALESCE(SUM(monto),0) FROM oportunidades o WHERE o.cliente_id = c.id AND o.etapa = 'GANADO') AS ganado,
        (SELECT MAX(fecha) FROM actividades a WHERE a.cliente_id = c.id) AS ultimo_contacto
      FROM clientes c` + (w.length ? " WHERE " + w.join(" AND ") : "");
    const filas = B.consultar(sql, p);
    if (filtro.estado === "abiertas") return filas.filter(function (c) { return c.abiertas > 0; }).sort(ordenNombre);
    if (filtro.estado === "compraron") return filas.filter(function (c) { return c.ganado > 0; }).sort(ordenNombre);
    if (filtro.estado === "inactivos") return filas.filter(function (c) { return !c.abiertas && (!c.ultimo_contacto || diasEntre(c.ultimo_contacto, hoy()) > 60); }).sort(ordenNombre);
    return filas.sort(ordenNombre);
  }
  function ordenNombre(a, b) { return (a.empresa || a.nombre).localeCompare(b.empresa || b.nombre, "es"); }

  /* ---------- Oportunidades ---------- */
  const SQL_OPP = `SELECT o.*, c.nombre AS cliente, c.empresa, c.telefono, c.email, c.origen,
      (SELECT MAX(fecha) FROM actividades a WHERE a.oportunidad_id = o.id) AS ultima_actividad
    FROM oportunidades o JOIN clientes c ON c.id = o.cliente_id`;
  function oportunidad(id) { return B.uno(SQL_OPP + " WHERE o.id = ?", [id]); }
  function oportunidades(filtro) {
    filtro = filtro || {};
    const w = [], p = [];
    if (filtro.cliente) { w.push("o.cliente_id = ?"); p.push(filtro.cliente); }
    if (filtro.vendedor) { w.push("o.vendedor = ?"); p.push(filtro.vendedor); }
    if (filtro.etapas) { w.push("o.etapa IN (" + filtro.etapas.map(function () { return "?"; }).join(",") + ")"); p.push.apply(p, filtro.etapas); }
    if (filtro.texto) { w.push("(o.titulo LIKE ? OR c.nombre LIKE ? OR c.empresa LIKE ?)"); const t = "%" + filtro.texto + "%"; p.push(t, t, t); }
    if (filtro.cerradaDesde) { w.push("(o.cerrada IS NULL OR o.cerrada >= ?)"); p.push(filtro.cerradaDesde); }
    return B.consultar(SQL_OPP + (w.length ? " WHERE " + w.join(" AND ") : "") + " ORDER BY COALESCE(o.seguimiento, o.cerrada), o.id", p)
      .map(enriquecer);
  }
  function enriquecer(o) {
    const h = hoy();
    o.abierta = ABIERTAS.indexOf(o.etapa) >= 0;
    o.vencida = o.abierta && o.seguimiento < h;
    o.diasSinContacto = o.ultima_actividad ? diasEntre(o.ultima_actividad, h) : diasEntre(o.creada, h);
    o.estancada = o.abierta && o.diasSinContacto > DIAS_ESTANCADA;
    o.ponderado = r2(o.monto * etapa(o.etapa).prob / 100);
    return o;
  }
  function crearOportunidad(d, op) {
    op = op || {};
    const titulo = texto(d.titulo, 90), monto = Number(d.monto || 0), fecha = op.fecha || hoy();
    if (!cliente(d.cliente_id)) throw new Error("Elige el cliente.");
    if (titulo.length < 4) throw new Error("Describe qué necesita el cliente (mínimo 4 letras).");
    if (!isFinite(monto) || monto < 0) throw new Error("El monto estimado no puede ser negativo.");
    if (monto > 10000000) throw new Error("El monto estimado es demasiado alto.");
    if (VENDEDORES.indexOf(d.vendedor) < 0) throw new Error("Elige el vendedor responsable.");
    if (!op.historico) validarFechaSeguimiento(d.seguimiento);
    const accion = texto(d.accion, 90) || "Llamar para entender la necesidad";
    B.ejecutar("INSERT INTO oportunidades (cliente_id, titulo, monto, etapa, vendedor, creada, seguimiento, accion) VALUES (?,?,?,?,?,?,?,?)",
      [d.cliente_id, titulo, r2(monto), "PROSPECTO", d.vendedor, fecha, d.seguimiento, accion]);
    const id = B.ultimoId();
    B.ejecutar("INSERT INTO cambios_etapa (oportunidad_id, fecha, desde, hacia) VALUES (?,?,NULL,'PROSPECTO')", [id, fecha]);
    if (!op.sinGuardar) B.guardar();
    return id;
  }

  /**
   * Cambia la etapa. datos: { seguimiento, accion } si queda abierta,
   * { monto } al ganar (opcional, para confirmar el monto final), { motivo } al perder.
   */
  function moverEtapa(id, hacia, datos, op) {
    datos = datos || {}; op = op || {};
    const o = oportunidad(id), fecha = op.fecha || hoy();
    if (!o) throw new Error("La oportunidad no existe.");
    if (!etapa(hacia)) throw new Error("Etapa desconocida.");
    if (o.etapa === hacia) throw new Error("La oportunidad ya está en esa etapa.");
    if (ABIERTAS.indexOf(o.etapa) < 0) throw new Error("La oportunidad ya está cerrada. Para retomarla, crea una nueva oportunidad para el cliente.");
    let monto = o.monto;
    if (hacia === "GANADO") {
      if (datos.monto !== undefined && datos.monto !== "") monto = r2(Number(datos.monto));
      if (!isFinite(monto) || monto <= 0) throw new Error("Para marcarla como ganada, indica el monto final de la venta.");
      B.ejecutar("UPDATE oportunidades SET etapa='GANADO', monto=?, cerrada=?, seguimiento=NULL, accion=NULL WHERE id=?", [monto, fecha, id]);
    } else if (hacia === "PERDIDO") {
      if (MOTIVOS.indexOf(datos.motivo) < 0) throw new Error("Indica el motivo por el que se perdió: sirve para mejorar las próximas ventas.");
      B.ejecutar("UPDATE oportunidades SET etapa='PERDIDO', motivo_perdida=?, cerrada=?, seguimiento=NULL, accion=NULL WHERE id=?", [datos.motivo, fecha, id]);
    } else {
      if (!op.historico) validarFechaSeguimiento(datos.seguimiento);
      const accion = texto(datos.accion, 90);
      if (accion.length < 3) throw new Error("Indica cuál es la próxima acción.");
      B.ejecutar("UPDATE oportunidades SET etapa=?, seguimiento=?, accion=? WHERE id=?", [hacia, datos.seguimiento, accion, id]);
    }
    B.ejecutar("INSERT INTO cambios_etapa (oportunidad_id, fecha, desde, hacia) VALUES (?,?,?,?)", [id, fecha, o.etapa, hacia]);
    const nota = hacia === "GANADO" ? "Venta cerrada por S/ " + monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })
      : hacia === "PERDIDO" ? "Oportunidad perdida: " + datos.motivo.toLowerCase()
      : "Pasó de «" + etapa(o.etapa).nombre + "» a «" + etapa(hacia).nombre + "»";
    B.ejecutar("INSERT INTO actividades (cliente_id, oportunidad_id, fecha, tipo, nota, automatica) VALUES (?,?,?,?,?,1)", [o.cliente_id, id, fecha, "Cambio de etapa", nota]);
    if (!op.sinGuardar) B.guardar();
  }

  /** Registra un contacto con el cliente y, si la oportunidad sigue abierta, reprograma el seguimiento */
  function registrarActividad(d, op) {
    op = op || {};
    const nota = texto(d.nota, 300), fecha = d.fecha || hoy();
    if (TIPOS_ACTIVIDAD.indexOf(d.tipo) < 0) throw new Error("Elige el tipo de contacto.");
    if (nota.length < 3) throw new Error("Anota qué se habló o qué pasó (mínimo 3 letras).");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("La fecha no es válida.");
    if (fecha > hoy()) throw new Error("No puedes registrar un contacto con fecha futura: para eso está el próximo seguimiento.");
    let clienteId = d.cliente_id, o = null;
    if (d.oportunidad_id) {
      o = oportunidad(d.oportunidad_id);
      if (!o) throw new Error("La oportunidad no existe.");
      if (fecha < o.creada) throw new Error("La fecha es anterior a la creación de la oportunidad.");
      clienteId = o.cliente_id;
    }
    if (!cliente(clienteId)) throw new Error("El cliente no existe.");
    const abierta = o && ABIERTAS.indexOf(o.etapa) >= 0;
    let accion = null;
    if (abierta && !op.historico) {
      validarFechaSeguimiento(d.seguimiento);
      accion = texto(d.accion, 90);
      if (accion.length < 3) throw new Error("Indica cuál es la próxima acción.");
    }
    B.ejecutar("INSERT INTO actividades (cliente_id, oportunidad_id, fecha, tipo, nota) VALUES (?,?,?,?,?)", [clienteId, d.oportunidad_id || null, fecha, d.tipo, nota]);
    if (abierta && d.seguimiento) B.ejecutar("UPDATE oportunidades SET seguimiento=?, accion=COALESCE(?, accion) WHERE id=?", [d.seguimiento, accion || texto(d.accion, 90) || null, o.id]);
    if (!op.sinGuardar) B.guardar();
  }
  function actividades(filtro) {
    const w = [], p = [];
    if (filtro.oportunidad) { w.push("a.oportunidad_id = ?"); p.push(filtro.oportunidad); }
    if (filtro.cliente) { w.push("a.cliente_id = ?"); p.push(filtro.cliente); }
    return B.consultar("SELECT a.*, o.titulo FROM actividades a LEFT JOIN oportunidades o ON o.id = a.oportunidad_id" + (w.length ? " WHERE " + w.join(" AND ") : "") + " ORDER BY a.fecha DESC, a.id DESC", p);
  }

  /* ---------- Agenda e indicadores ---------- */
  function agenda(vendedor) {
    const abiertas = oportunidades({ etapas: ABIERTAS, vendedor: vendedor || null }), h = hoy(), en7 = sumarDias(h, 7);
    return {
      vencidas: abiertas.filter(function (o) { return o.seguimiento < h; }).sort(function (a, b) { return a.seguimiento.localeCompare(b.seguimiento); }),
      hoy: abiertas.filter(function (o) { return o.seguimiento === h; }),
      proximas: abiertas.filter(function (o) { return o.seguimiento > h && o.seguimiento <= en7; }),
      estancadas: abiertas.filter(function (o) { return o.estancada; }).sort(function (a, b) { return b.diasSinContacto - a.diasSinContacto; })
    };
  }
  function indicadores(vendedor) {
    const h = hoy(), mes = h.slice(0, 7), hace90 = sumarDias(h, -90);
    const todas = oportunidades({ vendedor: vendedor || null });
    const abiertas = todas.filter(function (o) { return o.abierta; });
    const ganadasMes = todas.filter(function (o) { return o.etapa === "GANADO" && o.cerrada.slice(0, 7) === mes; });
    const cerradas90 = todas.filter(function (o) { return !o.abierta && o.cerrada >= hace90; });
    const ganadas90 = cerradas90.filter(function (o) { return o.etapa === "GANADO"; });
    const ciclo = ganadas90.map(function (o) { return diasEntre(o.creada, o.cerrada); });
    return {
      abiertas: abiertas.length,
      embudo: r2(abiertas.reduce(function (s, o) { return s + o.monto; }, 0)),
      ponderado: r2(abiertas.reduce(function (s, o) { return s + o.ponderado; }, 0)),
      ganadoMes: r2(ganadasMes.reduce(function (s, o) { return s + o.monto; }, 0)),
      ventasMes: ganadasMes.length,
      tasaCierre: cerradas90.length ? Math.round(ganadas90.length / cerradas90.length * 100) : 0,
      cerradas90: cerradas90.length,
      cicloDias: ciclo.length ? Math.round(ciclo.reduce(function (s, v) { return s + v; }, 0) / ciclo.length) : 0,
      vencidas: abiertas.filter(function (o) { return o.vencida; }).length
    };
  }

  /* ---------- Reportes ---------- */
  function mesesAtras(n) {
    const out = [], d = new Date(hoy() + "T00:00:00");
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ clave: x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"), etiqueta: NOMBRES_MES[x.getMonth()] + " " + String(x.getFullYear()).slice(2) });
    }
    return out;
  }
  function reportes(meses) {
    meses = meses || 6;
    const lista = mesesAtras(meses), desde = lista[0].clave + "-01";
    const creadas = oportunidades({}).filter(function (o) { return o.creada >= desde; });
    // Embudo de conversión: cuántas oportunidades creadas en el período llegaron a cada etapa
    const llego = function (o, e) { return !!B.uno("SELECT 1 AS x FROM cambios_etapa WHERE oportunidad_id = ? AND hacia = ?", [o.id, e]); };
    const conversion = ["PROSPECTO", "COTIZADO", "NEGOCIACION", "GANADO"].map(function (e) {
      return { etapa: etapa(e), cantidad: creadas.filter(function (o) { return e === "PROSPECTO" || llego(o, e); }).length };
    });
    const agrupar = function (lista, clave, nombres) {
      return nombres.map(function (n) {
        const g = lista.filter(function (o) { return o[clave] === n; }), gan = g.filter(function (o) { return o.etapa === "GANADO"; }), cer = g.filter(function (o) { return !o.abierta; });
        return { nombre: n, total: g.length, abiertas: g.length - cer.length, ganadas: gan.length, perdidas: cer.length - gan.length,
          tasa: cer.length ? Math.round(gan.length / cer.length * 100) : null, monto: r2(gan.reduce(function (s, o) { return s + o.monto; }, 0)),
          embudo: r2(g.filter(function (o) { return o.abierta; }).reduce(function (s, o) { return s + o.monto; }, 0)) };
      });
    };
    const perdidas = creadas.filter(function (o) { return o.etapa === "PERDIDO"; });
    const motivos = MOTIVOS.map(function (m) {
      const g = perdidas.filter(function (o) { return o.motivo_perdida === m; });
      return { motivo: m, cantidad: g.length, monto: r2(g.reduce(function (s, o) { return s + o.monto; }, 0)) };
    }).sort(function (a, b) { return b.cantidad - a.cantidad; });
    const porMes = lista.map(function (m) {
      const gan = B.uno("SELECT COUNT(*) AS n, COALESCE(SUM(monto),0) AS t FROM oportunidades WHERE etapa='GANADO' AND substr(cerrada,1,7) = ?", [m.clave]);
      const nuevas = B.uno("SELECT COUNT(*) AS n FROM oportunidades WHERE substr(creada,1,7) = ?", [m.clave]).n;
      return { etiqueta: m.etiqueta, clave: m.clave, ganado: r2(gan.t), ventas: gan.n, nuevas: nuevas };
    });
    return { meses: lista, conversion: conversion, origen: agrupar(creadas, "origen", ORIGENES), vendedor: agrupar(creadas, "vendedor", VENDEDORES), motivos: motivos, porMes: porMes, total: creadas.length };
  }

  /* ---------- Mensajes de WhatsApp (se abren en WhatsApp, no se envían solos) ---------- */
  const PLANTILLAS = [
    { id: "cotizacion", nombre: "Seguimiento de cotización", texto: "Hola {nombre}, le saluda {vendedor} de Frío Andino. ¿Pudo revisar la cotización de {titulo}? Quedo atento(a) a sus consultas." },
    { id: "recordatorio", nombre: "Recordatorio amable", texto: "Hola {nombre}, ¿cómo está? Le escribo para saber si sigue interesado(a) en {titulo}. Si lo desea, podemos coordinar una visita sin costo." },
    { id: "cierre", nombre: "Propuesta de cierre", texto: "Hola {nombre}, para avanzar con {titulo} podemos agendar la instalación esta semana. ¿Qué día le acomoda?" },
    { id: "gracias", nombre: "Agradecimiento por la compra", texto: "Hola {nombre}, gracias por confiar en Frío Andino para {titulo}. Cualquier consulta sobre el servicio, escríbanos por aquí." }
  ];
  function mensaje(o, plantillaId) {
    const p = PLANTILLAS.find(function (x) { return x.id === plantillaId; }) || PLANTILLAS[0];
    return p.texto.replace("{nombre}", o.cliente.split(" ")[0]).replace("{vendedor}", o.vendedor.split(" ")[0]).replace("{titulo}", o.titulo.charAt(0).toLowerCase() + o.titulo.slice(1));
  }
  function enlaceWhatsApp(telefono, textoMensaje) { return "https://wa.me/51" + limpiarTelefono(telefono) + "?text=" + encodeURIComponent(textoMensaje); }

  const api = {
    iniciar: iniciar, reiniciar: function () { return B.reiniciar(); }, exportarArchivo: function () { return B.exportar(); }, esPersistente: function () { return B.esPersistente(); },
    uno: function (s, p) { return B.uno(s, p); }, consultar: function (s, p) { return B.consultar(s, p); }, ejecutar: function (s, p) { return B.ejecutar(s, p); },
    ETAPAS: ETAPAS, ABIERTAS: ABIERTAS, ORIGENES: ORIGENES, VENDEDORES: VENDEDORES, TIPOS_ACTIVIDAD: TIPOS_ACTIVIDAD, MOTIVOS: MOTIVOS, PLANTILLAS: PLANTILLAS, DIAS_ESTANCADA: DIAS_ESTANCADA,
    etapa: etapa, rucValido: rucValido, limpiarTelefono: limpiarTelefono,
    crearCliente: crearCliente, editarCliente: editarCliente, eliminarCliente: eliminarCliente, cliente: cliente, listarClientes: listarClientes,
    oportunidad: function (id) { const o = oportunidad(id); return o && enriquecer(o); }, oportunidades: oportunidades, crearOportunidad: crearOportunidad, moverEtapa: moverEtapa,
    registrarActividad: registrarActividad, actividades: actividades,
    agenda: agenda, indicadores: indicadores, reportes: reportes, mensaje: mensaje, enlaceWhatsApp: enlaceWhatsApp,
    hoy: hoy, sumarDias: sumarDias, diasEntre: diasEntre, r2: r2
  };
  return api;
})();
