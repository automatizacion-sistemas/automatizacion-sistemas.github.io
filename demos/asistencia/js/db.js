/* ==========================================================================
   db.js — Base de datos y reglas de negocio: control de asistencia
   ---------------------------------------------------------------------------
   Cómo se califica cada día de cada trabajador:
   · D  Descanso: el día no está en su horario.
   · V/M/P/L  Vacaciones, descanso médico, permiso con goce o licencia sin goce.
   · P  Puntual: marcó entrada dentro de la tolerancia.
   · T  Tardanza: marcó después de la hora de entrada + tolerancia.
        Los minutos de tardanza se cuentan desde la hora de entrada.
   · F  Falta: día laborable sin marcación ni permiso.
   · Pendiente: hoy, antes de que termine su tolerancia de entrada.
   Horas trabajadas = salida − entrada − refrigerio.
   Horas extra = tiempo trabajado después de la hora de salida (desde 15 min).
   Descuento referencial: minuto = sueldo ÷ 30 ÷ 8 ÷ 60; falta o licencia sin goce = sueldo ÷ 30.
   ========================================================================== */
window.DB = (function () {
  "use strict";

  let B = null;
  const MIN_EXTRA = 15;

  const ESQUEMA = `
    CREATE TABLE horarios (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre         TEXT NOT NULL,
      entrada        TEXT NOT NULL,                 -- HH:MM
      salida         TEXT NOT NULL,                 -- HH:MM
      refrigerio_min INTEGER NOT NULL DEFAULT 60,
      tolerancia_min INTEGER NOT NULL DEFAULT 10,
      dias           TEXT NOT NULL DEFAULT '1,2,3,4,5'  -- 0 = domingo … 6 = sábado
    );

    CREATE TABLE trabajadores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      dni         TEXT NOT NULL UNIQUE,
      nombre      TEXT NOT NULL,
      area        TEXT NOT NULL,
      cargo       TEXT NOT NULL DEFAULT '',
      horario_id  INTEGER NOT NULL REFERENCES horarios(id),
      sueldo      REAL NOT NULL DEFAULT 0 CHECK (sueldo >= 0),
      ingreso     TEXT NOT NULL,
      activo      INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE marcaciones (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id  INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
      fecha          TEXT NOT NULL,
      entrada        TEXT NOT NULL,
      salida         TEXT,
      origen         TEXT NOT NULL DEFAULT 'Marcación',   -- Marcación | Corrección
      observacion    TEXT NOT NULL DEFAULT '',
      UNIQUE (trabajador_id, fecha)
    );
    CREATE INDEX idx_marc_fecha ON marcaciones(fecha);

    CREATE TABLE permisos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id  INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
      tipo           TEXT NOT NULL CHECK (tipo IN ('Vacaciones','Descanso médico','Permiso con goce','Licencia sin goce')),
      desde          TEXT NOT NULL,
      hasta          TEXT NOT NULL,
      observacion    TEXT NOT NULL DEFAULT '',
      CHECK (hasta >= desde)
    );
  `;

  const CODIGO_PERMISO = { "Vacaciones": "V", "Descanso médico": "M", "Permiso con goce": "P", "Licencia sin goce": "L" };
  const hoy = SQLiteDemo.hoy, sumarDias = SQLiteDemo.sumarDias, iso = SQLiteDemo.iso;

  /* ---------- Horas ---------- */
  function aMin(hhmm) { const p = String(hhmm).split(":"); return Number(p[0]) * 60 + Number(p[1]); }
  function aHora(min) { min = Math.round(min); return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
  function horaValida(h) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(h || ""); }
  function ahoraMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function horaActual() { return aHora(ahoraMin()); }
  function diaSemana(fecha) { return new Date(fecha + "T00:00:00").getDay(); }

  async function iniciar() {
    B = await SQLiteDemo.crear({
      idb: "demo-control-asistencia",
      esquema: ESQUEMA,
      sembrar: function (base) { B = base; window.DATOS_EJEMPLO.cargar(api); }
    });
    return { nuevo: B.nuevo };
  }

  /* ---------- Calificación de un día ---------- */
  /**
   * Devuelve el estado de un trabajador en una fecha.
   * t: trabajador con su horario (h_*), m: marcación o null, permisos: lista del trabajador
   */
  function calificar(t, fecha, m, permisos, ref) {
    ref = ref || { hoy: hoy(), ahora: ahoraMin() };
    const r = { fecha: fecha, codigo: "", texto: "", clase: "vacio", tardanza: 0, horas: 0, extra: 0, entrada: m ? m.entrada : null, salida: m ? m.salida : null, sinSalida: false, laborable: false, descuentoDia: false };
    if (fecha < t.ingreso || fecha > ref.hoy) return r;
    const laborable = t.h_dias.split(",").indexOf(String(diaSemana(fecha))) !== -1;
    r.laborable = laborable;
    const permiso = permisos.find(function (p) { return p.desde <= fecha && fecha <= p.hasta; });

    if (m) {
      const entrada = aMin(m.entrada), inicio = aMin(t.h_entrada), fin = aMin(t.h_salida);
      const tarde = entrada - inicio;
      r.tardanza = laborable && tarde > t.h_tolerancia ? tarde : 0;
      r.codigo = r.tardanza ? "T" : "A";
      r.texto = r.tardanza ? "Tardanza " + r.tardanza + " min" : (laborable ? "Puntual" : "Asistió (día de descanso)");
      r.clase = r.tardanza ? "tardanza" : "puntual";
      if (m.salida) {
        const salida = aMin(m.salida);
        r.horas = Math.max(0, (salida - entrada - (salida - entrada > 300 ? t.h_refrigerio : 0)) / 60);
        const extra = laborable ? salida - fin : salida - entrada;
        r.extra = extra >= MIN_EXTRA ? extra / 60 : 0;
      } else if (fecha < ref.hoy) {
        r.sinSalida = true;
        r.texto += " · sin salida";
      } else {
        r.texto += " · en jornada";
      }
      return r;
    }
    if (!laborable) { r.codigo = "D"; r.texto = "Descanso"; r.clase = "descanso"; return r; }
    if (permiso) {
      r.codigo = CODIGO_PERMISO[permiso.tipo]; r.texto = permiso.tipo; r.clase = "permiso";
      r.permiso = permiso; r.descuentoDia = permiso.tipo === "Licencia sin goce";
      return r;
    }
    if (fecha === ref.hoy && ref.ahora <= aMin(t.h_entrada) + t.h_tolerancia) {
      r.codigo = "·"; r.texto = "Por llegar (entra " + t.h_entrada + ")"; r.clase = "pendiente"; return r;
    }
    r.codigo = "F"; r.texto = "Falta"; r.clase = "falta"; r.descuentoDia = true;
    return r;
  }

  /* ---------- Trabajadores y horarios ---------- */
  const SQL_TRAB = `SELECT t.*, h.nombre AS h_nombre, h.entrada AS h_entrada, h.salida AS h_salida, h.refrigerio_min AS h_refrigerio,
                           h.tolerancia_min AS h_tolerancia, h.dias AS h_dias
                    FROM trabajadores t JOIN horarios h ON h.id = t.horario_id`;
  function horarios() { return B.consultar("SELECT * FROM horarios ORDER BY entrada"); }
  function areas() { return B.consultar("SELECT DISTINCT area FROM trabajadores ORDER BY area").map(function (r) { return r.area; }); }
  function listarTrabajadores(filtro) {
    filtro = filtro || {};
    const cond = [], p = {};
    if (!filtro.incluirInactivos) cond.push("t.activo = 1");
    if (filtro.texto) { cond.push("(t.nombre LIKE :t OR t.dni LIKE :t OR t.cargo LIKE :t)"); p[":t"] = "%" + filtro.texto + "%"; }
    if (filtro.area) { cond.push("t.area = :a"); p[":a"] = filtro.area; }
    return B.consultar(SQL_TRAB + (cond.length ? " WHERE " + cond.join(" AND ") : "") + " ORDER BY t.nombre", p);
  }
  function obtenerTrabajador(id) { return B.uno(SQL_TRAB + " WHERE t.id = ?", [id]); }
  function buscarPorDni(dni) { return B.uno(SQL_TRAB + " WHERE t.dni = ? AND t.activo = 1", [String(dni).trim()]); }

  function guardarTrabajador(t) {
    const dni = String(t.dni || "").trim(), nombre = String(t.nombre || "").trim(), area = String(t.area || "").trim();
    if (!/^\d{8}$/.test(dni)) throw new Error("El DNI debe tener 8 dígitos.");
    if (nombre.length < 5) throw new Error("Escribe nombres y apellidos.");
    if (!area) throw new Error("Indica el área.");
    if (!B.uno("SELECT id FROM horarios WHERE id = ?", [t.horario_id])) throw new Error("Selecciona un horario.");
    const sueldo = Number(t.sueldo);
    if (!(sueldo >= 0)) throw new Error("El sueldo debe ser 0 o un monto positivo.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.ingreso || "")) throw new Error("Indica la fecha de ingreso.");
    if (B.uno("SELECT id FROM trabajadores WHERE dni = ? AND id <> ?", [dni, t.id || 0])) throw new Error("Ya existe un trabajador con el DNI " + dni + ".");
    const v = [dni, nombre, area, String(t.cargo || "").trim(), Number(t.horario_id), sueldo, t.ingreso, t.activo === false ? 0 : 1];
    if (t.id) B.ejecutar("UPDATE trabajadores SET dni=?, nombre=?, area=?, cargo=?, horario_id=?, sueldo=?, ingreso=?, activo=? WHERE id=?", v.concat([t.id]));
    else B.ejecutar("INSERT INTO trabajadores (dni, nombre, area, cargo, horario_id, sueldo, ingreso, activo) VALUES (?,?,?,?,?,?,?,?)", v);
    const id = t.id || B.ultimoId();
    B.guardar();
    return id;
  }
  function darDeBaja(id) { B.ejecutar("UPDATE trabajadores SET activo = 0 WHERE id = ?", [id]); B.guardar(); }

  /* ---------- Marcaciones ---------- */
  function marcacionDe(trabajadorId, fecha) { return B.uno("SELECT * FROM marcaciones WHERE trabajador_id = ? AND fecha = ?", [trabajadorId, fecha]); }

  /** Marcación con la hora real del dispositivo. Devuelve { tipo, hora, estado } */
  function marcar(trabajadorId) {
    const t = obtenerTrabajador(trabajadorId);
    if (!t || !t.activo) throw new Error("Trabajador no encontrado o dado de baja.");
    const f = hoy(), hora = horaActual();
    const m = marcacionDe(t.id, f);
    if (!m) {
      B.ejecutar("INSERT INTO marcaciones (trabajador_id, fecha, entrada) VALUES (?,?,?)", [t.id, f, hora]);
      B.guardar();
      return { tipo: "entrada", hora: hora, estado: calificar(t, f, marcacionDe(t.id, f), permisosDe(t.id)) };
    }
    if (!m.salida) {
      if (aMin(hora) - aMin(m.entrada) < 1) throw new Error("La salida debe ser al menos un minuto después de la entrada (" + m.entrada + ").");
      B.ejecutar("UPDATE marcaciones SET salida = ? WHERE id = ?", [hora, m.id]);
      B.guardar();
      return { tipo: "salida", hora: hora, estado: calificar(t, f, marcacionDe(t.id, f), permisosDe(t.id)) };
    }
    throw new Error(t.nombre + " ya registró entrada (" + m.entrada + ") y salida (" + m.salida + ") hoy.");
  }

  /** Corrección manual de una marcación (por RR. HH.) */
  function corregir(c) {
    const t = obtenerTrabajador(c.trabajador_id);
    if (!t) throw new Error("Trabajador no encontrado.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.fecha || "") || c.fecha > hoy()) throw new Error("La fecha no es válida o es futura.");
    if (c.fecha < t.ingreso) throw new Error("La fecha es anterior al ingreso del trabajador.");
    if (!horaValida(c.entrada)) throw new Error("La hora de entrada debe tener el formato HH:MM.");
    if (c.salida && !horaValida(c.salida)) throw new Error("La hora de salida debe tener el formato HH:MM.");
    if (c.salida && aMin(c.salida) <= aMin(c.entrada)) throw new Error("La salida debe ser posterior a la entrada.");
    if (c.fecha === hoy() && aMin(c.entrada) > ahoraMin()) throw new Error("La entrada de hoy no puede ser posterior a la hora actual.");
    const obs = String(c.observacion || "").trim();
    if (obs.length < 5) throw new Error("Indica el motivo de la corrección (mínimo 5 caracteres).");
    const m = marcacionDe(t.id, c.fecha);
    if (m) B.ejecutar("UPDATE marcaciones SET entrada=?, salida=?, origen='Corrección', observacion=? WHERE id=?", [c.entrada, c.salida || null, obs, m.id]);
    else B.ejecutar("INSERT INTO marcaciones (trabajador_id, fecha, entrada, salida, origen, observacion) VALUES (?,?,?,?, 'Corrección', ?)", [t.id, c.fecha, c.entrada, c.salida || null, obs]);
    B.guardar();
  }
  function eliminarMarcacion(trabajadorId, fecha) { B.ejecutar("DELETE FROM marcaciones WHERE trabajador_id = ? AND fecha = ?", [trabajadorId, fecha]); B.guardar(); }

  /** Solo para los datos de ejemplo */
  function insertarMarcacionesEnLote(lista) {
    const st = B.preparar("INSERT INTO marcaciones (trabajador_id, fecha, entrada, salida, origen, observacion) VALUES (?,?,?,?,?,?)");
    try { lista.forEach(function (m) { st.run([m.trabajador_id, m.fecha, m.entrada, m.salida || null, m.origen || "Marcación", m.observacion || ""]); }); }
    finally { st.free(); }
  }

  /* ---------- Permisos ---------- */
  function permisosDe(trabajadorId) { return B.consultar("SELECT * FROM permisos WHERE trabajador_id = ? ORDER BY desde", [trabajadorId]); }
  function listarPermisos() {
    return B.consultar("SELECT p.*, t.nombre, t.dni FROM permisos p JOIN trabajadores t ON t.id = p.trabajador_id ORDER BY p.desde DESC");
  }
  function registrarPermiso(p) {
    const t = obtenerTrabajador(p.trabajador_id);
    if (!t) throw new Error("Selecciona un trabajador.");
    if (!CODIGO_PERMISO[p.tipo]) throw new Error("Selecciona el tipo de permiso.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.desde || "") || !/^\d{4}-\d{2}-\d{2}$/.test(p.hasta || "")) throw new Error("Indica las fechas de inicio y fin.");
    if (p.hasta < p.desde) throw new Error("La fecha final no puede ser anterior a la inicial.");
    const cruce = B.uno("SELECT tipo, desde, hasta FROM permisos WHERE trabajador_id = ? AND desde <= ? AND hasta >= ?", [t.id, p.hasta, p.desde]);
    if (cruce) throw new Error("Las fechas se cruzan con un registro de " + cruce.tipo.toLowerCase() + " del " + cruce.desde.split("-").reverse().join("/") + " al " + cruce.hasta.split("-").reverse().join("/") + ".");
    B.ejecutar("INSERT INTO permisos (trabajador_id, tipo, desde, hasta, observacion) VALUES (?,?,?,?,?)", [t.id, p.tipo, p.desde, p.hasta, String(p.observacion || "").trim()]);
    if (!p.sinGuardar) B.guardar();
  }
  function eliminarPermiso(id) { B.ejecutar("DELETE FROM permisos WHERE id = ?", [id]); B.guardar(); }

  /* ---------- Vistas calculadas ---------- */
  function diasDelMes(anioMes) {
    const [a, m] = anioMes.split("-").map(Number);
    const n = new Date(a, m, 0).getDate();
    const dias = [];
    for (let d = 1; d <= n; d++) dias.push(anioMes + "-" + String(d).padStart(2, "0"));
    return dias;
  }

  /** Cuadrícula del mes: [{ trabajador, dias: [estado…] }] */
  function registroMensual(anioMes, filtro) {
    const fechas = diasDelMes(anioMes);
    const trabajadores = listarTrabajadores(filtro);
    const marc = {}, perm = {};
    B.consultar("SELECT * FROM marcaciones WHERE fecha BETWEEN ? AND ?", [fechas[0], fechas[fechas.length - 1]]).forEach(function (m) { marc[m.trabajador_id + "|" + m.fecha] = m; });
    B.consultar("SELECT * FROM permisos WHERE desde <= ? AND hasta >= ?", [fechas[fechas.length - 1], fechas[0]]).forEach(function (p) { (perm[p.trabajador_id] = perm[p.trabajador_id] || []).push(p); });
    const ref = { hoy: hoy(), ahora: ahoraMin() };
    return {
      fechas: fechas,
      filas: trabajadores.map(function (t) {
        return { trabajador: t, dias: fechas.map(function (f) { return calificar(t, f, marc[t.id + "|" + f] || null, perm[t.id] || [], ref); }) };
      })
    };
  }

  /** Resumen mensual por trabajador, para planillas */
  function reporteMensual(anioMes, filtro) {
    const reg = registroMensual(anioMes, filtro);
    const filas = reg.filas.map(function (f) {
      const t = f.trabajador, r = { trabajador: t, laborables: 0, asistencias: 0, tardanzas: 0, minTardanza: 0, faltas: 0, permisos: 0, sinGoce: 0, sinSalida: 0, horas: 0, extra: 0 };
      f.dias.forEach(function (d) {
        if (d.laborable && d.codigo && d.codigo !== "·") r.laborables++;
        if (d.codigo === "A" || d.codigo === "T") { r.asistencias++; r.horas += d.horas; r.extra += d.extra; }
        if (d.codigo === "T") { r.tardanzas++; r.minTardanza += d.tardanza; }
        if (d.codigo === "F") r.faltas++;
        if (d.permiso) { r.permisos++; if (d.descuentoDia) r.sinGoce++; }
        if (d.sinSalida) r.sinSalida++;
      });
      const valorDia = t.sueldo / 30, valorMin = t.sueldo / 30 / 8 / 60;
      r.descTardanza = Math.round(r.minTardanza * valorMin * 100) / 100;
      r.descFaltas = Math.round((r.faltas + r.sinGoce) * valorDia * 100) / 100;
      r.descuento = Math.round((r.descTardanza + r.descFaltas) * 100) / 100;
      r.puntualidad = r.asistencias ? Math.round((r.asistencias - r.tardanzas) / r.asistencias * 100) : null;
      r.horas = Math.round(r.horas * 10) / 10; r.extra = Math.round(r.extra * 10) / 10;
      return r;
    });
    return { fechas: reg.fechas, filas: filas, detalle: reg.filas };
  }

  /** Situación de hoy */
  function hoyResumen() {
    const f = hoy();
    const reg = registroMensual(f.slice(0, 7));
    const idx = reg.fechas.indexOf(f);
    const filas = reg.filas.map(function (x) { return { trabajador: x.trabajador, estado: x.dias[idx] }; })
      .filter(function (x) { return x.estado.codigo !== ""; });
    const cuenta = function (fn) { return filas.filter(fn).length; };
    const programados = filas.filter(function (x) { return x.estado.laborable; });
    return {
      fecha: f, filas: filas,
      programados: programados.length,
      presentes: cuenta(function (x) { return x.estado.codigo === "A" || x.estado.codigo === "T"; }),
      tardanzas: cuenta(function (x) { return x.estado.codigo === "T"; }),
      faltas: cuenta(function (x) { return x.estado.codigo === "F"; }),
      porLlegar: cuenta(function (x) { return x.estado.codigo === "·"; }),
      permisos: cuenta(function (x) { return Boolean(x.estado.permiso); }),
      descanso: cuenta(function (x) { return x.estado.codigo === "D"; })
    };
  }

  /** Tardanzas y faltas por día, últimos n días laborables */
  function tendencia(n) {
    const out = { etiquetas: [], tardanzas: [], faltas: [] };
    const fin = hoy();
    const desde = sumarDias(fin, -(n + 10));
    const meses = {};
    for (let f = desde; f <= fin; f = sumarDias(f, 1)) meses[f.slice(0, 7)] = true;
    const porFecha = {};
    Object.keys(meses).forEach(function (am) {
      const reg = registroMensual(am);
      reg.fechas.forEach(function (f, i) {
        if (f < desde || f > fin) return;
        const r = porFecha[f] = { t: 0, fa: 0, lab: 0 };
        reg.filas.forEach(function (x) { const d = x.dias[i]; if (d.laborable) r.lab++; if (d.codigo === "T") r.t++; if (d.codigo === "F") r.fa++; });
      });
    });
    Object.keys(porFecha).sort().filter(function (f) { return porFecha[f].lab > 2 && f < fin; }).slice(-n).forEach(function (f) {
      out.etiquetas.push(f.slice(8) + "/" + f.slice(5, 7)); out.tardanzas.push(porFecha[f].t); out.faltas.push(porFecha[f].fa);
    });
    return out;
  }

  const api = {
    iniciar: iniciar,
    reiniciar: function () { return B.reiniciar(); },
    exportarArchivo: function () { return B.exportar(); },
    esPersistente: function () { return B.esPersistente(); },
    uno: function (s, p) { return B.uno(s, p); },
    consultar: function (s, p) { return B.consultar(s, p); },
    ejecutar: function (s, p) { return B.ejecutar(s, p); },
    ultimoId: function () { return B.ultimoId(); },
    horarios: horarios, areas: areas, listarTrabajadores: listarTrabajadores, obtenerTrabajador: obtenerTrabajador, buscarPorDni: buscarPorDni,
    guardarTrabajador: guardarTrabajador, darDeBaja: darDeBaja,
    marcar: marcar, corregir: corregir, eliminarMarcacion: eliminarMarcacion, marcacionDe: marcacionDe, insertarMarcacionesEnLote: insertarMarcacionesEnLote,
    permisosDe: permisosDe, listarPermisos: listarPermisos, registrarPermiso: registrarPermiso, eliminarPermiso: eliminarPermiso,
    calificar: calificar, registroMensual: registroMensual, reporteMensual: reporteMensual, hoyResumen: hoyResumen, tendencia: tendencia, diasDelMes: diasDelMes,
    aMin: aMin, aHora: aHora, horaActual: horaActual, ahoraMin: ahoraMin, hoy: hoy, sumarDias: sumarDias, iso: iso, diaSemana: diaSemana
  };
  return api;
})();
