/* ==========================================================================
   db.js — Base de datos y reglas de negocio: gestión de personal (RR. HH.)
   ---------------------------------------------------------------------------
   Reglas implementadas (referenciales, régimen laboral privado del Perú):
   · Remuneración Mínima Vital (RMV) por fecha: S/ 1 130 desde el 01/01/2025 y
     S/ 1 230 desde el 01/10/2026 (D.S. 015-2026-TR). Las fechas y montos están en
     la tabla RMV de abajo; se actualiza agregando un tramo.
   · Periodo de prueba: 3 meses desde el ingreso.
   · Contratos a plazo fijo: se alerta cuando vencen en 30 días o menos, cuando
     el trabajador sigue laborando con el contrato vencido y cuando la suma de
     contratos a plazo fijo se acerca al máximo de 5 años.
   · Vacaciones: 30 días por cada año completo de servicios. Cada periodo debe
     gozarse dentro del año siguiente; si no, hay riesgo de indemnización
     vacacional. Los días gozados se descuentan del periodo más antiguo.
   ========================================================================== */
window.DB = (function () {
  "use strict";

  let B = null;
  const RMV = [{ desde: "2025-01-01", monto: 1130 }, { desde: "2026-10-01", monto: 1230 }];
  const DOCUMENTOS = ["Copia de DNI", "Currículum vitae", "Antecedentes policiales", "Declaración jurada de domicilio", "Contrato firmado", "Elección de sistema de pensiones", "Alta en T-Registro"];
  const TIPOS_CONTRATO = ["Plazo indeterminado", "Plazo fijo", "Modalidad formativa"];

  const ESQUEMA = `
    CREATE TABLE trabajadores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      dni         TEXT NOT NULL UNIQUE,
      nombres     TEXT NOT NULL,
      apellidos   TEXT NOT NULL,
      nacimiento  TEXT NOT NULL,
      telefono    TEXT NOT NULL DEFAULT '',
      correo      TEXT NOT NULL DEFAULT '',
      area        TEXT NOT NULL,
      cargo       TEXT NOT NULL,
      pension     TEXT NOT NULL DEFAULT 'AFP',            -- AFP | ONP
      ingreso     TEXT NOT NULL,
      cese_fecha  TEXT,
      cese_motivo TEXT
    );
    CREATE TABLE contratos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
      tipo          TEXT NOT NULL CHECK (tipo IN ('Plazo indeterminado','Plazo fijo','Modalidad formativa')),
      inicio        TEXT NOT NULL,
      fin           TEXT,                                   -- NULL = indeterminado
      sueldo        REAL NOT NULL CHECK (sueldo > 0),
      CHECK (fin IS NULL OR fin >= inicio)
    );
    CREATE INDEX idx_contratos_trab ON contratos(trabajador_id, inicio);
    CREATE TABLE vacaciones (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_id INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
      desde         TEXT NOT NULL,
      hasta         TEXT NOT NULL,
      dias          INTEGER NOT NULL CHECK (dias > 0),
      observacion   TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE documentos (
      trabajador_id INTEGER NOT NULL REFERENCES trabajadores(id) ON DELETE CASCADE,
      documento     TEXT NOT NULL,
      entregado     INTEGER NOT NULL DEFAULT 0,
      fecha         TEXT,
      PRIMARY KEY (trabajador_id, documento)
    );
  `;

  const hoy = SQLiteDemo.hoy, sumarDias = SQLiteDemo.sumarDias, diasEntre = SQLiteDemo.diasEntre, iso = SQLiteDemo.iso;
  const fmt = function (f) { return f ? f.split("-").reverse().join("/") : ""; };
  const fmtS = function (n) { return "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  /* ---------- Fechas ---------- */
  function sumarMeses(f, meses) {
    const d = new Date(f + "T00:00:00"), dia = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + meses);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return iso(d);
  }
  function sumarAnios(f, n) { return sumarMeses(f, n * 12); }
  /** Años, meses y días completos entre dos fechas */
  function antiguedad(desde, hasta) {
    let a = 0, m = 0;
    while (sumarAnios(desde, a + 1) <= hasta) a++;
    const baseA = sumarAnios(desde, a);
    while (sumarMeses(baseA, m + 1) <= hasta) m++;
    return { anios: a, meses: m, dias: diasEntre(sumarMeses(baseA, m), hasta) };
  }
  function textoAntiguedad(x) {
    const p = [];
    if (x.anios) p.push(x.anios + (x.anios === 1 ? " año" : " años"));
    if (x.meses) p.push(x.meses + (x.meses === 1 ? " mes" : " meses"));
    if (!p.length) p.push(x.dias + (x.dias === 1 ? " día" : " días"));
    return p.join(" y ");
  }
  function rmvEn(f) { let m = RMV[0].monto; RMV.forEach(function (r) { if (f >= r.desde) m = r.monto; }); return m; }

  async function iniciar() {
    B = await SQLiteDemo.crear({ idb: "demo-gestion-personal", esquema: ESQUEMA, sembrar: function (base) { B = base; window.DATOS_EJEMPLO.cargar(api); } });
    return { nuevo: B.nuevo };
  }

  /* ---------- Contratos ---------- */
  function contratosDe(id) { return B.consultar("SELECT * FROM contratos WHERE trabajador_id = ? ORDER BY inicio", [id]); }

  /** Analiza los contratos de un trabajador a una fecha */
  function situacionContrato(t, contratos, h) {
    h = h || hoy();
    const vigentes = contratos.filter(function (c) { return c.inicio <= h; });
    const actual = vigentes[vigentes.length - 1] || contratos[0] || null;
    const proximo = contratos.find(function (c) { return c.inicio > h; }) || null;
    const r = { actual: actual, proximo: proximo, estado: "sin", texto: "Sin contrato", dias: null, acumuladoFijo: 0 };
    contratos.forEach(function (c) {
      if (c.tipo === "Plazo fijo") r.acumuladoFijo += diasEntre(c.inicio, c.fin && c.fin < h ? c.fin : (c.fin || h)) + 1;
    });
    if (!actual) return r;
    if (!actual.fin) { r.estado = "indeterminado"; r.texto = actual.tipo === "Plazo indeterminado" ? "Indeterminado" : "Sin fecha de fin"; return r; }
    r.dias = diasEntre(h, actual.fin);
    if (r.dias < 0 && !proximo) { r.estado = "vencido"; r.texto = "Vencido hace " + (-r.dias) + " d"; }
    else if (r.dias <= 30 && !proximo) { r.estado = "por_vencer"; r.texto = r.dias === 0 ? "Vence hoy" : "Vence en " + r.dias + " d"; }
    else { r.estado = "vigente"; r.texto = proximo ? "Renovado" : "Vigente"; }
    return r;
  }

  function registrarContrato(c, opciones) {
    opciones = opciones || {};
    const t = B.uno("SELECT * FROM trabajadores WHERE id = ?", [c.trabajador_id]);
    if (!t) throw new Error("Trabajador no encontrado.");
    if (TIPOS_CONTRATO.indexOf(c.tipo) === -1) throw new Error("Selecciona el tipo de contrato.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.inicio || "")) throw new Error("Indica la fecha de inicio.");
    const fin = c.tipo === "Plazo indeterminado" ? null : (c.fin || null);
    if (c.tipo !== "Plazo indeterminado" && !fin) throw new Error("Los contratos a plazo fijo y de modalidad formativa necesitan fecha de fin.");
    if (fin && fin < c.inicio) throw new Error("La fecha de fin no puede ser anterior al inicio.");
    if (c.inicio < t.ingreso) throw new Error("El contrato no puede empezar antes del ingreso (" + fmt(t.ingreso) + ").");
    const sueldo = Math.round(Number(c.sueldo) * 100) / 100;
    if (!(sueldo > 0)) throw new Error("Indica el sueldo o la subvención mensual.");
    if (!opciones.sinValidarRmv && sueldo < rmvEn(c.inicio)) {
      throw new Error("El monto (" + fmtS(sueldo) + ") es menor que la RMV vigente al " + fmt(c.inicio) + " (" + fmtS(rmvEn(c.inicio)) + "). " +
        (c.tipo === "Modalidad formativa" ? "La subvención mínima de modalidades formativas también equivale a la RMV." : ""));
    }
    const cruce = B.uno("SELECT inicio, fin FROM contratos WHERE trabajador_id = ? AND inicio <= ? AND (fin IS NULL OR fin >= ?)", [t.id, fin || "9999-12-31", c.inicio]);
    if (cruce) throw new Error("Las fechas se cruzan con el contrato del " + fmt(cruce.inicio) + (cruce.fin ? " al " + fmt(cruce.fin) : " (indeterminado)") + ".");
    if (c.tipo === "Plazo fijo" && !opciones.sinValidar) {
      const previos = contratosDe(t.id).filter(function (x) { return x.tipo === "Plazo fijo"; });
      const total = previos.reduce(function (s, x) { return s + diasEntre(x.inicio, x.fin) + 1; }, 0) + diasEntre(c.inicio, fin) + 1;
      if (total > 5 * 365 + 1) throw new Error("Con este contrato, los contratos a plazo fijo sumarían " + (total / 365).toFixed(1).replace(".", ",") + " años y superarían el máximo de 5 años. Corresponde un contrato a plazo indeterminado.");
    }
    B.ejecutar("INSERT INTO contratos (trabajador_id, tipo, inicio, fin, sueldo) VALUES (?,?,?,?,?)", [t.id, c.tipo, c.inicio, fin, sueldo]);
    if (!opciones.sinGuardar) B.guardar();
  }

  /* ---------- Vacaciones ---------- */
  /** Periodos vacacionales con días ganados, gozados y pendientes (FIFO) */
  function vacacionesDe(t, h) {
    h = h || hoy();
    const hasta = t.cese_fecha && t.cese_fecha < h ? t.cese_fecha : h;
    const tomadas = B.consultar("SELECT * FROM vacaciones WHERE trabajador_id = ? ORDER BY desde", [t.id]);
    let gozado = tomadas.reduce(function (s, v) { return s + v.dias; }, 0);
    const periodos = [];
    for (let k = 1; sumarAnios(t.ingreso, k) <= hasta; k++) {
      const p = { numero: k, desde: sumarAnios(t.ingreso, k - 1), ganado: sumarAnios(t.ingreso, k), limite: sumarAnios(t.ingreso, k + 1), dias: 30, gozados: 0 };
      p.gozados = Math.min(30, gozado); gozado -= p.gozados;
      p.pendientes = 30 - p.gozados;
      p.vencido = p.pendientes > 0 && p.limite <= h;
      p.porVencer = p.pendientes > 0 && !p.vencido && diasEntre(h, p.limite) <= 60;
      periodos.push(p);
    }
    const ultimo = periodos.length ? periodos[periodos.length - 1].ganado : t.ingreso;
    const ant = antiguedad(ultimo, hasta);
    const truncos = Math.floor((ant.meses + ant.anios * 12) * 2.5 * 10) / 10; // 2,5 días por mes completo del periodo en curso
    const saldo = periodos.reduce(function (s, p) { return s + p.pendientes; }, 0);
    return {
      periodos: periodos, tomadas: tomadas, saldo: saldo, adelantados: Math.max(0, gozado), truncos: truncos,
      vencidos: periodos.filter(function (p) { return p.vencido; }),
      porVencer: periodos.filter(function (p) { return p.porVencer; }),
      proximoPeriodo: sumarAnios(ultimo, 1)
    };
  }

  function registrarVacaciones(v, opciones) {
    opciones = opciones || {};
    const t = B.uno("SELECT * FROM trabajadores WHERE id = ?", [v.trabajador_id]);
    if (!t) throw new Error("Trabajador no encontrado.");
    if (t.cese_fecha) throw new Error("El trabajador está cesado.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.desde || "") || !/^\d{4}-\d{2}-\d{2}$/.test(v.hasta || "")) throw new Error("Indica las fechas de inicio y fin.");
    if (v.hasta < v.desde) throw new Error("La fecha final no puede ser anterior a la inicial.");
    const dias = diasEntre(v.desde, v.hasta) + 1;
    if (!opciones.sinValidar) {
      const saldo = vacacionesDe(t).saldo;
      if (dias > saldo) throw new Error("Solicita " + dias + " días y su saldo ganado es de " + saldo + ". Un adelanto de vacaciones requiere acuerdo por escrito; regístralo cuando esté firmado.");
      if (dias < 7 && dias !== saldo) {
        // Regla general: descanso de al menos 7 días calendario por bloque (los bloques menores se acuerdan por escrito)
        if (!v.confirmarBloqueCorto) throw new Error("BLOQUE_CORTO");
      }
    }
    const cruce = B.uno("SELECT desde, hasta FROM vacaciones WHERE trabajador_id = ? AND desde <= ? AND hasta >= ?", [t.id, v.hasta, v.desde]);
    if (cruce) throw new Error("Se cruza con vacaciones ya registradas del " + fmt(cruce.desde) + " al " + fmt(cruce.hasta) + ".");
    B.ejecutar("INSERT INTO vacaciones (trabajador_id, desde, hasta, dias, observacion) VALUES (?,?,?,?,?)", [t.id, v.desde, v.hasta, dias, String(v.observacion || "").trim()]);
    if (!opciones.sinGuardar) B.guardar();
    return dias;
  }
  function eliminarVacaciones(id) { B.ejecutar("DELETE FROM vacaciones WHERE id = ?", [id]); B.guardar(); }

  /* ---------- Trabajadores ---------- */
  function guardarTrabajador(t, opciones) {
    opciones = opciones || {};
    const dni = String(t.dni || "").trim(), nombres = String(t.nombres || "").trim(), apellidos = String(t.apellidos || "").trim();
    if (!/^\d{8}$/.test(dni)) throw new Error("El DNI debe tener 8 dígitos.");
    if (nombres.length < 2 || apellidos.length < 3) throw new Error("Escribe nombres y apellidos.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.nacimiento || "")) throw new Error("Indica la fecha de nacimiento.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.ingreso || "")) throw new Error("Indica la fecha de ingreso.");
    const edad = antiguedad(t.nacimiento, t.ingreso).anios;
    const formativa = t.contrato && t.contrato.tipo === "Modalidad formativa";
    if (edad < (formativa ? 16 : 18)) throw new Error("A la fecha de ingreso tendría " + edad + " años; el mínimo es " + (formativa ? 16 : 18) + ".");
    if (!String(t.area || "").trim() || !String(t.cargo || "").trim()) throw new Error("Indica el área y el cargo.");
    const tel = String(t.telefono || "").replace(/\D/g, "");
    if (tel && !/^9\d{8}$/.test(tel)) throw new Error("El celular debe tener 9 dígitos y empezar con 9.");
    const correo = String(t.correo || "").trim();
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) throw new Error("El correo no es válido.");
    if (B.uno("SELECT id FROM trabajadores WHERE dni = ? AND id <> ?", [dni, t.id || 0])) throw new Error("Ya existe un trabajador con el DNI " + dni + ".");
    const v = [dni, nombres, apellidos, t.nacimiento, tel, correo, String(t.area).trim(), String(t.cargo).trim(), t.pension === "ONP" ? "ONP" : "AFP", t.ingreso];
    if (t.id) {
      B.ejecutar("UPDATE trabajadores SET dni=?, nombres=?, apellidos=?, nacimiento=?, telefono=?, correo=?, area=?, cargo=?, pension=?, ingreso=? WHERE id=?", v.concat([t.id]));
      if (!opciones.sinGuardar) B.guardar();
      return t.id;
    }
    // Alta: trabajador + primer contrato + checklist del legajo, todo o nada
    const id = (function () {
      B.ejecutar("SAVEPOINT alta");
      try {
        B.ejecutar("INSERT INTO trabajadores (dni, nombres, apellidos, nacimiento, telefono, correo, area, cargo, pension, ingreso) VALUES (?,?,?,?,?,?,?,?,?,?)", v);
        const nuevo = B.ultimoId();
        if (t.contrato) registrarContrato(Object.assign({ trabajador_id: nuevo, inicio: t.ingreso }, t.contrato), { sinGuardar: true, sinValidarRmv: opciones.sinValidarRmv });
        const st = B.preparar("INSERT INTO documentos (trabajador_id, documento, entregado, fecha) VALUES (?,?,?,?)");
        try { DOCUMENTOS.forEach(function (d) { const e = (t.documentos || []).indexOf(d) !== -1; st.run([nuevo, d, e ? 1 : 0, e ? t.ingreso : null]); }); } finally { st.free(); }
        B.ejecutar("RELEASE alta");
        return nuevo;
      } catch (e) { B.ejecutar("ROLLBACK TO alta"); B.ejecutar("RELEASE alta"); throw e; }
    })();
    if (!opciones.sinGuardar) B.guardar();
    return id;
  }

  function registrarCese(id, fecha, motivo) {
    const t = B.uno("SELECT * FROM trabajadores WHERE id = ?", [id]);
    if (!t) throw new Error("Trabajador no encontrado.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) throw new Error("Indica la fecha de cese.");
    if (fecha < t.ingreso) throw new Error("La fecha de cese no puede ser anterior al ingreso.");
    if (!motivo) throw new Error("Indica el motivo del cese.");
    B.ejecutar("UPDATE trabajadores SET cese_fecha = ?, cese_motivo = ? WHERE id = ?", [fecha, motivo, id]);
    // Si tenía un contrato que terminaba después, se recorta a la fecha de cese
    B.ejecutar("UPDATE contratos SET fin = ? WHERE trabajador_id = ? AND inicio <= ? AND (fin IS NULL OR fin > ?)", [fecha, id, fecha, fecha]);
    B.ejecutar("DELETE FROM contratos WHERE trabajador_id = ? AND inicio > ?", [id, fecha]);
    B.guardar();
  }

  function marcarDocumento(id, documento, entregado) {
    if (DOCUMENTOS.indexOf(documento) === -1) throw new Error("Documento no válido.");
    B.ejecutar("INSERT INTO documentos (trabajador_id, documento, entregado, fecha) VALUES (?,?,?,?) ON CONFLICT(trabajador_id, documento) DO UPDATE SET entregado = excluded.entregado, fecha = excluded.fecha",
      [id, documento, entregado ? 1 : 0, entregado ? hoy() : null]);
    B.guardar();
  }

  /** Ficha completa con todo calculado */
  function ficha(id, h) {
    h = h || hoy();
    const t = B.uno("SELECT * FROM trabajadores WHERE id = ?", [id]);
    if (!t) return null;
    t.nombre = t.nombres + " " + t.apellidos;
    t.activo = !t.cese_fecha || t.cese_fecha > h;   // el día del cese ya figura como cesado
    t.edad = antiguedad(t.nacimiento, h).anios;
    t.antiguedad = antiguedad(t.ingreso, t.cese_fecha && t.cese_fecha < h ? t.cese_fecha : h);
    t.contratos = contratosDe(id);
    t.contrato = situacionContrato(t, t.contratos, h);
    t.sueldo = t.contrato.actual ? t.contrato.actual.sueldo : 0;
    t.vacaciones = vacacionesDe(t, h);
    t.documentos = B.consultar("SELECT * FROM documentos WHERE trabajador_id = ? ORDER BY rowid", [id]);
    t.faltantes = t.documentos.filter(function (d) { return !d.entregado; }).map(function (d) { return d.documento; });
    t.finPrueba = sumarMeses(t.ingreso, 3);
    t.enPrueba = t.activo && h < t.finPrueba && (!t.contrato.actual || t.contrato.actual.tipo !== "Modalidad formativa");
    return t;
  }

  function listar(filtro) {
    filtro = filtro || {};
    const h = hoy();
    let ids = B.consultar("SELECT id FROM trabajadores ORDER BY apellidos, nombres").map(function (r) { return r.id; });
    let lista = ids.map(function (id) { return ficha(id, h); });
    if (filtro.estado === "cesados") lista = lista.filter(function (t) { return !t.activo; });
    else if (filtro.estado !== "todos") lista = lista.filter(function (t) { return t.activo; });
    if (filtro.area) lista = lista.filter(function (t) { return t.area === filtro.area; });
    if (filtro.tipo) lista = lista.filter(function (t) { return t.contrato.actual && t.contrato.actual.tipo === filtro.tipo; });
    if (filtro.texto) {
      const q = filtro.texto.toLowerCase();
      lista = lista.filter(function (t) { return (t.nombre + " " + t.dni + " " + t.cargo + " " + t.area).toLowerCase().indexOf(q) !== -1; });
    }
    return lista;
  }
  function areas() { return B.consultar("SELECT DISTINCT area FROM trabajadores ORDER BY area").map(function (r) { return r.area; }); }

  /* ---------- Alertas y panel ---------- */
  function alertas(lista) {
    const h = hoy(), rmv = rmvEn(h), out = [];
    const add = function (nivel, tipo, t, detalle, fecha, accion) { out.push({ nivel: nivel, tipo: tipo, trabajador: t, detalle: detalle, fecha: fecha, accion: accion }); };
    lista.forEach(function (t) {
      if (!t.activo) return;
      const c = t.contrato;
      if (c.estado === "vencido") add(3, "Contrato vencido", t, "Sigue laborando sin contrato vigente desde el " + fmt(sumarDias(c.actual.fin, 1)) + ": riesgo de que se considere a plazo indeterminado.", c.actual.fin, "renovar");
      if (c.estado === "por_vencer") add(2, "Contrato por vencer", t, (c.actual.tipo === "Modalidad formativa" ? "Convenio" : "Contrato") + " vence el " + fmt(c.actual.fin) + " (" + c.texto.toLowerCase() + ").", c.actual.fin, "renovar");
      if (c.actual && c.actual.tipo === "Plazo fijo" && c.acumuladoFijo > 5 * 365 + 1) add(3, "Superó 5 años a plazo fijo", t, "Suma " + (c.acumuladoFijo / 365).toFixed(1).replace(".", ",") + " años en contratos a plazo fijo: supera el máximo legal y corresponde un contrato a plazo indeterminado.", null, "renovar");
      else if (c.actual && c.actual.tipo === "Plazo fijo" && c.acumuladoFijo > 4.5 * 365) add(2, "Límite de plazo fijo", t, "Suma " + (c.acumuladoFijo / 365).toFixed(1).replace(".", ",") + " años en contratos a plazo fijo (máximo 5).", null, "ficha");
      if (c.actual && c.actual.tipo !== "Modalidad formativa" && c.actual.sueldo < rmv) add(3, "Sueldo bajo la RMV", t, "Percibe " + fmtS(c.actual.sueldo) + "; la RMV vigente es " + fmtS(rmv) + " desde el 01/10/2026.", "2026-10-01", "renovar");
      if (c.actual && c.actual.tipo === "Modalidad formativa" && c.actual.sueldo < rmv) add(3, "Subvención bajo la RMV", t, "Subvención de " + fmtS(c.actual.sueldo) + "; el mínimo es " + fmtS(rmv) + ".", "2026-10-01", "renovar");
      t.vacaciones.vencidos.forEach(function (p) { add(3, "Vacaciones vencidas", t, p.pendientes + " días del periodo " + fmt(p.desde) + "–" + fmt(p.ganado) + " no se gozaron antes del " + fmt(p.limite) + ": riesgo de indemnización vacacional.", p.limite, "vacaciones"); });
      t.vacaciones.porVencer.forEach(function (p) { add(2, "Vacaciones por vencer", t, p.pendientes + " días deben gozarse antes del " + fmt(p.limite) + ".", p.limite, "vacaciones"); });
      if (t.enPrueba && diasEntre(h, t.finPrueba) <= 15) add(1, "Fin del periodo de prueba", t, "Termina el " + fmt(t.finPrueba) + ". Evalúa su desempeño antes de esa fecha.", t.finPrueba, "ficha");
      if (t.faltantes.length) add(1, "Legajo incompleto", t, "Falta: " + t.faltantes.join(", ") + ".", null, "ficha");
    });
    return out.sort(function (a, b) { return b.nivel - a.nivel || String(a.fecha || "9").localeCompare(String(b.fecha || "9")); });
  }

  function panel() {
    const h = hoy(), todos = listar({ estado: "todos" }), activos = todos.filter(function (t) { return t.activo; });
    const hace12 = sumarMeses(h, -12);
    const ceses = todos.filter(function (t) { return t.cese_fecha && t.cese_fecha >= hace12 && t.cese_fecha < h; });
    const promedio = (activos.length + todos.filter(function (t) { return t.ingreso <= hace12 && (!t.cese_fecha || t.cese_fecha >= hace12); }).length) / 2;
    const porArea = {}, porTipo = {};
    activos.forEach(function (t) {
      porArea[t.area] = (porArea[t.area] || 0) + 1;
      const tipo = t.contrato.actual ? t.contrato.actual.tipo : "Sin contrato";
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;
    });
    const mes = h.slice(5, 7);
    return {
      activos: activos, planilla: activos.reduce(function (s, t) { return s + t.sueldo; }, 0),
      alertas: alertas(activos), ceses: ceses, rotacion: promedio ? Math.round(ceses.length / promedio * 1000) / 10 : 0,
      porArea: porArea, porTipo: porTipo,
      cumpleanos: activos.filter(function (t) { return t.nacimiento.slice(5, 7) === mes; }).sort(function (a, b) { return a.nacimiento.slice(8).localeCompare(b.nacimiento.slice(8)); }),
      rmv: rmvEn(h)
    };
  }

  const api = {
    iniciar: iniciar, reiniciar: function () { return B.reiniciar(); }, exportarArchivo: function () { return B.exportar(); }, esPersistente: function () { return B.esPersistente(); },
    uno: function (s, p) { return B.uno(s, p); }, consultar: function (s, p) { return B.consultar(s, p); }, ejecutar: function (s, p) { return B.ejecutar(s, p); },
    DOCUMENTOS: DOCUMENTOS, TIPOS_CONTRATO: TIPOS_CONTRATO, RMV: RMV,
    guardarTrabajador: guardarTrabajador, registrarContrato: registrarContrato, registrarVacaciones: registrarVacaciones, eliminarVacaciones: eliminarVacaciones,
    registrarCese: registrarCese, marcarDocumento: marcarDocumento, ficha: ficha, listar: listar, areas: areas, alertas: alertas, panel: panel,
    vacacionesDe: vacacionesDe, situacionContrato: situacionContrato, rmvEn: rmvEn,
    hoy: hoy, sumarDias: sumarDias, sumarMeses: sumarMeses, sumarAnios: sumarAnios, diasEntre: diasEntre, antiguedad: antiguedad, textoAntiguedad: textoAntiguedad
  };
  return api;
})();
