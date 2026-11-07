/* ==========================================================================
   app.js — Pantallas del sistema de gestión de personal
   Vistas: panel · personal · contratos · vacaciones  (+ legajo en ventana)
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, num, fecha, esc, tabla, avisar, confirmar, descargar, exportarExcel, ICONOS } = window.UI;

  const ICO = { contrato: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z" /> <path d="M14.487 7.858A1 1 0 0 1 14 7V2" /> <path d="M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516" /> <path d="M8 18h1" /> </svg>', vacaciones: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4" /> <path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3" /> <path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35" /> <path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14" /> </svg>', ver: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" /> </svg>', cese: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <line x1="17" x2="22" y1="8" y2="13" /> <line x1="22" x2="17" y1="8" y2="13" /> </svg>', ok: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <rect width="18" height="18" x="3" y="3" rx="2" /> <path d="m16 9-5.5 5.5L8 12" /> </svg>', no: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <rect width="18" height="18" x="3" y="3" rx="2" /> </svg>' };
  const TITULOS = { panel: "Panel y alertas", personal: "Personal", contratos: "Contratos", vacaciones: "Vacaciones" };
  const NIVEL = { 3: ["critica", "Crítica"], 2: ["importante", "Importante"], 1: ["seguimiento", "Seguimiento"] };
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  const estado = { vista: "panel", fichaAbierta: null };

  /* =================== Arranque y navegación =================== */
  async function iniciar() {
    try {
      const r = await DB.iniciar();
      $("#cargando").remove(); $("#app").hidden = false;
      $("#estado-guardado").textContent = r.nuevo ? "" : "Se cargaron tus cambios anteriores.";
      llenarAreas(); enlazarEventos();
      irA(leerHash());
      window.addEventListener("hashchange", function () { irA(leerHash()); });
      setTimeout(function () { if (!DB.esPersistente()) $("#estado-guardado").textContent = "Este navegador no permite guardar datos: tus cambios se perderán al cerrar la página."; }, 1500);
    } catch (e) {
      console.error(e);
      $("#cargando").innerHTML = "<p><b>No se pudo iniciar la base de datos.</b><br>Prueba con otro navegador actualizado (Chrome, Edge, Firefox o Safari).</p>";
    }
  }
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "panel"; }
  function irA(vista) {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); });
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) { a.classList.toggle("activo", a.dataset.vista === vista); a.toggleAttribute("aria-current", a.dataset.vista === vista); });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de gestión de personal";
    ({ panel: pintarPanel, personal: pintarPersonal, contratos: pintarContratos, vacaciones: pintarVacaciones })[vista]();
    window.scrollTo(0, 0);
  }
  /** Repinta la vista actual y, si hay un legajo abierto, también el legajo */
  function refrescar() {
    ({ panel: pintarPanel, personal: pintarPersonal, contratos: pintarContratos, vacaciones: pintarVacaciones })[estado.vista]();
    if (estado.fichaAbierta && $("#dialogo-ficha").open) pintarFicha(estado.fichaAbierta);
  }
  function llenarAreas() {
    const ops = DB.areas().map(function (a) { return "<option>" + esc(a) + "</option>"; }).join("");
    $("#p-area").innerHTML = '<option value="">Todas las áreas</option>' + ops;
    $("#lista-areas").innerHTML = DB.areas().map(function (a) { return '<option value="' + esc(a) + '">'; }).join("");
  }

  /* =================== Piezas =================== */
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" +
      (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function iniciales(t) { return (t.nombres[0] + t.apellidos[0]).toUpperCase(); }
  function chipContrato(t) {
    const c = t.contrato;
    if (!t.activo) return '<span class="chip-rh chip-rh--cesado">Cesado</span>';
    return '<span class="chip-rh chip-rh--' + c.estado + '">' + esc(c.texto) + "</span>";
  }
  function nombreCelda(t) { return '<button type="button" class="enlace-tabla" data-ficha="' + t.id + '">' + esc(t.nombre) + "</button><small class='sub'>" + esc(t.cargo + " · " + t.area) + "</small>"; }
  function aniosTexto(dias) { return (dias / 365).toFixed(1).replace(".", ",") + " años"; }

  /* =================== Panel =================== */
  function pintarPanel() {
    const p = DB.panel();
    const criticas = p.alertas.filter(function (a) { return a.nivel === 3; }).length;
    const contratos = p.activos.filter(function (t) { return t.contrato.estado === "por_vencer" || t.contrato.estado === "vencido"; }).length;
    $("#kpis").innerHTML =
      kpi("Trabajadores activos", num(p.activos.length), p.activos.filter(function (t) { return t.enPrueba; }).length + " en periodo de prueba") +
      kpi("Planilla mensual", soles(p.planilla), "sueldos brutos, sin aportes") +
      kpi("Alertas críticas", num(criticas), p.alertas.length + " alertas en total", criticas ? "peligro" : "") +
      kpi("Contratos por renovar", num(contratos), "vencidos o vencen en 30 días", contratos ? "alerta" : "") +
      kpi("Rotación 12 meses", p.rotacion.toString().replace(".", ",") + " %", p.ceses.length + " cese(s) en el último año");

    const nivel = Number($("#a-filtro").value) || 0;
    const lista = p.alertas.filter(function (a) { return !nivel || a.nivel === nivel; });
    $("#tabla-alertas").innerHTML = tabla([
      { titulo: "Prioridad", html: function (a) { return '<span class="chip-nivel chip-nivel--' + NIVEL[a.nivel][0] + '">' + NIVEL[a.nivel][1] + "</span>"; } },
      { titulo: "Alerta", clase: "celda-titular", html: function (a) { return "<b>" + esc(a.tipo) + "</b><small class='sub'>" + esc(a.detalle) + "</small>"; } },
      { titulo: "Trabajador", html: function (a) { return nombreCelda(a.trabajador); } },
      { titulo: "", etiqueta: "Acción", clase: "acciones", html: function (a) {
        if (a.accion === "renovar") return '<button type="button" class="btn-icono" data-contrato="' + a.trabajador.id + '" title="Registrar contrato">' + ICO.contrato + "<span>Contrato</span></button>";
        if (a.accion === "vacaciones") return '<button type="button" class="btn-icono" data-vacaciones="' + a.trabajador.id + '" title="Programar vacaciones">' + ICO.vacaciones + "<span>Programar</span></button>";
        return '<button type="button" class="btn-icono" data-ficha="' + a.trabajador.id + '" title="Ver legajo">' + ICO.ver + "<span>Legajo</span></button>";
      } }
    ], lista, { vacio: "No hay alertas con ese nivel. ¡Todo en orden!", clase: "tabla--alertas" });

    const areas = Object.keys(p.porArea).map(function (k) { return [k, p.porArea[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    GRAFICOS.barras("graf-areas", { etiquetas: areas.map(function (a) { return a[0]; }), horizontal: true, series: [{ nombre: "Trabajadores", datos: areas.map(function (a) { return a[1]; }), color: "celeste" }] });

    const h = DB.hoy();
    $("#tabla-cumple").innerHTML = tabla([
      { titulo: "Día", html: function (t) { const d = t.nacimiento.slice(8) + " de " + MESES[Number(h.slice(5, 7)) - 1]; return (t.nacimiento.slice(5) === h.slice(5) ? "🎂 <b>Hoy</b>" : esc(d)); } },
      { titulo: "Trabajador", html: nombreCelda },
      { titulo: "Cumple", clase: "num", html: function (t) { return (Number(h.slice(0, 4)) - Number(t.nacimiento.slice(0, 4))) + " años"; } }
    ], p.cumpleanos, { vacio: "Nadie cumple años este mes." });
  }

  /* =================== Personal (fichas) =================== */
  function filtroPersonal() { return { texto: $("#p-buscar").value.trim(), area: $("#p-area").value, tipo: $("#p-tipo").value, estado: $("#p-estado").value }; }
  function pintarPersonal() {
    const lista = DB.listar(filtroPersonal());
    const alertasPor = {};
    DB.alertas(lista).forEach(function (a) { alertasPor[a.trabajador.id] = Math.max(alertasPor[a.trabajador.id] || 0, a.nivel); });
    $("#lista-personal").innerHTML = lista.length ? lista.map(function (t) {
      const n = alertasPor[t.id];
      return '<button type="button" class="ficha-tarjeta" data-ficha="' + t.id + '" aria-label="Abrir legajo de ' + esc(t.nombre) + '">' +
        '<span class="avatar avatar--' + (t.id % 5) + '">' + iniciales(t) + "</span>" +
        '<span class="ficha-tarjeta__datos"><b>' + esc(t.nombre) + "</b><span>" + esc(t.cargo) + "</span><small>" + esc(t.area) + " · " + esc(DB.textoAntiguedad(t.antiguedad)) + "</small></span>" +
        '<span class="ficha-tarjeta__estado">' + chipContrato(t) + (n ? '<span class="punto-alerta punto-alerta--' + NIVEL[n][0] + '" title="Tiene alertas">' + (n === 3 ? "!" : "•") + "</span>" : "") + "</span>" +
        "</button>";
    }).join("") : '<p class="vacio">No se encontraron trabajadores.</p>';
  }

  /* =================== Legajo =================== */
  function abrirFicha(id) { estado.fichaAbierta = id; pintarFicha(id); if (!$("#dialogo-ficha").open) $("#dialogo-ficha").showModal(); }
  function pintarFicha(id) {
    const t = DB.ficha(id), c = t.contrato, v = t.vacaciones;
    $("#df-titulo").textContent = "Legajo de " + t.nombres.split(" ")[0];
    const alertas = DB.alertas([t]);
    $("#df-cuerpo").innerHTML =
      '<div class="legajo-cabecera"><span class="avatar avatar--grande avatar--' + (t.id % 5) + '">' + iniciales(t) + "</span>" +
        "<div><b>" + esc(t.nombre) + "</b><span>" + esc(t.cargo + " · " + t.area) + "</span><span class='legajo-chips'>" + chipContrato(t) +
        (t.enPrueba ? '<span class="chip-rh chip-rh--prueba">En periodo de prueba hasta ' + fecha(t.finPrueba) + "</span>" : "") + "</span></div></div>" +
      (alertas.length ? '<ul class="legajo-alertas">' + alertas.map(function (a) { return '<li class="chip-nivel--' + NIVEL[a.nivel][0] + '"><b>' + esc(a.tipo) + ":</b> " + esc(a.detalle) + "</li>"; }).join("") + "</ul>" : "") +
      '<div class="legajo-rejilla">' +
        '<section><h3>Datos personales</h3><dl class="ficha">' +
          "<dt>DNI</dt><dd>" + esc(t.dni) + "</dd><dt>Nacimiento</dt><dd>" + fecha(t.nacimiento) + " (" + t.edad + " años)</dd>" +
          "<dt>Celular</dt><dd>" + esc(t.telefono || "—") + "</dd><dt>Correo</dt><dd class='corta'>" + esc(t.correo || "—") + "</dd><dt>Pensiones</dt><dd>" + esc(t.pension) + "</dd></dl></section>" +
        '<section><h3>Datos laborales</h3><dl class="ficha">' +
          "<dt>Ingreso</dt><dd>" + fecha(t.ingreso) + "</dd><dt>Antigüedad</dt><dd>" + esc(DB.textoAntiguedad(t.antiguedad)) + "</dd>" +
          "<dt>Sueldo</dt><dd>" + soles(t.sueldo) + "</dd>" +
          (t.cese_fecha ? "<dt>Cese</dt><dd>" + fecha(t.cese_fecha) + " · " + esc(t.cese_motivo) + "</dd>" : "") +
          (c.acumuladoFijo ? "<dt>Plazo fijo</dt><dd>" + aniosTexto(c.acumuladoFijo) + " acumulados (máx. 5)</dd>" : "") + "</dl></section>" +
      "</div>" +
      '<section class="legajo-seccion"><div class="legajo-seccion__cab"><h3>Contratos</h3>' + (t.activo ? '<button type="button" class="btn btn--secundario btn--chico" data-contrato="' + t.id + '">' + ICO.contrato + " Nuevo contrato</button>" : "") + "</div>" +
        tabla([
          { titulo: "Tipo", html: function (x) { return esc(x.tipo); } },
          { titulo: "Inicio", html: function (x) { return fecha(x.inicio); } },
          { titulo: "Fin", html: function (x) { return x.fin ? fecha(x.fin) : "Indeterminado"; } },
          { titulo: "Sueldo", clase: "num", html: function (x) { return soles(x.sueldo); } }
        ], t.contratos.slice().reverse(), { vacio: "Sin contratos registrados.", clase: "tabla--ancha" }) + "</section>" +
      '<section class="legajo-seccion"><div class="legajo-seccion__cab"><h3>Vacaciones</h3>' + (t.activo ? '<button type="button" class="btn btn--secundario btn--chico" data-vacaciones="' + t.id + '">' + ICO.vacaciones + " Registrar</button>" : "") + "</div>" +
        '<p class="legajo-resumen">Saldo: <b>' + v.saldo + " días</b> · truncos del periodo en curso: " + num(v.truncos) + " días · próximo periodo: " + fecha(v.proximoPeriodo) + "</p>" +
        tabla([
          { titulo: "Periodo", html: function (p) { return fecha(p.desde) + " – " + fecha(p.ganado); } },
          { titulo: "Gozar antes del", html: function (p) { return fecha(p.limite); } },
          { titulo: "Gozados", clase: "num", html: function (p) { return p.gozados; } },
          { titulo: "Pendientes", clase: "num", html: function (p) { return p.pendientes ? "<b" + (p.vencido ? ' class="texto-peligro"' : "") + ">" + p.pendientes + "</b>" + (p.vencido ? "<small class='sub texto-peligro'>vencido</small>" : p.porVencer ? "<small class='sub'>por vencer</small>" : "") : '<span class="sub">0</span>'; } }
        ], v.periodos.slice().reverse(), { vacio: "Aún no cumple su primer año de servicios.", clase: "tabla--ancha" }) + "</section>" +
      '<section class="legajo-seccion"><h3>Documentos del legajo <small>(' + (t.documentos.length - t.faltantes.length) + " de " + t.documentos.length + ")</small></h3>" +
        '<ul class="checklist">' + t.documentos.map(function (d) {
          return '<li><label><input type="checkbox" data-doc="' + esc(d.documento) + '" data-trabajador="' + t.id + '"' + (d.entregado ? " checked" : "") + (t.activo ? "" : " disabled") + "><span>" + esc(d.documento) + "</span>" +
            (d.entregado && d.fecha ? "<small>" + fecha(d.fecha) + "</small>" : '<small class="texto-peligro">pendiente</small>') + "</label></li>";
        }).join("") + "</ul></section>" +
      (t.activo ? '<div class="dialogo__pie"><button type="button" class="btn btn--secundario btn--chico btn--peligro" data-cese="' + t.id + '">' + ICO.cese + " Registrar cese</button>" +
        '<button type="button" class="btn btn--primario btn--chico" data-editar="' + t.id + '">Editar datos</button></div>' : "");
  }

  /* =================== Contratos =================== */
  function pintarContratos() {
    const lista = DB.listar();
    const cuenta = function (tipo) { return lista.filter(function (t) { return t.contrato.actual && t.contrato.actual.tipo === tipo; }).length; };
    const renovar = lista.filter(function (t) { return t.contrato.estado === "por_vencer" || t.contrato.estado === "vencido"; });
    $("#c-kpis").innerHTML = kpi("Plazo indeterminado", num(cuenta("Plazo indeterminado"))) + kpi("Plazo fijo", num(cuenta("Plazo fijo"))) +
      kpi("Modalidad formativa", num(cuenta("Modalidad formativa")), "prácticas") +
      kpi("Por renovar", num(renovar.length), renovar.filter(function (t) { return t.contrato.estado === "vencido"; }).length + " ya vencido(s)", renovar.length ? "alerta" : "");
    const orden = { vencido: 0, por_vencer: 1, vigente: 2, indeterminado: 3, sin: 4 };
    lista.sort(function (a, b) { return orden[a.contrato.estado] - orden[b.contrato.estado] || String(a.contrato.actual && a.contrato.actual.fin || "9").localeCompare(String(b.contrato.actual && b.contrato.actual.fin || "9")); });
    $("#tabla-contratos").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: nombreCelda },
      { titulo: "Tipo", html: function (t) { return esc(t.contrato.actual ? t.contrato.actual.tipo : "—"); } },
      { titulo: "Vigencia", html: function (t) { const a = t.contrato.actual; return a ? fecha(a.inicio) + " – " + (a.fin ? fecha(a.fin) : "…") : "—"; } },
      { titulo: "Estado", html: chipContrato },
      { titulo: "Plazo fijo acumulado", clase: "num", html: function (t) { const d = t.contrato.acumuladoFijo; return d ? '<span class="' + (d > 4.5 * 365 ? "texto-peligro" : "") + '">' + aniosTexto(d) + "</span>" : '<span class="sub">—</span>'; } },
      { titulo: "Sueldo", clase: "num", html: function (t) { return soles(t.sueldo) + (t.sueldo < DB.rmvEn(DB.hoy()) ? "<small class='sub texto-peligro'>bajo la RMV</small>" : ""); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (t) { return '<button type="button" class="btn-icono" data-contrato="' + t.id + '" title="Nuevo contrato" aria-label="Registrar contrato de ' + esc(t.nombre) + '">' + ICO.contrato + "</button>"; } }
    ], lista, { vacio: "No hay trabajadores activos." });
  }
  function abrirContrato(id) {
    const t = DB.ficha(id), a = t.contrato.actual, f = $("#form-contrato");
    f.reset(); $("#co-error").textContent = "";
    f.trabajador_id.value = id;
    $("#dco-titulo").textContent = "Nuevo contrato";
    $("#dco-contexto").innerHTML = "<b>" + esc(t.nombre) + "</b> · " + esc(t.cargo) + "<br>" +
      (a ? "Contrato actual: " + esc(a.tipo) + " " + (a.fin ? "hasta el " + fecha(a.fin) : "indeterminado") + " · " + soles(a.sueldo) : "Sin contrato") +
      (t.contrato.acumuladoFijo ? "<br>Plazo fijo acumulado: " + aniosTexto(t.contrato.acumuladoFijo) + " de 5" : "");
    f.tipo.value = a && a.tipo !== "Plazo indeterminado" ? a.tipo : "Plazo fijo";
    if (t.contrato.acumuladoFijo > 4.5 * 365) f.tipo.value = "Plazo indeterminado";
    f.inicio.value = a && a.fin ? DB.sumarDias(a.fin, 1) : DB.hoy();
    f.sueldo.value = Math.max(a ? a.sueldo : 0, DB.rmvEn(f.inicio.value));
    ponerFin(6); actualizarTipo();
    $("#dialogo-contrato").showModal();
  }
  function ponerFin(meses) { const f = $("#form-contrato"); if (f.inicio.value) f.fin.value = DB.sumarDias(DB.sumarMeses(f.inicio.value, meses), -1); }
  function actualizarTipo() { $("#co-campo-fin").hidden = $("#co-tipo").value === "Plazo indeterminado"; }
  function guardarContrato(e) {
    e.preventDefault();
    const f = e.target;
    try {
      DB.registrarContrato({ trabajador_id: Number(f.trabajador_id.value), tipo: f.tipo.value, inicio: f.inicio.value, fin: f.fin.value, sueldo: f.sueldo.value });
      $("#dialogo-contrato").close(); avisar("Contrato registrado."); refrescar();
    } catch (err) { $("#co-error").textContent = err.message; }
  }

  /* =================== Vacaciones =================== */
  function pintarVacaciones() {
    const lista = DB.listar();
    const vencidas = lista.filter(function (t) { return t.vacaciones.vencidos.length; });
    const porVencer = lista.filter(function (t) { return t.vacaciones.porVencer.length; });
    const pendientes = lista.reduce(function (s, t) { return s + t.vacaciones.saldo; }, 0);
    $("#v-kpis").innerHTML = kpi("Días pendientes", num(pendientes), "suma de saldos ganados") +
      kpi("Con vacaciones vencidas", num(vencidas.length), "riesgo de indemnización", vencidas.length ? "peligro" : "") +
      kpi("Por vencer en 60 días", num(porVencer.length), "programar pronto", porVencer.length ? "alerta" : "") +
      kpi("Gozando hoy", num(DB.uno("SELECT COUNT(*) AS n FROM vacaciones WHERE ? BETWEEN desde AND hasta", [DB.hoy()]).n), "trabajadores de vacaciones");
    lista.sort(function (a, b) { return b.vacaciones.vencidos.length - a.vacaciones.vencidos.length || b.vacaciones.porVencer.length - a.vacaciones.porVencer.length || b.vacaciones.saldo - a.vacaciones.saldo; });
    $("#tabla-vacaciones").innerHTML = tabla([
      { titulo: "Trabajador", clase: "celda-titular", html: nombreCelda },
      { titulo: "Ingreso", html: function (t) { return fecha(t.ingreso); } },
      { titulo: "Periodos", clase: "num", html: function (t) { return t.vacaciones.periodos.length; } },
      { titulo: "Saldo", clase: "num", html: function (t) { return "<b>" + t.vacaciones.saldo + "</b> d"; } },
      { titulo: "Truncos", clase: "num", html: function (t) { return num(t.vacaciones.truncos) + " d"; } },
      { titulo: "Estado", html: function (t) {
        const v = t.vacaciones;
        if (v.vencidos.length) return '<span class="chip-rh chip-rh--vencido">Vencidas (' + v.vencidos.reduce(function (s, p) { return s + p.pendientes; }, 0) + " d)</span>";
        if (v.porVencer.length) return '<span class="chip-rh chip-rh--por_vencer">Gozar antes del ' + fecha(v.porVencer[0].limite) + "</span>";
        return v.periodos.length ? '<span class="chip-rh chip-rh--vigente">Al día</span>' : '<span class="chip-rh chip-rh--indeterminado">Primer año</span>';
      } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (t) { return '<button type="button" class="btn-icono" data-vacaciones="' + t.id + '" title="Registrar vacaciones" aria-label="Registrar vacaciones de ' + esc(t.nombre) + '">' + ICO.vacaciones + "</button>"; } }
    ], lista, { vacio: "No hay trabajadores activos." });
  }
  function abrirVacaciones(id) {
    const t = DB.ficha(id), f = $("#form-vacaciones");
    f.reset(); $("#va-error").textContent = ""; $("#va-dias").textContent = "";
    f.trabajador_id.value = id;
    const v = t.vacaciones;
    $("#dv-contexto").innerHTML = "<b>" + esc(t.nombre) + "</b><br>Saldo disponible: <b>" + v.saldo + " días</b>" +
      (v.vencidos.length ? ' · <span class="texto-peligro">tiene días vencidos</span>' : v.porVencer.length ? " · gozar antes del " + fecha(v.porVencer[0].limite) : "");
    f.desde.value = DB.sumarDias(DB.hoy(), 7);
    f.hasta.value = DB.sumarDias(f.desde.value, Math.min(15, Math.max(v.saldo, 1)) - 1);
    contarDias();
    $("#dialogo-vacaciones").showModal();
  }
  function contarDias() {
    const f = $("#form-vacaciones");
    $("#va-dias").textContent = f.desde.value && f.hasta.value && f.hasta.value >= f.desde.value ? (DB.diasEntre(f.desde.value, f.hasta.value) + 1) + " días calendario" : "";
  }
  async function guardarVacaciones(e, confirmado) {
    if (e) e.preventDefault();
    const f = $("#form-vacaciones");
    const datos = { trabajador_id: Number(f.trabajador_id.value), desde: f.desde.value, hasta: f.hasta.value, observacion: f.observacion.value, confirmarBloqueCorto: confirmado };
    try {
      const dias = DB.registrarVacaciones(datos);
      $("#dialogo-vacaciones").close(); avisar("Vacaciones registradas: " + dias + " días."); refrescar();
    } catch (err) {
      if (err.message === "BLOQUE_CORTO") {
        $("#dialogo-vacaciones").close();
        const ok = await confirmar("Bloque de menos de 7 días", "Los bloques de vacaciones menores a 7 días calendario deben acordarse por escrito con el trabajador. ¿Ya se firmó ese acuerdo?", "Sí, registrar");
        if (ok) { $("#dialogo-vacaciones").showModal(); guardarVacaciones(null, true); }
        else $("#dialogo-vacaciones").showModal();
        return;
      }
      $("#va-error").textContent = err.message;
    }
  }

  /* =================== Alta, edición y cese =================== */
  function abrirTrabajador(id) {
    const f = $("#form-trabajador");
    f.reset(); $("#t-error").textContent = "";
    llenarAreas();
    $("#t-rmv").textContent = "RMV vigente: " + soles(DB.rmvEn(DB.hoy()));
    if (id) {
      const t = DB.ficha(id);
      $("#dt-titulo").textContent = "Editar datos";
      ["id", "dni", "nombres", "apellidos", "nacimiento", "telefono", "correo", "area", "cargo", "pension", "ingreso"].forEach(function (k) { f[k].value = t[k] || ""; });
      $("#t-contrato").hidden = true;
    } else {
      $("#dt-titulo").textContent = "Nuevo trabajador";
      f.id.value = ""; f.ingreso.value = DB.hoy(); f.sueldo.value = DB.rmvEn(DB.hoy());
      $("#t-contrato").hidden = false;
      sugerirFin();
    }
    $("#dialogo-trabajador").showModal();
    f.dni.focus();
  }
  function sugerirFin() {
    const f = $("#form-trabajador");
    $("#t-campo-fin").hidden = f.tipo.value === "Plazo indeterminado";
    if (f.ingreso.value) f.fin.value = DB.sumarDias(DB.sumarMeses(f.ingreso.value, 6), -1);
  }
  function guardarTrabajador(e) {
    e.preventDefault();
    const f = e.target, nuevo = !f.id.value;
    const datos = {};
    ["dni", "nombres", "apellidos", "nacimiento", "telefono", "correo", "area", "cargo", "pension", "ingreso"].forEach(function (k) { datos[k] = f[k].value; });
    if (!nuevo) datos.id = Number(f.id.value);
    else datos.contrato = { tipo: f.tipo.value, fin: f.fin.value, sueldo: f.sueldo.value };
    try {
      const id = DB.guardarTrabajador(datos);
      $("#dialogo-trabajador").close();
      avisar(nuevo ? "Trabajador registrado. Completa su legajo." : "Datos actualizados.");
      llenarAreas(); refrescar();
      if (nuevo) abrirFicha(id); else if (estado.fichaAbierta === id) abrirFicha(id);
    } catch (err) { $("#t-error").textContent = err.message; }
  }
  function abrirCese(id) {
    const f = $("#form-cese");
    f.reset(); $("#ce-error").textContent = "";
    f.trabajador_id.value = id; f.fecha.value = DB.hoy();
    $("#dialogo-cese").showModal();
  }
  function guardarCese(e) {
    e.preventDefault();
    const f = e.target;
    try {
      DB.registrarCese(Number(f.trabajador_id.value), f.fecha.value, f.motivo.value);
      $("#dialogo-cese").close(); $("#dialogo-ficha").close();
      avisar("Cese registrado."); refrescar();
    } catch (err) { $("#ce-error").textContent = err.message; }
  }

  /* =================== Exportaciones =================== */
  function exportarPersonal() {
    const filas = [["DNI", "Apellidos", "Nombres", "Nacimiento", "Edad", "Área", "Cargo", "Ingreso", "Antigüedad", "Tipo de contrato", "Fin de contrato", "Sueldo", "Pensiones", "Celular", "Correo", "Documentos pendientes", "Estado"]];
    DB.listar(filtroPersonal()).forEach(function (t) {
      const a = t.contrato.actual;
      filas.push([t.dni, t.apellidos, t.nombres, fecha(t.nacimiento), t.edad, t.area, t.cargo, fecha(t.ingreso), DB.textoAntiguedad(t.antiguedad), a ? a.tipo : "", a && a.fin ? fecha(a.fin) : "", t.sueldo, t.pension, t.telefono, t.correo, t.faltantes.join(", "), t.activo ? "Activo" : "Cesado " + fecha(t.cese_fecha)]);
    });
    exportarExcel([{ nombre: "Personal", filas: filas, anchos: [10, 20, 16, 11, 6, 22, 24, 11, 16, 20, 13, 10, 8, 11, 32, 34, 18] }], "personal_" + DB.hoy() + ".xlsx");
  }
  function exportarContratos() {
    const filas = [["DNI", "Trabajador", "Área", "Tipo", "Inicio", "Fin", "Días para vencer", "Estado", "Plazo fijo acumulado (años)", "Sueldo"]];
    DB.listar().forEach(function (t) {
      const a = t.contrato.actual;
      filas.push([t.dni, t.nombre, t.area, a ? a.tipo : "", a ? fecha(a.inicio) : "", a && a.fin ? fecha(a.fin) : "Indeterminado", t.contrato.dias === null ? "" : t.contrato.dias, t.contrato.texto, Math.round(t.contrato.acumuladoFijo / 365 * 10) / 10, t.sueldo]);
    });
    exportarExcel([{ nombre: "Contratos", filas: filas, anchos: [10, 30, 22, 20, 11, 13, 10, 16, 14, 10] }], "contratos_" + DB.hoy() + ".xlsx");
  }
  function exportarVacaciones() {
    const resumen = [["DNI", "Trabajador", "Ingreso", "Periodos ganados", "Saldo (días)", "Días vencidos", "Truncos (días)", "Próximo periodo"]];
    const detalle = [["DNI", "Trabajador", "Periodo desde", "Periodo hasta", "Gozar antes del", "Gozados", "Pendientes", "Situación"]];
    DB.listar().forEach(function (t) {
      const v = t.vacaciones;
      resumen.push([t.dni, t.nombre, fecha(t.ingreso), v.periodos.length, v.saldo, v.vencidos.reduce(function (s, p) { return s + p.pendientes; }, 0), v.truncos, fecha(v.proximoPeriodo)]);
      v.periodos.forEach(function (p) { detalle.push([t.dni, t.nombre, fecha(p.desde), fecha(p.ganado), fecha(p.limite), p.gozados, p.pendientes, p.vencido ? "Vencido" : p.porVencer ? "Por vencer" : p.pendientes ? "Pendiente" : "Gozado"]); });
    });
    exportarExcel([{ nombre: "Saldos", filas: resumen, anchos: [10, 30, 11, 10, 10, 10, 10, 13] }, { nombre: "Periodos", filas: detalle, anchos: [10, 30, 12, 12, 13, 9, 10, 11] }], "vacaciones_" + DB.hoy() + ".xlsx");
  }

  /* =================== Eventos =================== */
  function enlazarEventos() {
    document.addEventListener("click", function (e) {
      const b = e.target.closest("[data-cerrar],[data-ficha],[data-contrato],[data-vacaciones],[data-editar],[data-cese],[data-meses]");
      if (!b) return;
      const d = b.dataset;
      if (d.cerrar !== undefined) { b.closest("dialog").close(); return; }
      if (d.ficha) abrirFicha(Number(d.ficha));
      if (d.contrato) abrirContrato(Number(d.contrato));
      if (d.vacaciones) abrirVacaciones(Number(d.vacaciones));
      if (d.editar) abrirTrabajador(Number(d.editar));
      if (d.cese) abrirCese(Number(d.cese));
      if (d.meses) ponerFin(Number(d.meses));
    });
    document.addEventListener("change", function (e) {
      const c = e.target.closest("[data-doc]");
      if (!c) return;
      DB.marcarDocumento(Number(c.dataset.trabajador), c.dataset.doc, c.checked);
      avisar(c.checked ? "Documento marcado como entregado." : "Documento marcado como pendiente.");
      refrescar();
    });
    $("#dialogo-ficha").addEventListener("close", function () { estado.fichaAbierta = null; });

    $("#btn-nuevo").addEventListener("click", function () { abrirTrabajador(null); });
    $("#a-filtro").addEventListener("change", pintarPanel);
    let espera;
    $("#p-buscar").addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(pintarPersonal, 180); });
    ["#p-area", "#p-tipo", "#p-estado"].forEach(function (s) { $(s).addEventListener("change", pintarPersonal); });
    $("#btn-exportar-personal").addEventListener("click", exportarPersonal);
    $("#btn-exportar-contratos").addEventListener("click", exportarContratos);
    $("#btn-exportar-vacaciones").addEventListener("click", exportarVacaciones);

    $("#form-trabajador").addEventListener("submit", guardarTrabajador);
    $("#t-tipo").addEventListener("change", sugerirFin);
    $("#t-ingreso").addEventListener("change", sugerirFin);
    $("#form-contrato").addEventListener("submit", guardarContrato);
    $("#co-tipo").addEventListener("change", actualizarTipo);
    $("#form-vacaciones").addEventListener("submit", function (e) { guardarVacaciones(e, false); });
    $("#va-desde").addEventListener("change", contarDias); $("#va-hasta").addEventListener("change", contarDias);
    $("#form-cese").addEventListener("submit", guardarCese);

    $("#btn-descargar-db").addEventListener("click", function () { descargar(DB.exportarArchivo(), "personal_demo_" + DB.hoy() + ".sqlite", "application/vnd.sqlite3"); });
    $("#btn-reiniciar").addEventListener("click", async function () {
      if (!(await confirmar("¿Restablecer la demo?", "Se borrarán tus cambios y se cargarán de nuevo los datos de ejemplo.", "Restablecer"))) return;
      await DB.reiniciar();
      $("#estado-guardado").textContent = ""; avisar("Demo restablecida con los datos de ejemplo.");
      llenarAreas(); irA(estado.vista);
    });
  }

  iniciar();
})();
