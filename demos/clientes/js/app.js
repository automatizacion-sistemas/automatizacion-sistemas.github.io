/* ==========================================================================
   app.js — Pantallas del seguimiento de clientes
   Vistas: agenda · embudo · clientes · reportes
   Diálogos: ficha de oportunidad, cambio de etapa, nueva oportunidad,
             cliente (nuevo/editar) y ficha del cliente
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, fecha, esc, tabla, avisar, confirmar, descargar, exportarExcel, ICONOS } = window.UI;

  const ICO = {
    whatsapp: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /> </svg>', reloj: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <circle cx="12" cy="12" r="10" /> <path d="M12 6v6l4 2" /> </svg>', alerta: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M12 6v6l4 2" /> <path d="M20 12v5" /> <path d="M20 21h.01" /> <path d="M21.25 8.2A10 10 0 1 0 16 21.16" /> </svg>', trofeo: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2" /> <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2" /> <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3" /> <path d="M4 22h16" /> <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" /> <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3" /> </svg>', perdido: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <circle cx="12" cy="12" r="10" /> <path d="m15 9-6 6" /> <path d="m9 9 6 6" /> </svg>',
    llamada: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" /> </svg>', correo: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /> <rect x="2" y="4" width="20" height="16" rx="2" /> </svg>', visita: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" /> <circle cx="12" cy="10" r="3" /> </svg>', cotizacion: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" /> </svg>', nota: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" /> <path d="M15 3v5a1 1 0 0 0 1 1h5" /> </svg>', etapa: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m16 3 4 4-4 4" /> <path d="M20 7H4" /> <path d="m8 21-4-4 4-4" /> <path d="M4 17h16" /> </svg>', abrir: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m9 18 6-6-6-6" /> </svg>'
  };
  const ICO_ACT = { "Llamada": ICO.llamada, "WhatsApp": ICO.whatsapp, "Correo": ICO.correo, "Visita": ICO.visita, "Cotización": ICO.cotizacion, "Nota": ICO.nota, "Cambio de etapa": ICO.etapa };
  const TITULOS = { agenda: "Agenda de hoy", embudo: "Embudo de ventas", clientes: "Clientes", reportes: "Reportes" };
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  const estado = { vista: "agenda", vendedor: "", opp: null, cliente: null, cambio: null, arrastrando: null };

  /* =================== Arranque y navegación =================== */
  async function iniciar() {
    try {
      const r = await DB.iniciar();
      $("#cargando").remove(); $("#app").hidden = false;
      $("#estado-guardado").textContent = r.nuevo ? "" : "Se cargaron tus cambios anteriores.";
      llenarSelectores(); enlazarEventos();
      irA(leerHash());
      window.addEventListener("hashchange", function () { irA(leerHash()); });
      setTimeout(function () { if (!DB.esPersistente()) $("#estado-guardado").textContent = "Este navegador no permite guardar datos: tus cambios se perderán al cerrar la página."; }, 1500);
    } catch (e) {
      console.error(e);
      $("#cargando").innerHTML = "<p><b>No se pudo iniciar la base de datos.</b><br>Prueba con otro navegador actualizado (Chrome, Edge, Firefox o Safari).</p>";
    }
  }
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "agenda"; }
  function irA(vista) {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); });
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) { a.classList.toggle("activo", a.dataset.vista === vista); a.toggleAttribute("aria-current", a.dataset.vista === vista); });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de seguimiento de clientes";
    pintar();
    window.scrollTo(0, 0);
  }
  function pintar() { ({ agenda: pintarAgenda, embudo: pintarEmbudo, clientes: pintarClientes, reportes: pintarReportes })[estado.vista](); }

  const opciones = function (lista, vacio) { return (vacio ? '<option value="">' + esc(vacio) + "</option>" : "") + lista.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + "</option>"; }).join(""); };
  function llenarSelectores() {
    $$(".sel-vendedor").forEach(function (s) { s.innerHTML = opciones(DB.VENDEDORES, "Todo el equipo"); s.value = estado.vendedor; });
    $("#c-origen").innerHTML = opciones(DB.ORIGENES, "Cualquier origen");
    $("#cl-origen").innerHTML = opciones(DB.ORIGENES, "Selecciona");
    $("#cl-vendedor").innerHTML = opciones(DB.VENDEDORES);
    $("#op-vendedor").innerHTML = opciones(DB.VENDEDORES, "Selecciona");
    $("#ac-tipo").innerHTML = opciones(DB.TIPOS_ACTIVIDAD);
    $("#de-motivo").innerHTML = opciones(DB.MOTIVOS, "Selecciona el motivo");
    $("#wa-plantilla").innerHTML = DB.PLANTILLAS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.nombre) + "</option>"; }).join("");
  }

  /* =================== Piezas =================== */
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" +
      (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function relativa(f) {
    const d = DB.diasEntre(DB.hoy(), f);
    if (d === 0) return "Hoy";
    if (d === 1) return "Mañana";
    if (d === -1) return "Ayer";
    if (d < 0) return "Hace " + -d + " días";
    if (d < 7) return DIAS[new Date(f + "T00:00:00").getDay()].replace(/^./, function (c) { return c.toUpperCase(); });
    return fecha(f);
  }
  function chipSeguimiento(o) {
    if (!o.abierta) return "";
    const clase = o.seguimiento < DB.hoy() ? "vencido" : o.seguimiento === DB.hoy() ? "hoy" : "futuro";
    return '<span class="chip-seg chip-seg--' + clase + '">' + (clase === "vencido" ? ICO.alerta : ICO.reloj) + relativa(o.seguimiento) + "</span>";
  }
  function chipEtapa(id) { return '<span class="chip-etapa chip-etapa--' + id.toLowerCase() + '">' + esc(DB.etapa(id).nombre) + "</span>"; }
  const nombreCliente = function (o) { return o.empresa || o.cliente; };
  const iniciales = function (n) { return n.split(" ").slice(0, 2).map(function (p) { return p[0]; }).join(""); };
  function enlaceWA(o, plantilla) { return '<a class="btn-icono btn-icono--wa" href="' + esc(DB.enlaceWhatsApp(o.telefono, DB.mensaje(o, plantilla || "cotizacion"))) + '" target="_blank" rel="noopener" title="Escribir por WhatsApp" aria-label="Escribir por WhatsApp a ' + esc(o.cliente) + '">' + ICO.whatsapp + "</a>"; }

  /* =================== Agenda =================== */
  function pintarAgenda() {
    const h = DB.hoy(), d = new Date(h + "T00:00:00");
    $("#a-fecha").textContent = DIAS[d.getDay()].replace(/^./, function (c) { return c.toUpperCase(); }) + " " + d.getDate() + " de " + MESES_L[d.getMonth()];
    const k = DB.indicadores(estado.vendedor);
    $("#kpis").innerHTML =
      kpi("En el embudo", soles(k.embudo), k.abiertas + " oportunidades abiertas") +
      kpi("Pronóstico ponderado", soles(k.ponderado), "según la probabilidad de cada etapa") +
      kpi("Ganado este mes", soles(k.ganadoMes), k.ventasMes + " venta(s) cerrada(s)") +
      kpi("Tasa de cierre", k.tasaCierre + " %", "de " + k.cerradas90 + " cerradas en 90 días" + (k.cicloDias ? " · " + k.cicloDias + " días en promedio" : "")) +
      kpi("Seguimientos vencidos", String(k.vencidas), k.vencidas ? "atiéndelos primero" : "todo al día", k.vencidas ? "peligro" : "");
    const a = DB.agenda(estado.vendedor);
    const bloque = function (titulo, lista, clase, vacio, detalle) {
      return '<section class="agenda__bloque agenda__bloque--' + clase + '"><h2>' + titulo + ' <span class="contador">' + lista.length + "</span></h2>" +
        (lista.length ? '<ul class="agenda__lista">' + lista.map(function (o) { return itemAgenda(o, detalle); }).join("") + "</ul>" : '<p class="vacio">' + vacio + "</p>") + "</section>";
    };
    $("#agenda").innerHTML =
      bloque("Vencidos", a.vencidas, "vencidos", "No hay seguimientos atrasados.") +
      bloque("Para hoy", a.hoy, "hoy", "No tienes seguimientos programados para hoy.") +
      bloque("Próximos 7 días", a.proximas, "proximos", "No hay seguimientos en los próximos días.") +
      bloque("Sin contacto hace más de " + DB.DIAS_ESTANCADA + " días", a.estancadas, "estancadas", "Ninguna oportunidad está abandonada.", true);
  }
  function itemAgenda(o, sinContacto) {
    return '<li class="agenda__item"><button type="button" class="agenda__abrir" data-opp="' + o.id + '">' +
      '<span class="agenda__fila"><b class="agenda__cliente">' + esc(nombreCliente(o)) + '</b><b class="agenda__monto">' + soles(o.monto) + "</b></span>" +
      '<span class="agenda__fila"><small class="agenda__titulo">' + esc(o.titulo) + "</small>" + chipEtapa(o.etapa) + "</span>" +
      '<span class="agenda__fila agenda__fila--seg">' + (sinContacto ? '<span class="chip-seg chip-seg--vencido">' + ICO.alerta + o.diasSinContacto + " días sin contacto</span>" : chipSeguimiento(o)) +
      "<small>" + esc(o.accion || "") + " · " + esc(o.vendedor.split(" ")[0]) + "</small></span></button>" + enlaceWA(o) + "</li>";
  }

  /* =================== Embudo =================== */
  function pintarEmbudo() {
    const lista = DB.oportunidades({ vendedor: estado.vendedor || null, texto: $("#e-buscar").value.trim() || null, cerradaDesde: DB.sumarDias(DB.hoy(), -30) });
    $("#tablero").innerHTML = DB.ETAPAS.map(function (e) {
      const col = lista.filter(function (o) { return o.etapa === e.id; });
      if (e.id === "GANADO" || e.id === "PERDIDO") col.sort(function (a, b) { return b.cerrada.localeCompare(a.cerrada); });
      const suma = col.reduce(function (s, o) { return s + o.monto; }, 0);
      return '<section class="columna columna--' + e.id.toLowerCase() + '" data-etapa="' + e.id + '" aria-label="' + esc(e.nombre) + '">' +
        '<header class="columna__cabecera"><h2>' + esc(e.nombre) + ' <span class="contador">' + col.length + "</span></h2><small>" + soles(suma) + (e.id === "GANADO" || e.id === "PERDIDO" ? " · últimos 30 días" : " · " + e.prob + " % prob.") + "</small></header>" +
        '<div class="columna__tarjetas">' + (col.length ? col.map(tarjeta).join("") : '<p class="vacio">Sin oportunidades</p>') + "</div></section>";
    }).join("");
  }
  function tarjeta(o) {
    const pie = o.abierta ? chipSeguimiento(o) + (o.estancada ? '<span class="chip-seg chip-seg--vencido" title="Sin contacto hace ' + o.diasSinContacto + ' días">' + o.diasSinContacto + " d sin contacto</span>" : "")
      : o.etapa === "GANADO" ? '<span class="chip-seg chip-seg--ganado">' + ICO.trofeo + fecha(o.cerrada) + "</span>" : '<span class="chip-seg chip-seg--perdido">' + esc(o.motivo_perdida) + "</span>";
    return '<button type="button" class="tarjeta' + (o.vencida ? " tarjeta--vencida" : "") + '" data-opp="' + o.id + '"' + (o.abierta ? ' draggable="true"' : "") + ">" +
      '<span class="tarjeta__cliente">' + esc(nombreCliente(o)) + "</span><span class=\"tarjeta__titulo\">" + esc(o.titulo) + "</span>" +
      '<span class="tarjeta__fila"><b>' + soles(o.monto) + '</b><span class="avatar" title="' + esc(o.vendedor) + '">' + esc(iniciales(o.vendedor)) + "</span></span>" +
      '<span class="tarjeta__pie">' + pie + "</span></button>";
  }

  /* =================== Clientes =================== */
  function filtroClientes() { return { texto: $("#c-buscar").value.trim(), estado: $("#c-estado").value, origen: $("#c-origen").value }; }
  function pintarClientes() {
    const lista = DB.listarClientes(filtroClientes());
    $("#c-total").textContent = lista.length + " cliente(s)";
    $("#tabla-clientes").innerHTML = tabla([
      { titulo: "Cliente", clase: "celda-titular", html: function (c) { return '<button type="button" class="enlace-tabla enlace-tabla--fuerte" data-cliente="' + c.id + '">' + esc(c.empresa || c.nombre) + "</button><small class='sub'>" + esc(c.empresa ? c.nombre + (c.ruc ? " · RUC " + c.ruc : "") : "Particular") + "</small>"; } },
      { titulo: "Celular", html: function (c) { return '<a href="tel:+51' + c.telefono + '">' + c.telefono.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") + "</a>"; } },
      { titulo: "Distrito", campo: "distrito" },
      { titulo: "Cómo llegó", campo: "origen" },
      { titulo: "Abiertas", clase: "num", html: function (c) { return c.abiertas ? "<b>" + c.abiertas + "</b>" : '<span class="sub">0</span>'; } },
      { titulo: "Ha comprado", clase: "num", html: function (c) { return c.ganado ? soles(c.ganado) : '<span class="sub">—</span>'; } },
      { titulo: "Último contacto", html: function (c) { return c.ultimo_contacto ? relativa(c.ultimo_contacto) : '<span class="sub">Nunca</span>'; } }
    ], lista, { vacio: "No hay clientes con esos filtros." });
  }
  function exportarClientes() {
    const filas = [["Contacto", "Empresa", "RUC", "Celular", "Correo", "Distrito", "Cómo llegó", "Cliente desde", "Oportunidades abiertas", "Total comprado (S/)", "Último contacto"]];
    DB.listarClientes(filtroClientes()).forEach(function (c) { filas.push([c.nombre, c.empresa, c.ruc || "", c.telefono, c.email || "", c.distrito, c.origen, fecha(c.creado), c.abiertas, c.ganado, fecha(c.ultimo_contacto)]); });
    const opps = [["Cliente", "Trabajo", "Etapa", "Monto (S/)", "Vendedor", "Creada", "Próximo seguimiento", "Próxima acción", "Cerrada", "Motivo de pérdida"]];
    DB.oportunidades({}).forEach(function (o) { opps.push([nombreCliente(o), o.titulo, DB.etapa(o.etapa).nombre, o.monto, o.vendedor, fecha(o.creada), fecha(o.seguimiento), o.accion || "", fecha(o.cerrada), o.motivo_perdida || ""]); });
    exportarExcel([{ nombre: "Clientes", filas: filas, anchos: [28, 36, 13, 11, 34, 20, 20, 13, 12, 14, 14] }, { nombre: "Oportunidades", filas: opps, anchos: [36, 44, 18, 12, 16, 11, 14, 36, 11, 22] }], "clientes_" + DB.hoy() + ".xlsx");
  }

  /* =================== Reportes =================== */
  function pintarReportes() {
    const r = DB.reportes(Number($("#r-meses").value));
    $("#r-sub").textContent = r.total + " oportunidades creadas desde " + fecha(r.meses[0].clave + "-01");
    GRAFICOS.barras("graf-meses", { etiquetas: r.porMes.map(function (m) { return m.etiqueta; }), soles: true, series: [{ nombre: "Ganado", datos: r.porMes.map(function (m) { return m.ganado; }), color: "celeste" }] });
    const base = r.conversion[0].cantidad || 1;
    $("#conversion").innerHTML = r.conversion.map(function (c, i) {
      const pct = Math.round(c.cantidad / base * 100), paso = i ? (r.conversion[i - 1].cantidad ? Math.round(c.cantidad / r.conversion[i - 1].cantidad * 100) : 0) : null;
      return '<div class="conversion__fila"><span class="conversion__nombre">' + esc(c.etapa.nombre) + '</span><span class="conversion__barra"><span style="width:' + Math.max(pct, 2) + '%"></span></span><b>' + c.cantidad + "</b><small>" + (paso === null ? "100 %" : paso + " % pasa") + "</small></div>";
    }).join("") + '<p class="campo__ayuda">De cada 10 oportunidades nuevas, <b>' + (Math.round(r.conversion[3].cantidad / base * 100) / 10).toString().replace(".", ",") + "</b> terminan en venta.</p>";
    const colsGrupo = function (nombre) {
      return [
        { titulo: nombre, clase: "celda-titular", html: function (g) { return "<b>" + esc(g.nombre) + "</b>"; } },
        { titulo: "Oportunidades", clase: "num", campo: "total" },
        { titulo: "Ganadas", clase: "num", campo: "ganadas" },
        { titulo: "Perdidas", clase: "num", campo: "perdidas" },
        { titulo: "Tasa de cierre", clase: "num", html: function (g) { return g.tasa === null ? '<span class="sub">—</span>' : '<span class="tasa' + (g.tasa >= 50 ? " tasa--alta" : g.tasa < 30 ? " tasa--baja" : "") + '">' + g.tasa + " %</span>"; } },
        { titulo: "Vendido", clase: "num", html: function (g) { return "<b>" + soles(g.monto) + "</b>"; } },
        { titulo: "En embudo", clase: "num", html: function (g) { return soles(g.embudo); } }
      ];
    };
    $("#tabla-origen").innerHTML = tabla(colsGrupo("Origen"), r.origen.filter(function (g) { return g.total; }), { vacio: "Sin datos en el período." });
    $("#tabla-vendedor").innerHTML = tabla(colsGrupo("Vendedor").filter(function (c) { return c.titulo !== "Perdidas"; }), r.vendedor, { vacio: "Sin datos." });
    const m = r.motivos.filter(function (x) { return x.cantidad; }), perdido = m.reduce(function (s, x) { return s + x.monto; }, 0);
    $("#tabla-motivos").innerHTML = tabla([
      { titulo: "Motivo", clase: "celda-titular", html: function (x) { return "<b>" + esc(x.motivo) + "</b>"; } },
      { titulo: "Oportunidades", clase: "num", campo: "cantidad" },
      { titulo: "Monto", clase: "num", html: function (x) { return soles(x.monto); } },
      { titulo: "% del monto", clase: "num", html: function (x) { return Math.round(x.monto / (perdido || 1) * 100) + " %"; } }
    ], m, { vacio: "No se perdieron oportunidades en el período." });
    GRAFICOS.barras("graf-motivos", { etiquetas: m.map(function (x) { return x.motivo; }), horizontal: true, series: [{ nombre: "Oportunidades perdidas", datos: m.map(function (x) { return x.cantidad; }), color: "ambar" }] });
  }
  function exportarReportes() {
    const r = DB.reportes(Number($("#r-meses").value));
    const titulo = [["REPORTE COMERCIAL — Frío Andino (datos ficticios)"], ["Período:", "desde " + fecha(r.meses[0].clave + "-01") + " hasta " + fecha(DB.hoy())], []];
    const grupo = function (nombre, lista) { return titulo.concat([[nombre, "Oportunidades", "Ganadas", "Perdidas", "Abiertas", "Tasa de cierre %", "Vendido S/", "En embudo S/"]]).concat(lista.map(function (g) { return [g.nombre, g.total, g.ganadas, g.perdidas, g.abiertas, g.tasa === null ? "" : g.tasa, g.monto, g.embudo]; })); };
    exportarExcel([
      { nombre: "Por mes", filas: titulo.concat([["Mes", "Oportunidades nuevas", "Ventas cerradas", "Monto ganado S/"]]).concat(r.porMes.map(function (m) { return [m.etiqueta, m.nuevas, m.ventas, m.ganado]; })), anchos: [16, 20, 16, 16] },
      { nombre: "Conversión", filas: titulo.concat([["Etapa", "Oportunidades que llegaron", "% del total"]]).concat(r.conversion.map(function (c) { return [c.etapa.nombre, c.cantidad, Math.round(c.cantidad / (r.conversion[0].cantidad || 1) * 100)]; })), anchos: [22, 26, 12] },
      { nombre: "Por origen", filas: grupo("Origen", r.origen), anchos: [22, 14, 10, 10, 10, 15, 14, 14] },
      { nombre: "Por vendedor", filas: grupo("Vendedor", r.vendedor), anchos: [18, 14, 10, 10, 10, 15, 14, 14] },
      { nombre: "Motivos de pérdida", filas: titulo.concat([["Motivo", "Oportunidades", "Monto perdido S/"]]).concat(r.motivos.map(function (x) { return [x.motivo, x.cantidad, x.monto]; })), anchos: [26, 14, 16] }
    ], "reporte_comercial_" + DB.hoy() + ".xlsx");
  }

  /* =================== Ficha de oportunidad =================== */
  function abrirFicha(id) {
    const o = DB.oportunidad(id);
    if (!o) return;
    estado.opp = id;
    $("#df-titulo").textContent = o.titulo;
    const seg = o.abierta ? '<div class="ficha__seguimiento' + (o.vencida ? " ficha__seguimiento--vencido" : "") + '">' + (o.vencida ? ICO.alerta : ICO.reloj) +
      "<span><small>Próximo seguimiento</small><b>" + relativa(o.seguimiento) + (o.vencida || o.seguimiento === DB.hoy() ? "" : " · " + fecha(o.seguimiento)) + "</b> " + esc(o.accion || "") + "</span></div>"
      : '<div class="ficha__seguimiento ficha__seguimiento--' + o.etapa.toLowerCase() + '">' + (o.etapa === "GANADO" ? ICO.trofeo : ICO.perdido) + "<span><small>" + (o.etapa === "GANADO" ? "Venta cerrada el " : "Perdida el ") + fecha(o.cerrada) + "</small><b>" +
        (o.etapa === "GANADO" ? soles(o.monto) : esc(o.motivo_perdida)) + "</b></span></div>";
    $("#df-cabecera").innerHTML = '<div class="ficha__datos"><div><button type="button" class="enlace-tabla enlace-tabla--fuerte" data-cliente="' + o.cliente_id + '">' + esc(nombreCliente(o)) + "</button><small class='sub'>" +
      esc((o.empresa ? o.cliente + " · " : "") + o.telefono.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") + " · " + o.origen) + "</small></div>" +
      "<dl><div><dt>Monto</dt><dd>" + soles(o.monto) + "</dd></div><div><dt>Vendedor</dt><dd>" + esc(o.vendedor) + "</dd></div><div><dt>Creada</dt><dd>" + fecha(o.creada) + "</dd></div></dl></div>" + seg;

    const orden = ["PROSPECTO", "COTIZADO", "NEGOCIACION"], pos = orden.indexOf(o.etapa);
    $("#df-etapas").innerHTML = DB.ETAPAS.map(function (e) {
      const actual = e.id === o.etapa, hecha = (pos >= 0 && orden.indexOf(e.id) >= 0 && orden.indexOf(e.id) < pos) || (!o.abierta && orden.indexOf(e.id) >= 0);
      return '<button type="button" class="etapa etapa--' + e.id.toLowerCase() + (actual ? " etapa--actual" : "") + (hecha ? " etapa--hecha" : "") + '" data-mover="' + e.id + '"' + (actual || !o.abierta ? " disabled" : "") + (actual ? ' aria-current="step"' : "") + ">" + esc(e.nombre) + "</button>";
    }).join("");

    const f = $("#form-actividad");
    f.reset(); $("#ac-error").textContent = "";
    f.fecha.value = DB.hoy(); f.fecha.max = DB.hoy(); f.fecha.min = o.creada;
    $("#ac-reprogramar").hidden = !o.abierta; $("#ac-atajos").hidden = !o.abierta;
    if (o.abierta) {
      f.seguimiento.min = DB.hoy(); f.seguimiento.value = DB.sumarDias(DB.hoy(), 3); f.accion.value = o.accion || "";
      $("#ac-atajos").innerHTML = [["Mañana", 1], ["En 3 días", 3], ["En una semana", 7], ["En 15 días", 15]].map(function (a) { return '<button type="button" class="atajo" data-dias="' + a[1] + '">' + a[0] + "</button>"; }).join("");
    }
    $("#wa-plantilla").value = o.etapa === "GANADO" ? "gracias" : o.etapa === "NEGOCIACION" ? "cierre" : o.vencida || o.estancada ? "recordatorio" : "cotizacion";
    actualizarWA();
    $("#df-historial").innerHTML = historial(DB.actividades({ oportunidad: id }));
    const d = $("#dialogo-ficha");
    if (!d.open) d.showModal();
  }
  function historial(lista) {
    if (!lista.length) return '<li class="vacio">Sin contactos registrados.</li>';
    return lista.map(function (a) {
      return '<li class="linea-tiempo__item' + (a.automatica ? " linea-tiempo__item--auto" : "") + '"><span class="linea-tiempo__icono">' + (ICO_ACT[a.tipo] || ICO.nota) + "</span><div><small>" + fecha(a.fecha) + " · " + esc(a.tipo) + (a.titulo && estado.cliente && !estado.opp ? " · " + esc(a.titulo) : "") + "</small><p>" + esc(a.nota) + "</p></div></li>";
    }).join("");
  }
  function actualizarWA() {
    const o = DB.oportunidad(estado.opp);
    if (!o) return;
    $("#wa-texto").value = DB.mensaje(o, $("#wa-plantilla").value);
    $("#wa-abrir").href = DB.enlaceWhatsApp(o.telefono, $("#wa-texto").value);
  }
  function guardarActividad(e) {
    e.preventDefault();
    const f = e.target, o = DB.oportunidad(estado.opp);
    try {
      DB.registrarActividad({ oportunidad_id: o.id, tipo: f.tipo.value, nota: f.nota.value, fecha: f.fecha.value, seguimiento: o.abierta ? f.seguimiento.value : null, accion: o.abierta ? f.accion.value : null });
      avisar(o.abierta ? "Contacto registrado. Próximo seguimiento: " + fecha(f.seguimiento.value) + "." : "Contacto registrado.");
      abrirFicha(o.id); pintar();
    } catch (err) { $("#ac-error").textContent = err.message; }
  }

  /* =================== Cambio de etapa =================== */
  function pedirCambio(id, hacia) {
    const o = DB.oportunidad(id);
    if (!o || o.etapa === hacia || !o.abierta) return;
    estado.cambio = { id: id, hacia: hacia };
    const f = $("#form-etapa"), abierta = DB.ABIERTAS.indexOf(hacia) >= 0;
    f.reset(); $("#de-error").textContent = "";
    $("#de-titulo").textContent = hacia === "GANADO" ? "¡Venta ganada!" : hacia === "PERDIDO" ? "Marcar como perdida" : "Pasar a «" + DB.etapa(hacia).nombre + "»";
    $("#de-sub").textContent = nombreCliente(o) + " · " + o.titulo;
    $("#de-abierta").hidden = !abierta; $("#de-ganado").hidden = hacia !== "GANADO"; $("#de-perdido").hidden = hacia !== "PERDIDO";
    $("#de-confirmar").className = "btn btn--chico " + (hacia === "PERDIDO" ? "btn--peligro" : "btn--primario");
    if (abierta) {
      f.seguimiento.min = DB.hoy(); f.seguimiento.value = DB.sumarDias(DB.hoy(), hacia === "NEGOCIACION" ? 2 : 3);
      f.accion.value = hacia === "COTIZADO" ? "Llamar para saber si revisó la cotización" : hacia === "NEGOCIACION" ? "Enviar propuesta final" : "Llamar para entender la necesidad";
    }
    if (hacia === "GANADO") f.monto.value = o.monto || "";
    $("#dialogo-etapa").showModal();
    (abierta ? f.seguimiento : hacia === "GANADO" ? f.monto : f.motivo).focus();
  }
  function confirmarCambio(e) {
    e.preventDefault();
    const f = e.target, c = estado.cambio;
    try {
      DB.moverEtapa(c.id, c.hacia, { seguimiento: f.seguimiento.value, accion: f.accion.value, monto: f.monto.value, motivo: f.motivo.value });
      $("#dialogo-etapa").close();
      avisar(c.hacia === "GANADO" ? "¡Venta registrada como ganada!" : c.hacia === "PERDIDO" ? "Oportunidad marcada como perdida." : "Oportunidad movida a «" + DB.etapa(c.hacia).nombre + "».");
      if ($("#dialogo-ficha").open) abrirFicha(c.id);
      pintar();
    } catch (err) { $("#de-error").textContent = err.message; }
  }

  /* =================== Nueva oportunidad =================== */
  function abrirNuevaOpp(clienteId) {
    const f = $("#form-opp");
    f.reset(); $("#op-error").textContent = "";
    const clientes = DB.listarClientes({});
    f.cliente_id.innerHTML = '<option value="">Selecciona el cliente</option>' + clientes.map(function (c) { return '<option value="' + c.id + '">' + esc(c.empresa ? c.empresa + " — " + c.nombre : c.nombre) + "</option>"; }).join("");
    if (clienteId) f.cliente_id.value = String(clienteId);
    f.vendedor.value = estado.vendedor || "";
    f.seguimiento.min = DB.hoy(); f.seguimiento.value = DB.sumarDias(DB.hoy(), 1);
    $("#dialogo-opp").showModal();
    (clienteId ? f.titulo : f.cliente_id).focus();
  }
  function guardarOpp(e) {
    e.preventDefault();
    const f = e.target;
    try {
      const id = DB.crearOportunidad({ cliente_id: Number(f.cliente_id.value), titulo: f.titulo.value, monto: f.monto.value, vendedor: f.vendedor.value, seguimiento: f.seguimiento.value, accion: f.accion.value });
      $("#dialogo-opp").close(); avisar("Oportunidad creada en «Nuevo contacto»."); pintar();
      if ($("#dialogo-ficha-cliente").open) abrirFichaCliente(Number(f.cliente_id.value));
      return id;
    } catch (err) { $("#op-error").textContent = err.message; }
  }

  /* =================== Clientes: formulario y ficha =================== */
  function abrirCliente(id) {
    const f = $("#form-cliente"), c = id ? DB.cliente(id) : null;
    f.reset(); $("#cl-error").textContent = "";
    estado.editarCliente = id || null;
    $("#dcl-titulo").textContent = c ? "Editar cliente" : "Nuevo cliente";
    $("#cl-guardar").textContent = c ? "Guardar cambios" : "Guardar cliente";
    $("#cl-necesidad").hidden = !!c;
    if (c) ["nombre", "telefono", "empresa", "ruc", "email", "distrito", "origen"].forEach(function (k) { f[k].value = c[k] || ""; });
    f.seguimiento.min = DB.hoy(); f.seguimiento.value = DB.sumarDias(DB.hoy(), 1);
    f.vendedor.value = estado.vendedor || DB.VENDEDORES[0];
    $("#dialogo-cliente").showModal();
    f.nombre.focus();
  }
  function guardarCliente(e) {
    e.preventDefault();
    const f = e.target, datos = { nombre: f.nombre.value, telefono: f.telefono.value, empresa: f.empresa.value, ruc: f.ruc.value, email: f.email.value, distrito: f.distrito.value, origen: f.origen.value };
    try {
      if (estado.editarCliente) {
        DB.editarCliente(estado.editarCliente, datos);
        $("#dialogo-cliente").close(); avisar("Datos del cliente actualizados.");
        pintar(); if ($("#dialogo-ficha-cliente").open) abrirFichaCliente(estado.editarCliente);
        return;
      }
      const titulo = f.titulo.value.trim();
      // Si también se pidió crear la oportunidad, se valida todo antes de guardar nada
      DB.ejecutar("SAVEPOINT nuevo_cliente");
      let id;
      try {
        id = DB.crearCliente(datos);
        if (titulo) DB.crearOportunidad({ cliente_id: id, titulo: titulo, monto: f.monto.value, vendedor: f.vendedor.value, seguimiento: f.seguimiento.value, accion: "Llamar para entender la necesidad" });
        DB.ejecutar("RELEASE nuevo_cliente");
      } catch (err) { DB.ejecutar("ROLLBACK TO nuevo_cliente"); DB.ejecutar("RELEASE nuevo_cliente"); throw err; }
      $("#dialogo-cliente").close();
      avisar(titulo ? "Cliente y oportunidad creados." : "Cliente registrado.");
      pintar();
      if (estado.volverAOpp) { estado.volverAOpp = false; abrirNuevaOpp(id); }
    } catch (err) { $("#cl-error").textContent = err.message; }
  }
  function abrirFichaCliente(id) {
    const c = DB.cliente(id);
    if (!c) return;
    estado.cliente = id; estado.opp = null;
    const opps = DB.oportunidades({ cliente: id });
    const ganado = opps.filter(function (o) { return o.etapa === "GANADO"; }).reduce(function (s, o) { return s + o.monto; }, 0);
    $("#dfc-titulo").textContent = c.empresa || c.nombre;
    $("#dfc-datos").innerHTML = '<div class="ficha__datos"><div><b>' + esc(c.nombre) + "</b><small class='sub'>" + esc([c.empresa ? (c.ruc ? "RUC " + c.ruc : "Sin RUC") : "Particular", c.distrito, "Cliente desde " + fecha(c.creado)].filter(Boolean).join(" · ")) + "</small></div>" +
      "<dl><div><dt>Celular</dt><dd><a href=\"tel:+51" + c.telefono + "\">" + c.telefono.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3") + "</a></dd></div><div><dt>Correo</dt><dd>" + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a>" : "—") + "</dd></div><div><dt>Cómo llegó</dt><dd>" + esc(c.origen) + "</dd></div><div><dt>Ha comprado</dt><dd>" + soles(ganado) + "</dd></div></dl></div>" +
      '<div class="fila-botones-izq"><a class="btn btn--whatsapp btn--chico" href="' + esc("https://wa.me/51" + c.telefono) + '" target="_blank" rel="noopener">' + ICO.whatsapp + ' WhatsApp</a>' +
      '<button type="button" class="btn btn--secundario btn--chico" data-editar-cliente="' + id + '">' + ICONOS.editar + ' Editar</button>' +
      '<button type="button" class="btn btn--secundario btn--chico" data-opp-cliente="' + id + '"><svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M5 12h14" /> <path d="M12 5v14" /> </svg> Nueva oportunidad</button>' +
      '<button type="button" class="btn-icono btn-icono--peligro" data-eliminar-cliente="' + id + '" title="Eliminar cliente" aria-label="Eliminar cliente">' + ICONOS.eliminar + "</button></div>";
    $("#dfc-opps").innerHTML = opps.length ? '<ul class="lista-opps">' + opps.slice().reverse().map(function (o) {
      return '<li><button type="button" class="lista-opps__item" data-opp="' + o.id + '"><span><b>' + esc(o.titulo) + "</b><small>" + fecha(o.creada) + " · " + esc(o.vendedor) + "</small></span><span>" + chipEtapa(o.etapa) + "<b>" + soles(o.monto) + "</b></span></button></li>";
    }).join("") + "</ul>" : '<p class="vacio">Aún no tiene oportunidades.</p>';
    $("#dfc-historial").innerHTML = historial(DB.actividades({ cliente: id }));
    const d = $("#dialogo-ficha-cliente");
    if (!d.open) d.showModal();
  }

  /* =================== Arrastrar y soltar (escritorio) =================== */
  function enlazarArrastre() {
    const t = $("#tablero");
    t.addEventListener("dragstart", function (e) {
      const card = e.target.closest(".tarjeta[draggable]");
      if (!card) return;
      estado.arrastrando = Number(card.dataset.opp);
      e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", card.dataset.opp);
      card.classList.add("arrastrando");
    });
    t.addEventListener("dragend", function () { $$(".arrastrando, .columna--destino").forEach(function (x) { x.classList.remove("arrastrando", "columna--destino"); }); });
    t.addEventListener("dragover", function (e) {
      const col = e.target.closest(".columna");
      if (!col || !estado.arrastrando) return;
      e.preventDefault();
      $$(".columna--destino").forEach(function (x) { if (x !== col) x.classList.remove("columna--destino"); });
      col.classList.add("columna--destino");
    });
    t.addEventListener("drop", function (e) {
      const col = e.target.closest(".columna");
      if (!col || !estado.arrastrando) return;
      e.preventDefault();
      const id = estado.arrastrando; estado.arrastrando = null;
      col.classList.remove("columna--destino");
      pedirCambio(id, col.dataset.etapa);
    });
  }

  /* =================== Eventos =================== */
  function enlazarEventos() {
    document.addEventListener("click", async function (e) {
      const b = e.target.closest("[data-cerrar],[data-opp],[data-cliente],[data-mover],[data-dias],[data-editar-cliente],[data-opp-cliente],[data-eliminar-cliente]");
      if (!b) return;
      const d = b.dataset;
      if (d.cerrar !== undefined) { b.closest("dialog").close(); return; }
      if (d.opp) { if ($("#dialogo-ficha-cliente").open) $("#dialogo-ficha-cliente").close(); abrirFicha(Number(d.opp)); }
      if (d.cliente) { if ($("#dialogo-ficha").open) $("#dialogo-ficha").close(); abrirFichaCliente(Number(d.cliente)); }
      if (d.mover) pedirCambio(estado.opp, d.mover);
      if (d.dias) $("#ac-seguimiento").value = DB.sumarDias(DB.hoy(), Number(d.dias));
      if (d.editarCliente) abrirCliente(Number(d.editarCliente));
      if (d.oppCliente) abrirNuevaOpp(Number(d.oppCliente));
      if (d.eliminarCliente) {
        const id = Number(d.eliminarCliente), n = DB.oportunidades({ cliente: id }).length;
        if (await confirmar("¿Eliminar este cliente?", "Se borrarán también sus " + n + " oportunidad(es) y todo su historial. Esta acción no se puede deshacer.", "Eliminar")) {
          DB.eliminarCliente(id); $("#dialogo-ficha-cliente").close(); avisar("Cliente eliminado."); pintar();
        }
      }
    });
    $("#dialogo-ficha").addEventListener("close", function () { estado.opp = null; });

    $$(".sel-vendedor").forEach(function (s) { s.addEventListener("change", function () { estado.vendedor = s.value; $$(".sel-vendedor").forEach(function (x) { x.value = s.value; }); pintar(); }); });
    let espera;
    const conEspera = function (fn) { return function () { clearTimeout(espera); espera = setTimeout(fn, 180); }; };
    $("#e-buscar").addEventListener("input", conEspera(pintarEmbudo));
    $("#c-buscar").addEventListener("input", conEspera(pintarClientes));
    ["#c-estado", "#c-origen"].forEach(function (s) { $(s).addEventListener("change", pintarClientes); });
    $("#r-meses").addEventListener("change", pintarReportes);
    $("#btn-exportar-clientes").addEventListener("click", exportarClientes);
    $("#btn-exportar-reportes").addEventListener("click", exportarReportes);

    $("#form-actividad").addEventListener("submit", guardarActividad);
    $("#form-etapa").addEventListener("submit", confirmarCambio);
    $("#form-opp").addEventListener("submit", guardarOpp);
    $("#form-cliente").addEventListener("submit", guardarCliente);
    $("#wa-plantilla").addEventListener("change", actualizarWA);
    $("#wa-texto").addEventListener("input", function () { const o = DB.oportunidad(estado.opp); if (o) $("#wa-abrir").href = DB.enlaceWhatsApp(o.telefono, $("#wa-texto").value); });
    // Al abrir WhatsApp se deja preparado el registro del contacto (el usuario confirma si lo envió)
    $("#wa-abrir").addEventListener("click", function () {
      const f = $("#form-actividad");
      f.tipo.value = "WhatsApp";
      f.nota.value = "Mensaje enviado: " + $("#wa-plantilla").selectedOptions[0].textContent.toLowerCase();
      setTimeout(function () { f.nota.focus(); }, 0);
    });
    $("#btn-nueva-opp").addEventListener("click", function () { abrirNuevaOpp(); });
    $("#btn-nuevo-cliente").addEventListener("click", function () { estado.volverAOpp = false; abrirCliente(); });
    $("#op-cliente-nuevo").addEventListener("click", function () { $("#dialogo-opp").close(); estado.volverAOpp = true; abrirCliente(); });
    enlazarArrastre();

    $("#btn-descargar-db").addEventListener("click", function () { descargar(DB.exportarArchivo(), "clientes_demo_" + DB.hoy() + ".sqlite", "application/vnd.sqlite3"); });
    $("#btn-reiniciar").addEventListener("click", async function () {
      if (!(await confirmar("¿Restablecer la demo?", "Se borrarán tus cambios y se cargarán de nuevo los datos de ejemplo.", "Restablecer"))) return;
      await DB.reiniciar();
      $("#estado-guardado").textContent = ""; avisar("Demo restablecida con los datos de ejemplo.");
      irA(estado.vista);
    });
  }

  iniciar();
})();
