/* ==========================================================================
   app.js — Pantallas del sistema de control de asistencia
   Vistas: hoy · marcar · mensual · reporte · personal
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, num, fecha, esc, tabla, avisar, confirmar, descargar, exportarExcel, ICONOS } = window.UI;

  const ICO = { dia: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M8 2v3" /> <path d="M16 2v3" /> <rect x="3" y="3" width="18" height="18" rx="2" /> <path d="M3 9h18" /> <path d="M8 13h.01" /> <path d="M12 13h.01" /> <path d="M16 13h.01" /> <path d="M8 17h.01" /> <path d="M12 17h.01" /> <path d="M16 17h.01" /> </svg>', permiso: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M16 18h6" /> <path d="M16 2v3" /> <path d="M19 15v6" /> <path d="M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3" /> <path d="M3 9h18" /> <path d="M8 2v3" /> </svg>', baja: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <line x1="17" x2="22" y1="8" y2="13" /> <line x1="22" x2="17" y1="8" y2="13" /> </svg>', entrada: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m10 17 5-5-5-5" /> <path d="M15 12H3" /> <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /> </svg>', salida: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m16 17 5-5-5-5" /> <path d="M21 12H9" /> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /> </svg>' };
  const TITULOS = { hoy: "Hoy", marcar: "Marcar asistencia", mensual: "Registro mensual", reporte: "Reporte para planillas", personal: "Personal y permisos" };
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const estado = { vista: "hoy", reloj: null, limpiar: null };

  /* =================== Arranque y navegación =================== */
  async function iniciar() {
    try {
      const r = await DB.iniciar();
      $("#cargando").remove();
      $("#app").hidden = false;
      $("#estado-guardado").textContent = r.nuevo ? "" : "Se cargaron tus cambios anteriores.";
      llenarMeses();
      enlazarEventos();
      irA(leerHash());
      window.addEventListener("hashchange", function () { irA(leerHash()); });
      setTimeout(function () {
        if (!DB.esPersistente()) $("#estado-guardado").textContent = "Este navegador no permite guardar datos: tus cambios se perderán al cerrar la página.";
      }, 1500);
    } catch (e) {
      console.error(e);
      $("#cargando").innerHTML = "<p><b>No se pudo iniciar la base de datos.</b><br>Prueba con otro navegador actualizado (Chrome, Edge, Firefox o Safari).</p>";
    }
  }
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "hoy"; }
  function irA(vista) {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); }); // al cambiar de vista se cierra cualquier ventana abierta
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) { a.classList.toggle("activo", a.dataset.vista === vista); a.toggleAttribute("aria-current", a.dataset.vista === vista); });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de control de asistencia";
    clearInterval(estado.reloj);
    ({ hoy: pintarHoy, marcar: pintarMarcar, mensual: pintarMensual, reporte: pintarReporte, personal: pintarPersonal })[vista]();
    window.scrollTo(0, 0);
  }
  function refrescar() { irA(estado.vista); }

  function fechaLarga(f) {
    const d = new Date(f + "T00:00:00");
    return DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()] + " de " + d.getFullYear();
  }
  function llenarMeses() {
    const h = DB.hoy(), d = new Date(h + "T00:00:00"), ops = [];
    for (let i = 0; i < 3; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const v = x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
      ops.push('<option value="' + v + '">' + MESES[x.getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + " " + x.getFullYear() + (i === 0 ? " (en curso)" : "") + "</option>");
    }
    $("#r-mes").innerHTML = ops.join(""); $("#p-mes").innerHTML = ops.join("");
    const areas = DB.areas().map(function (a) { return "<option>" + esc(a) + "</option>"; }).join("");
    $("#r-area").innerHTML = '<option value="">Todas las áreas</option>' + areas;
    $("#p-area").innerHTML = '<option value="">Todas las áreas</option>' + areas;
  }

  /* =================== Piezas =================== */
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" +
      (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function chip(e) { return '<span class="chip-asis chip-asis--' + e.clase + '">' + esc(e.texto) + "</span>"; }
  function trabajadorCelda(t) { return "<b>" + esc(t.nombre) + "</b><small class='sub'>" + esc(t.cargo || t.area) + "</small>"; }

  /* =================== Hoy =================== */
  function pintarHoy() {
    const r = DB.hoyResumen();
    $("#fecha-hoy").textContent = fechaLarga(r.fecha).replace(/^./, function (c) { return c.toUpperCase(); }) + " · " + DB.horaActual();
    $("#kpis").innerHTML =
      kpi("Programados hoy", num(r.programados), r.descanso ? r.descanso + " en día de descanso" : "") +
      kpi("Presentes", num(r.presentes), r.programados ? Math.round(r.presentes / r.programados * 100) + " % de los programados" : "") +
      kpi("Tardanzas", num(r.tardanzas), "", r.tardanzas ? "alerta" : "") +
      kpi("Faltas", num(r.faltas), r.porLlegar ? r.porLlegar + " aún por llegar" : "", r.faltas ? "peligro" : "") +
      kpi("Con permiso", num(r.permisos), "vacaciones, descanso médico u otros");

    const t = DB.tendencia(20);
    GRAFICOS.barras("graf-tendencia", { etiquetas: t.etiquetas, series: [{ nombre: "Tardanzas", datos: t.tardanzas, color: "ambar" }, { nombre: "Faltas", datos: t.faltas, color: "rojo" }] });
    const rep = DB.reporteMensual(DB.hoy().slice(0, 7));
    const porArea = {};
    rep.filas.forEach(function (f) {
      const a = porArea[f.trabajador.area] = porArea[f.trabajador.area] || { asis: 0, tard: 0 };
      a.asis += f.asistencias; a.tard += f.tardanzas;
    });
    const areas = Object.keys(porArea).map(function (k) { return [k, porArea[k].asis ? Math.round((porArea[k].asis - porArea[k].tard) / porArea[k].asis * 100) : 0]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    GRAFICOS.barras("graf-areas", { etiquetas: areas.map(function (a) { return a[0]; }), horizontal: true, series: [{ nombre: "Puntualidad %", datos: areas.map(function (a) { return a[1]; }), color: "celeste" }] });

    const filtro = $("#h-filtro").value;
    const filas = r.filas.filter(function (x) {
      const c = x.estado.codigo;
      if (!filtro) return true;
      if (filtro === "presentes") return c === "A" || c === "T";
      if (filtro === "permiso") return Boolean(x.estado.permiso);
      return c === filtro;
    }).sort(function (a, b) { return orden(a.estado) - orden(b.estado) || a.trabajador.nombre.localeCompare(b.trabajador.nombre); });
    $("#tabla-hoy").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: function (x) { return trabajadorCelda(x.trabajador); } },
      { titulo: "Área", html: function (x) { return esc(x.trabajador.area); } },
      { titulo: "Horario", html: function (x) { return esc(x.trabajador.h_entrada + "–" + x.trabajador.h_salida); } },
      { titulo: "Entrada", clase: "num", html: function (x) { return x.estado.entrada || '<span class="sub">—</span>'; } },
      { titulo: "Salida", clase: "num", html: function (x) { return x.estado.salida || '<span class="sub">—</span>'; } },
      { titulo: "Estado", html: function (x) { return chip(x.estado); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (x) { return '<button type="button" class="btn-icono" data-dia="' + x.trabajador.id + "|" + r.fecha + '" title="Ver o corregir" aria-label="Ver o corregir el día de ' + esc(x.trabajador.nombre) + '">' + ICO.dia + "</button>"; } }
    ], filas, { vacio: "No hay trabajadores con ese estado hoy." });
  }
  function orden(e) { return { F: 0, T: 1, "·": 2, A: 3 }[e.codigo] !== undefined ? { F: 0, T: 1, "·": 2, A: 3 }[e.codigo] : 4; }

  /* =================== Marcar (quiosco) =================== */
  function pintarMarcar() {
    const tic = function () {
      const d = new Date();
      $("#reloj-hora").textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
      $("#reloj-fecha").textContent = fechaLarga(DB.hoy());
    };
    tic(); estado.reloj = setInterval(tic, 1000);
    actualizarQuiosco();
    pintarMarcasHoy();
  }
  function pintarMarcasHoy() {
    const r = DB.hoyResumen();
    const filas = r.filas.filter(function (x) { return x.estado.entrada; }).sort(function (a, b) { return (b.estado.salida || b.estado.entrada).localeCompare(a.estado.salida || a.estado.entrada); });
    $("#tabla-marcas-hoy").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: function (x) { return trabajadorCelda(x.trabajador); } },
      { titulo: "Entrada", clase: "num", html: function (x) { return x.estado.entrada; } },
      { titulo: "Salida", clase: "num", html: function (x) { return x.estado.salida || '<span class="sub">—</span>'; } },
      { titulo: "Estado", html: function (x) { return chip(x.estado); } }
    ], filas, { vacio: "Todavía nadie ha marcado hoy." });
  }
  function actualizarQuiosco() {
    const dni = $("#m-dni").value.replace(/\D/g, "");
    const caja = $("#m-trabajador"), boton = $("#m-boton");
    boton.disabled = true; boton.querySelector("span").textContent = "Marcar"; caja.innerHTML = "";
    if (dni.length < 8) return;
    const t = DB.buscarPorDni(dni);
    if (!t) { caja.innerHTML = '<p class="texto-peligro">No hay un trabajador activo con el DNI ' + esc(dni) + ".</p>"; return; }
    const m = DB.marcacionDe(t.id, DB.hoy());
    const e = DB.calificar(t, DB.hoy(), m, DB.permisosDe(t.id));
    caja.innerHTML = "<b>" + esc(t.nombre) + "</b><span>" + esc(t.area + " · " + t.h_nombre + " " + t.h_entrada + "–" + t.h_salida) + "</span>" +
      (m ? "<span>Entrada " + m.entrada + (m.salida ? " · salida " + m.salida : "") + "</span>" : "") + (e.permiso ? "<span>Hoy tiene " + esc(e.permiso.tipo.toLowerCase()) + "</span>" : "");
    if (m && m.salida) { boton.querySelector("span").textContent = "Jornada completa"; return; }
    boton.disabled = false;
    boton.querySelector("span").textContent = m ? "Marcar salida" : "Marcar entrada";
  }
  function marcar(e) {
    e.preventDefault();
    const t = DB.buscarPorDni($("#m-dni").value.replace(/\D/g, ""));
    if (!t) return;
    try {
      const r = DB.marcar(t.id);
      const ok = r.tipo === "entrada"
        ? (!r.estado.laborable ? "Día de descanso: las horas se registran como horas extra" : r.estado.tardanza ? "Tardanza de " + r.estado.tardanza + " minutos" : "Puntual") : "Horas trabajadas: " + r.estado.horas.toFixed(1).replace(".", ",") + (r.estado.extra ? " · horas extra: " + r.estado.extra.toFixed(1).replace(".", ",") : "");
      $("#m-resultado").innerHTML = '<div class="marca-ok marca-ok--' + (r.estado.tardanza && r.tipo === "entrada" ? "tarde" : "bien") + '">' + (r.tipo === "entrada" ? ICO.entrada : ICO.salida) +
        "<div><b>" + (r.tipo === "entrada" ? "Entrada" : "Salida") + " registrada · " + r.hora + "</b><span>" + esc(t.nombre) + " — " + esc(ok) + "</span></div></div>";
      $("#m-dni").value = "";
      actualizarQuiosco(); pintarMarcasHoy();
      clearTimeout(estado.limpiar);
      estado.limpiar = setTimeout(function () { $("#m-resultado").innerHTML = ""; }, 8000);
      $("#m-dni").focus();
    } catch (err) {
      $("#m-resultado").innerHTML = '<div class="aviso aviso--error">' + esc(err.message) + "</div>";
    }
  }
  function dniEjemplo() {
    const candidatos = DB.hoyResumen().filas.filter(function (x) { return x.estado.laborable && !x.estado.permiso && !x.estado.salida; });
    const lista = candidatos.length ? candidatos : DB.hoyResumen().filas;
    if (!lista.length) { avisar("Hoy no hay trabajadores programados.", "error"); return; }
    $("#m-dni").value = lista[Math.floor(Math.random() * lista.length)].trabajador.dni;
    actualizarQuiosco(); $("#m-dni").focus();
  }

  /* =================== Registro mensual =================== */
  function pintarMensual() {
    const reg = DB.registroMensual($("#r-mes").value, { area: $("#r-area").value });
    const hoy = DB.hoy();
    let h = '<div class="tabla-envoltura cuadricula-envoltura"><table class="cuadricula"><thead><tr><th scope="col" class="cuadricula__nombre">Trabajador</th>';
    reg.fechas.forEach(function (f) {
      const ds = DB.diaSemana(f);
      h += '<th scope="col" class="' + (ds === 0 ? "dom " : "") + (f === hoy ? "hoy" : "") + '"><span>' + Number(f.slice(8)) + "</span><small>" + "DLMMJVS"[ds] + "</small></th>";
    });
    h += '<th scope="col" class="tot">T</th><th scope="col" class="tot">F</th></tr></thead><tbody>';
    reg.filas.forEach(function (fila) {
      const t = fila.trabajador;
      let nT = 0, nF = 0;
      h += '<tr><th scope="row" class="cuadricula__nombre">' + esc(t.nombre) + "<small>" + esc(t.area) + "</small></th>";
      fila.dias.forEach(function (d) {
        if (d.codigo === "T") nT++; if (d.codigo === "F") nF++;
        if (!d.codigo) { h += '<td class="vacia"></td>'; return; }
        const titulo = fecha(d.fecha) + " · " + d.texto + (d.entrada ? " · " + d.entrada + "–" + (d.salida || "?") : "");
        h += '<td><button type="button" class="cod cod--' + d.clase + (d.sinSalida ? " cod--incompleto" : "") + '" data-dia="' + t.id + "|" + d.fecha + '" title="' + esc(titulo) + '" aria-label="' + esc(t.nombre + ", " + titulo) + '">' + esc(d.codigo) + "</button></td>";
      });
      h += '<td class="tot' + (nT ? " tot--t" : "") + '">' + nT + '</td><td class="tot' + (nF ? " tot--f" : "") + '">' + nF + "</td></tr>";
    });
    h += "</tbody></table></div>";
    $("#cuadricula").innerHTML = reg.filas.length ? h : '<p class="vacio">No hay trabajadores en esta área.</p>';
    const celdaHoy = $("#cuadricula th.hoy");
    if (celdaHoy) { const env = $(".cuadricula-envoltura"); env.scrollLeft = Math.max(0, celdaHoy.offsetLeft - env.clientWidth + 140); }
  }

  /* ---- Detalle y corrección de un día ---- */
  function abrirDia(clave) {
    const [id, f] = clave.split("|");
    const t = DB.obtenerTrabajador(Number(id));
    const m = DB.marcacionDe(t.id, f);
    const e = DB.calificar(t, f, m, DB.permisosDe(t.id));
    const form = $("#form-dia");
    form.reset(); $("#dd-error").textContent = "";
    form.trabajador_id.value = t.id; form.fecha.value = f;
    $("#dd-titulo").textContent = fechaLarga(f).replace(/^./, function (c) { return c.toUpperCase(); });
    $("#dd-resumen").innerHTML = '<div class="dia-resumen"><div>' + trabajadorCelda(t) + "</div>" + chip(e) + "</div>" +
      '<dl class="ficha">' +
      "<dt>Horario</dt><dd>" + esc(t.h_nombre + " · " + t.h_entrada + "–" + t.h_salida + " · tolerancia " + t.h_tolerancia + " min") + "</dd>" +
      "<dt>Marcación</dt><dd>" + (m ? "Entrada " + m.entrada + " · salida " + (m.salida || "no registrada") : "Sin marcación") + "</dd>" +
      (m ? "<dt>Horas</dt><dd>" + (m.salida ? e.horas.toFixed(1).replace(".", ",") + " trabajadas" + (e.extra ? " · " + e.extra.toFixed(1).replace(".", ",") + " extra" : "") : "—") + "</dd>" : "") +
      (m && m.origen === "Corrección" ? "<dt>Corrección</dt><dd>" + esc(m.observacion) + "</dd>" : "") +
      (e.permiso ? "<dt>Permiso</dt><dd>" + esc(e.permiso.tipo + " del " + fecha(e.permiso.desde) + " al " + fecha(e.permiso.hasta)) + "</dd>" : "") +
      "</dl>";
    form.entrada.value = m ? m.entrada : t.h_entrada;
    form.salida.value = m && m.salida ? m.salida : (f < DB.hoy() ? t.h_salida : "");
    $("#dd-eliminar").hidden = !m;
    $("#dialogo-dia").showModal();
  }
  function guardarDia(e) {
    e.preventDefault();
    const f = e.target;
    try {
      DB.corregir({ trabajador_id: Number(f.trabajador_id.value), fecha: f.fecha.value, entrada: f.entrada.value, salida: f.salida.value, observacion: f.observacion.value });
      $("#dialogo-dia").close(); avisar("Marcación corregida."); refrescar();
    } catch (err) { $("#dd-error").textContent = err.message; }
  }

  /* =================== Reporte =================== */
  function pintarReporte() {
    const rep = DB.reporteMensual($("#p-mes").value, { area: $("#p-area").value });
    const sum = function (k) { return rep.filas.reduce(function (s, f) { return s + f[k]; }, 0); };
    $("#p-kpis").innerHTML =
      kpi("Tardanzas", num(sum("tardanzas")), num(sum("minTardanza")) + " minutos en total", sum("tardanzas") ? "alerta" : "") +
      kpi("Faltas injustificadas", num(sum("faltas")), num(sum("sinSalida")) + " días sin marcar salida", sum("faltas") ? "peligro" : "") +
      kpi("Horas extra", num(Math.round(sum("extra") * 10) / 10), "a validar por cada jefe") +
      kpi("Descuentos referenciales", soles(sum("descuento")), "tardanzas, faltas y licencias sin goce");
    $("#tabla-reporte").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: function (f) { return "<b>" + esc(f.trabajador.nombre) + "</b><small class='sub'>" + esc(f.trabajador.area + " · DNI " + f.trabajador.dni) + "</small>"; } },
      { titulo: "Días lab.", clase: "num", html: function (f) { return num(f.laborables); } },
      { titulo: "Asistencias", clase: "num", html: function (f) { return num(f.asistencias); } },
      { titulo: "Tardanzas", clase: "num", html: function (f) { return f.tardanzas ? "<b>" + f.tardanzas + "</b><small class='sub'>" + f.minTardanza + " min</small>" : '<span class="sub">0</span>'; } },
      { titulo: "Faltas", clase: "num", html: function (f) { return f.faltas ? '<b class="texto-peligro">' + f.faltas + "</b>" : '<span class="sub">0</span>'; } },
      { titulo: "Permisos", clase: "num", html: function (f) { return f.permisos ? f.permisos + (f.sinGoce ? "<small class='sub'>" + f.sinGoce + " sin goce</small>" : "") : '<span class="sub">0</span>'; } },
      { titulo: "Horas", clase: "num", html: function (f) { return num(f.horas); } },
      { titulo: "H. extra", clase: "num", html: function (f) { return f.extra ? num(f.extra) : '<span class="sub">0</span>'; } },
      { titulo: "Puntualidad", clase: "num", html: function (f) { return f.puntualidad === null ? '<span class="sub">—</span>' : f.puntualidad + " %"; } },
      { titulo: "Descuento", clase: "num", html: function (f) { return f.descuento ? "<b>" + soles(f.descuento) + "</b>" : '<span class="sub">—</span>'; } }
    ], rep.filas, { vacio: "No hay trabajadores en esta área.", clase: "tabla--ancha" });
  }
  function exportarReporte() {
    const mes = $("#p-mes").value, rep = DB.reporteMensual(mes, { area: $("#p-area").value });
    const nombreMes = $("#p-mes").selectedOptions[0].textContent.replace(" (en curso)", "");
    const resumen = [["REPORTE DE ASISTENCIA PARA PLANILLAS — " + nombreMes.toUpperCase()], ["Empresa:", "Servicios Integrales del Sur SAC (datos ficticios)"], ["Emitido:", fecha(DB.hoy()) + " " + DB.horaActual()], [],
      ["DNI", "Trabajador", "Área", "Cargo", "Sueldo", "Días laborables", "Asistencias", "Tardanzas", "Minutos de tardanza", "Faltas", "Permisos", "Licencias sin goce", "Días sin salida", "Horas trabajadas", "Horas extra", "Puntualidad %", "Desc. tardanzas", "Desc. faltas/licencias", "Descuento total"]];
    rep.filas.forEach(function (f) {
      const t = f.trabajador;
      resumen.push([t.dni, t.nombre, t.area, t.cargo, t.sueldo, f.laborables, f.asistencias, f.tardanzas, f.minTardanza, f.faltas, f.permisos, f.sinGoce, f.sinSalida, f.horas, f.extra, f.puntualidad === null ? "" : f.puntualidad, f.descTardanza, f.descFaltas, f.descuento]);
    });
    resumen.push([], ["Descuentos referenciales: minuto = sueldo ÷ 30 ÷ 8 ÷ 60; falta o licencia sin goce = sueldo ÷ 30. Ajustar al reglamento interno de cada empresa."]);
    const detalle = [["DNI", "Trabajador", "Fecha", "Día", "Estado", "Entrada", "Salida", "Minutos de tardanza", "Horas trabajadas", "Horas extra", "Observación"]];
    rep.detalle.forEach(function (x) {
      x.dias.forEach(function (d) {
        if (!d.codigo || d.codigo === "D") return;
        detalle.push([x.trabajador.dni, x.trabajador.nombre, fecha(d.fecha), DIAS[DB.diaSemana(d.fecha)], d.texto, d.entrada || "", d.salida || "", d.tardanza || "", d.horas ? Math.round(d.horas * 100) / 100 : "", d.extra ? Math.round(d.extra * 100) / 100 : "", d.sinSalida ? "Sin marcación de salida" : ""]);
      });
    });
    exportarExcel([
      { nombre: "Resumen", filas: resumen, anchos: [10, 30, 18, 22, 9, 9, 10, 9, 10, 7, 9, 10, 9, 10, 9, 10, 11, 12, 11] },
      { nombre: "Detalle diario", filas: detalle, anchos: [10, 30, 11, 10, 28, 8, 8, 10, 10, 9, 26] }
    ], "asistencia_" + mes + ".xlsx");
  }

  /* =================== Personal y permisos =================== */
  function pintarPersonal() {
    const lista = DB.listarTrabajadores({ texto: $("#t-buscar").value.trim() });
    $("#tabla-personal").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: function (t) { return "<b>" + esc(t.nombre) + "</b><small class='sub'>DNI " + esc(t.dni) + " · " + esc(t.cargo) + "</small>"; } },
      { titulo: "Área", html: function (t) { return esc(t.area); } },
      { titulo: "Horario", html: function (t) { return esc(t.h_nombre) + "<small class='sub'>" + esc(t.h_entrada + "–" + t.h_salida) + "</small>"; } },
      { titulo: "Sueldo", clase: "num", html: function (t) { return soles(t.sueldo); } },
      { titulo: "Ingreso", html: function (t) { return fecha(t.ingreso); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (t) {
        return '<button type="button" class="btn-icono" data-permiso-de="' + t.id + '" title="Registrar permiso" aria-label="Registrar permiso para ' + esc(t.nombre) + '">' + ICO.permiso + "</button>" +
          '<button type="button" class="btn-icono" data-editar="' + t.id + '" title="Editar" aria-label="Editar ' + esc(t.nombre) + '">' + ICONOS.editar + "</button>" +
          '<button type="button" class="btn-icono btn-icono--peligro" data-baja="' + t.id + '" title="Dar de baja" aria-label="Dar de baja a ' + esc(t.nombre) + '">' + ICO.baja + "</button>";
      } }
    ], lista, { vacio: "No se encontraron trabajadores." });
    $("#tabla-permisos").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: function (p) { return "<b>" + esc(p.nombre) + "</b><small class='sub'>DNI " + esc(p.dni) + "</small>"; } },
      { titulo: "Tipo", html: function (p) { return esc(p.tipo); } },
      { titulo: "Periodo", html: function (p) { const n = Math.round((new Date(p.hasta) - new Date(p.desde)) / 86400000) + 1; return fecha(p.desde) + " – " + fecha(p.hasta) + "<small class='sub'>" + n + " día(s)</small>"; } },
      { titulo: "Observación", html: function (p) { return esc(p.observacion || "—"); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (p) { return '<button type="button" class="btn-icono btn-icono--peligro" data-eliminar-permiso="' + p.id + '" title="Eliminar" aria-label="Eliminar permiso">' + ICONOS.eliminar + "</button>"; } }
    ], DB.listarPermisos(), { vacio: "No hay permisos registrados." });
  }
  function abrirTrabajador(id) {
    const f = $("#form-trabajador");
    f.reset(); $("#t-error").textContent = "";
    f.horario_id.innerHTML = DB.horarios().map(function (h) { return '<option value="' + h.id + '">' + esc(h.nombre + " (" + h.entrada + "–" + h.salida + ")") + "</option>"; }).join("");
    $("#lista-areas").innerHTML = DB.areas().map(function (a) { return '<option value="' + esc(a) + '">'; }).join("");
    if (id) {
      const t = DB.obtenerTrabajador(id);
      $("#dt-titulo").textContent = "Editar trabajador";
      f.id.value = t.id; f.dni.value = t.dni; f.nombre.value = t.nombre; f.area.value = t.area; f.cargo.value = t.cargo;
      f.horario_id.value = String(t.horario_id); f.sueldo.value = t.sueldo; f.ingreso.value = t.ingreso;
    } else {
      $("#dt-titulo").textContent = "Nuevo trabajador"; f.id.value = ""; f.ingreso.value = DB.hoy();
    }
    $("#dialogo-trabajador").showModal();
    f.dni.focus();
  }
  function guardarTrabajador(e) {
    e.preventDefault();
    const f = e.target;
    try {
      DB.guardarTrabajador({ id: f.id.value ? Number(f.id.value) : null, dni: f.dni.value, nombre: f.nombre.value, area: f.area.value, cargo: f.cargo.value,
        horario_id: Number(f.horario_id.value), sueldo: f.sueldo.value === "" ? 0 : f.sueldo.value, ingreso: f.ingreso.value });
      $("#dialogo-trabajador").close(); avisar(f.id.value ? "Trabajador actualizado." : "Trabajador registrado. Ya puede marcar con su DNI.");
      llenarMeses(); refrescar();
    } catch (err) { $("#t-error").textContent = err.message; }
  }
  function abrirPermiso(trabajadorId, fechaIni) {
    const f = $("#form-permiso");
    f.reset(); $("#pe-error").textContent = "";
    f.trabajador_id.innerHTML = '<option value="">Selecciona un trabajador</option>' + DB.listarTrabajadores().map(function (t) { return '<option value="' + t.id + '">' + esc(t.nombre + " · " + t.dni) + "</option>"; }).join("");
    if (trabajadorId) f.trabajador_id.value = String(trabajadorId);
    f.desde.value = fechaIni || DB.hoy(); f.hasta.value = fechaIni || DB.hoy();
    $("#dialogo-permiso").showModal();
  }
  function guardarPermiso(e) {
    e.preventDefault();
    const f = e.target;
    try {
      DB.registrarPermiso({ trabajador_id: Number(f.trabajador_id.value), tipo: f.tipo.value, desde: f.desde.value, hasta: f.hasta.value, observacion: f.observacion.value });
      $("#dialogo-permiso").close(); avisar(f.tipo.value + " registrado."); refrescar();
    } catch (err) { $("#pe-error").textContent = err.message; }
  }

  /* =================== Eventos =================== */
  function enlazarEventos() {
    document.addEventListener("click", async function (e) {
      const b = e.target.closest("[data-cerrar],[data-dia],[data-editar],[data-baja],[data-permiso-de],[data-eliminar-permiso],[data-dni-ejemplo]");
      if (!b) return;
      const d = b.dataset;
      if (d.cerrar !== undefined) { b.closest("dialog").close(); return; }
      if (d.dia) abrirDia(d.dia);
      if (d.editar) abrirTrabajador(Number(d.editar));
      if (d.permisoDe) abrirPermiso(Number(d.permisoDe));
      if (d.dniEjemplo !== undefined) dniEjemplo();
      if (d.baja) {
        const t = DB.obtenerTrabajador(Number(d.baja));
        if (await confirmar("¿Dar de baja a " + t.nombre + "?", "Ya no podrá marcar asistencia ni aparecerá en los reportes. Su historial se conserva en la base de datos.", "Dar de baja")) {
          DB.darDeBaja(t.id); avisar("Trabajador dado de baja."); refrescar();
        }
      }
      if (d.eliminarPermiso && await confirmar("¿Eliminar este permiso?", "Los días que cubría volverán a calificarse según las marcaciones.", "Eliminar")) {
        DB.eliminarPermiso(Number(d.eliminarPermiso)); avisar("Permiso eliminado."); refrescar();
      }
    });

    $("#h-filtro").addEventListener("change", pintarHoy);
    $("#m-dni").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8); actualizarQuiosco(); });
    $("#form-marcar").addEventListener("submit", marcar);
    $("#r-mes").addEventListener("change", pintarMensual); $("#r-area").addEventListener("change", pintarMensual);
    $("#p-mes").addEventListener("change", pintarReporte); $("#p-area").addEventListener("change", pintarReporte);
    $("#btn-exportar-reporte").addEventListener("click", exportarReporte);

    $("#form-dia").addEventListener("submit", guardarDia);
    $("#dd-eliminar").addEventListener("click", async function () {
      const f = $("#form-dia");
      if (!(await confirmar("¿Borrar la marcación?", "El día se volverá a calificar (por ejemplo, como falta).", "Borrar"))) return;
      DB.eliminarMarcacion(Number(f.trabajador_id.value), f.fecha.value);
      $("#dialogo-dia").close(); avisar("Marcación borrada."); refrescar();
    });
    $("#dd-permiso").addEventListener("click", function () {
      const f = $("#form-dia");
      $("#dialogo-dia").close();
      abrirPermiso(Number(f.trabajador_id.value), f.fecha.value);
    });

    let espera;
    $("#t-buscar").addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(pintarPersonal, 180); });
    $("#btn-nuevo-trabajador").addEventListener("click", function () { abrirTrabajador(null); });
    $("#btn-nuevo-permiso").addEventListener("click", function () { abrirPermiso(null); });
    $("#form-trabajador").addEventListener("submit", guardarTrabajador);
    $("#form-permiso").addEventListener("submit", guardarPermiso);

    $("#btn-descargar-db").addEventListener("click", function () { descargar(DB.exportarArchivo(), "asistencia_demo_" + DB.hoy() + ".sqlite", "application/vnd.sqlite3"); });
    $("#btn-reiniciar").addEventListener("click", async function () {
      if (!(await confirmar("¿Restablecer la demo?", "Se borrarán tus cambios y se cargarán de nuevo los datos de ejemplo.", "Restablecer"))) return;
      await DB.reiniciar();
      $("#estado-guardado").textContent = "";
      avisar("Demo restablecida con los datos de ejemplo.");
      llenarMeses(); refrescar();
    });
  }

  iniciar();
})();
