/* ==========================================================================
   app.js — Pantallas del sistema de ventas y cobranzas
   Vistas: dashboard · ventas · cobranzas · por-cobrar · clientes
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, num, fecha, esc, tabla, avisar, confirmar, descargar, exportarExcel, ICONOS } = window.UI;

  const ICO = {
    whatsapp: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /> </svg>',
    cobrar: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" /> <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /> <path d="m2 16 6 6" /> <circle cx="16" cy="9" r="2.9" /> <circle cx="6" cy="5" r="3" /> </svg>',
    ver: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" /> </svg>',
    cuenta: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M10 9H8" /> <path d="M16 13H8" /> <path d="M16 17H8" /> </svg>'
  };
  const TITULOS = { dashboard: "Dashboard", ventas: "Ventas", cobranzas: "Cobranzas", "por-cobrar": "Cuentas por cobrar", clientes: "Clientes" };
  const EMPRESA = "Distribuidora Andina";
  const estado = { vista: "dashboard", preCobro: null };

  /* =================== Arranque y navegación =================== */
  async function iniciar() {
    try {
      const r = await DB.iniciar();
      $("#cargando").remove();
      $("#app").hidden = false;
      $("#estado-guardado").textContent = r.nuevo ? "" : "Se cargaron tus cambios anteriores.";
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
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "dashboard"; }
  function irA(vista) {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); }); // al cambiar de vista se cierra cualquier ventana abierta
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) {
      a.classList.toggle("activo", a.dataset.vista === vista);
      a.toggleAttribute("aria-current", a.dataset.vista === vista);
    });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de ventas y cobranzas";
    ({ dashboard: pintarDashboard, ventas: pintarVentas, cobranzas: pintarCobranzas, "por-cobrar": pintarAntiguedad, clientes: pintarClientes })[vista]();
    window.scrollTo(0, 0);
  }
  function navegar(vista) { if (location.hash === "#" + vista) irA(vista); else location.hash = vista; }
  function refrescar() { irA(estado.vista); }

  /* =================== Piezas reutilizables =================== */
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" +
      (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function chipEstado(v) {
    const e = v.estado;
    const texto = e.clave === "vencida" ? "Vencida " + e.dias + " d" : e.texto;
    return '<span class="chip-estado chip-estado--' + e.clave + '">' + esc(texto) + "</span>";
  }
  function comprobante(v) {
    return '<button type="button" class="enlace-tabla" data-detalle="' + v.id + '">' + esc(v.comprobante_numero) + "</button>";
  }
  function accionesVenta(v, conWhatsapp) {
    let h = "";
    if (v.saldo > 0) {
      if (conWhatsapp && v.estado.clave !== "vigente") h += '<button type="button" class="btn-icono btn-icono--wsp" data-recordar="' + v.id + '" title="Recordar por WhatsApp" aria-label="Recordar pago por WhatsApp">' + ICO.whatsapp + "</button>";
      h += '<button type="button" class="btn-icono" data-cobrar="' + v.id + '" title="Registrar cobro" aria-label="Registrar cobro de ' + esc(v.comprobante_numero) + '">' + ICO.cobrar + "<span>Cobrar</span></button>";
    }
    return h;
  }

  /* =================== Dashboard =================== */
  function pintarDashboard() {
    const r = DB.resumen();
    $("#kpis").innerHTML =
      kpi("Ventas del mes", soles(r.ventasMes), r.nVentasMes + " comprobantes") +
      kpi("Cobrado del mes", soles(r.cobradoMes), "incluye ventas al contado") +
      kpi("Por cobrar", soles(r.porCobrar), r.nPendientes + " comprobantes pendientes") +
      kpi("Deuda vencida", soles(r.vencido), r.pctVencido + " % de lo que se debe", r.vencido > 0 ? "alerta" : "");

    const m = DB.porMes(6);
    GRAFICOS.barras("graf-meses", { etiquetas: m.etiquetas, soles: true, series: [
      { nombre: "Ventas", datos: m.ventas, color: "azul" }, { nombre: "Cobranzas", datos: m.cobros, color: "celeste" }] });
    const a = r.antiguedad;
    GRAFICOS.barras("graf-antiguedad", {
      etiquetas: a.tramos.map(function (t) { return t.titulo; }), soles: true,
      series: [{ nombre: "Saldo", datos: a.tramos.map(function (t) { return a.totales[t.clave]; }), color: ["celeste", "#f59e0b", "ambar", "#dc2626", "rojo"] }]
    });

    $("#tabla-prioritarias").innerHTML = tabla([
      { titulo: "Cliente", html: function (v) { return "<b>" + esc(v.cliente) + "</b><small class='sub'>" + comprobante(v) + "</small>"; } },
      { titulo: "Atraso", html: chipEstado },
      { titulo: "Saldo", clase: "num", html: function (v) { return soles(v.saldo); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (v) { return accionesVenta(v, true); } }
    ], r.prioritarias.slice(0, 8), { vacio: "No hay comprobantes vencidos. ¡Cobranza al día!" });

    $("#tabla-proximas").innerHTML = tabla([
      { titulo: "Cliente", html: function (v) { return "<b>" + esc(v.cliente) + "</b><small class='sub'>" + comprobante(v) + "</small>"; } },
      { titulo: "Vence", html: function (v) { return fecha(v.vencimiento) + "<small class='sub'>" + esc(v.estado.texto) + "</small>"; } },
      { titulo: "Saldo", clase: "num", html: function (v) { return soles(v.saldo); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (v) { return accionesVenta(v, true); } }
    ], r.proximas.slice(0, 8), { vacio: "Ningún comprobante vence en los próximos 7 días." });
  }

  /* =================== Ventas =================== */
  function filtroVentas() {
    return { texto: $("#v-buscar").value.trim(), estado: $("#v-estado").value, condicion: $("#v-condicion").value };
  }
  function pintarVentas() {
    const ventas = DB.listarVentas(filtroVentas());
    $("#tabla-ventas").innerHTML = tabla([
      { titulo: "Fecha", html: function (v) { return fecha(v.fecha); } },
      { titulo: "Comprobante", html: function (v) { return comprobante(v) + "<small class='sub'>" + (v.condicion === "CREDITO" ? "Crédito · vence " + fecha(v.vencimiento) : "Contado") + "</small>"; } },
      { titulo: "Cliente", html: function (v) { return "<b>" + esc(v.cliente) + "</b><small class='sub'>" + esc(v.descripcion) + "</small>"; } },
      { titulo: "Total", clase: "num", html: function (v) { return soles(v.total); } },
      { titulo: "Saldo", clase: "num", html: function (v) { return v.saldo > 0 ? "<b>" + soles(v.saldo) + "</b>" : '<span class="sub">—</span>'; } },
      { titulo: "Estado", html: chipEstado },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (v) { return accionesVenta(v, true); } }
    ], ventas.slice(0, 150), { vacio: "No hay ventas con esos filtros.", clase: "tabla--ventas" });
    const total = ventas.reduce(function (s, v) { return s + v.total; }, 0), saldo = ventas.reduce(function (s, v) { return s + v.saldo; }, 0);
    $("#resumen-ventas").textContent = ventas.length + " comprobante(s)" + (ventas.length > 150 ? " (se muestran los 150 más recientes)" : "") +
      " · total " + soles(total) + " · saldo " + soles(saldo);
  }

  /* ---- Nueva venta ---- */
  function abrirVenta(clienteId) {
    const f = $("#form-venta");
    f.reset(); $("#v-error").textContent = "";
    f.cliente_id.innerHTML = '<option value="">Selecciona un cliente</option>' + DB.listarClientes().map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.nombre + " · " + c.documento) + "</option>";
    }).join("");
    if (clienteId) f.cliente_id.value = String(clienteId);
    f.fecha.value = DB.hoy(); f.fecha.max = DB.hoy();
    actualizarFormVenta();
    $("#dialogo-venta").showModal();
  }
  function actualizarFormVenta(cambio) {
    const f = $("#form-venta");
    const c = f.cliente_id.value ? DB.obtenerCliente(f.cliente_id.value) : null;
    const credito = f.querySelector("[name=condicion]:checked").value === "CREDITO";
    // Comprobante según documento del cliente
    const opFactura = f.comprobante.querySelector('[value="FACTURA"]');
    if (c) {
      const esRuc = c.tipo_doc === "RUC";
      opFactura.disabled = !esRuc;
      if (cambio === "cliente") f.comprobante.value = esRuc ? "FACTURA" : "BOLETA";
      if (!esRuc) f.comprobante.value = "BOLETA";
      $("#v-cliente-info").textContent = c.tipo_doc + " " + c.documento + " · crédito " + c.dias_credito + " días" +
        (c.limite_credito > 0 ? " · disponible " + soles(Math.max(0, c.disponible)) : "") + (c.deuda > 0 ? " · debe " + soles(c.deuda) : "");
    } else {
      opFactura.disabled = false; $("#v-cliente-info").textContent = "";
    }
    const serie = DB.serieDe(f.comprobante.value);
    $("#v-numero").textContent = "N° " + serie + "-" + String(DB.siguienteNumero(serie)).padStart(6, "0");
    $("#campo-vencimiento").hidden = !credito; $("#campo-medio").hidden = credito;
    if (credito && c && (cambio === "cliente" || cambio === "condicion" || cambio === "fecha" || !f.vencimiento.value)) {
      f.vencimiento.value = DB.sumarDias(f.fecha.value || DB.hoy(), c.dias_credito);
    }
    const total = Number(f.total.value);
    $("#v-igv").textContent = total > 0 ? "Valor venta " + soles(DB.r2(total / 1.18)) + " + IGV " + soles(DB.r2(total - total / 1.18)) : "";
  }
  function guardarVenta(e) {
    e.preventDefault();
    const f = e.target;
    try {
      const credito = f.querySelector("[name=condicion]:checked").value === "CREDITO";
      const r = DB.registrarVenta({
        cliente_id: Number(f.cliente_id.value), fecha: f.fecha.value, comprobante: f.comprobante.value,
        condicion: credito ? "CREDITO" : "CONTADO", vencimiento: credito ? f.vencimiento.value : null,
        descripcion: f.descripcion.value, total: f.total.value, medio: f.medio.value
      });
      $("#dialogo-venta").close();
      avisar("Venta " + r.comprobante + " registrada" + (credito ? " al crédito." : " y cobrada."));
      refrescar();
    } catch (err) { $("#v-error").textContent = err.message; }
  }

  /* ---- Detalle de venta ---- */
  function abrirDetalle(id) {
    const v = DB.obtenerVenta(id);
    $("#dd-titulo").textContent = (v.comprobante === "FACTURA" ? "Factura " : "Boleta ") + v.comprobante_numero;
    $("#dd-cuerpo").innerHTML =
      '<dl class="ficha">' +
        "<dt>Cliente</dt><dd><b>" + esc(v.cliente) + "</b><br><small>" + esc(v.documento) + "</small></dd>" +
        "<dt>Fecha</dt><dd>" + fecha(v.fecha) + "</dd>" +
        "<dt>Condición</dt><dd>" + (v.condicion === "CREDITO" ? "Crédito · vence " + fecha(v.vencimiento) : "Contado") + "</dd>" +
        "<dt>Descripción</dt><dd>" + esc(v.descripcion || "—") + "</dd>" +
      "</dl>" +
      '<table class="totales"><tr><td>Valor de venta</td><td>' + soles(v.base) + "</td></tr><tr><td>IGV (18 %)</td><td>" + soles(v.igv) +
        "</td></tr><tr class='totales__total'><td>Importe total</td><td>" + soles(v.total) + "</td></tr><tr><td>Cobrado</td><td>" + soles(v.cobrado) +
        "</td></tr><tr class='totales__saldo'><td>Saldo</td><td>" + soles(v.saldo) + " " + chipEstado(v) + "</td></tr></table>" +
      "<h3 class='dialogo__sub'>Cobros</h3>" +
      tabla([
        { titulo: "Fecha", html: function (c) { return fecha(c.fecha); } },
        { titulo: "Medio", html: function (c) { return esc(c.medio) + (c.operacion ? "<small class='sub'>Op. " + esc(c.operacion) + "</small>" : ""); } },
        { titulo: "Monto", clase: "num", html: function (c) { return soles(c.monto); } }
      ], v.cobros, { vacio: "Aún no tiene cobros registrados." }) +
      (v.saldo > 0 ? '<div class="dialogo__pie">' + accionesVenta(v, true) + "</div>" : "");
    $("#dialogo-detalle").showModal();
  }

  /* =================== Cobranzas =================== */
  function pintarCobranzas() {
    const f = $("#form-cobro");
    const pendientes = DB.listarVentas({ soloPendientes: true }).sort(function (a, b) { return a.cliente.localeCompare(b.cliente) || (a.fecha < b.fecha ? -1 : 1); });
    const actual = f.venta_id.value;
    f.venta_id.innerHTML = '<option value="">Selecciona un comprobante</option>' + pendientes.map(function (v) {
      return '<option value="' + v.id + '">' + esc(v.cliente + " · " + v.comprobante_numero + " · saldo S/ " + v.saldo.toFixed(2)) + "</option>";
    }).join("");
    const pre = estado.preCobro; estado.preCobro = null;
    f.venta_id.value = pre ? String(pre) : actual;
    f.fecha.max = DB.hoy(); if (!f.fecha.value) f.fecha.value = DB.hoy();
    actualizarCobro(Boolean(pre));
    if (pre) { f.monto.focus(); f.monto.select(); }

    $("#tabla-cobros").innerHTML = tabla([
      { titulo: "Fecha", html: function (c) { return fecha(c.fecha); } },
      { titulo: "Cliente", html: function (c) { return esc(c.cliente) + "<small class='sub'>" + esc(c.comprobante_numero) + "</small>"; } },
      { titulo: "Medio", html: function (c) { return esc(c.medio) + (c.operacion ? "<small class='sub'>Op. " + esc(c.operacion) + "</small>" : ""); } },
      { titulo: "Monto", clase: "num", html: function (c) { return "<b>" + soles(c.monto) + "</b>"; } }
    ], DB.listarCobros(60), { vacio: "Todavía no hay cobros." });
  }
  function actualizarCobro(sugerirMonto) {
    const f = $("#form-cobro");
    const id = Number(f.venta_id.value);
    if (!id) { $("#c-info").textContent = ""; return; }
    const v = DB.obtenerVenta(id);
    $("#c-info").innerHTML = "Total " + soles(v.total) + " · cobrado " + soles(v.cobrado) + " · <b>saldo " + soles(v.saldo) + "</b> · " + esc(v.estado.clave === "vencida" ? "vencida hace " + v.estado.dias + " días" : v.estado.texto.toLowerCase());
    if (sugerirMonto) f.monto.value = v.saldo.toFixed(2);
  }
  function guardarCobro(e) {
    e.preventDefault();
    const f = e.target, error = $("#c-error");
    error.textContent = "";
    try {
      const saldo = DB.registrarCobro({ venta_id: Number(f.venta_id.value), monto: f.monto.value, fecha: f.fecha.value, medio: f.medio.value, operacion: f.operacion.value });
      avisar(saldo > 0 ? "Cobro registrado. Queda un saldo de " + soles(saldo) + "." : "Cobro registrado. El comprobante quedó pagado.");
      f.monto.value = ""; f.operacion.value = "";
      pintarCobranzas();
    } catch (err) { error.textContent = err.message; }
  }

  /* =================== Cuentas por cobrar =================== */
  function pintarAntiguedad() {
    const a = DB.antiguedad();
    const colores = { por_vencer: "", d1_30: "", d31_60: "alerta", d61_90: "alerta", d90: "peligro" };
    $("#tramos").innerHTML = a.tramos.map(function (t) {
      const pct = a.totales.total ? Math.round(a.totales[t.clave] / a.totales.total * 100) : 0;
      return kpi(t.titulo, soles(a.totales[t.clave]), pct + " % del total", a.totales[t.clave] > 0 ? colores[t.clave] : "");
    }).join("");
    const cols = [
      { titulo: "Cliente", html: function (c) { return '<button type="button" class="enlace-tabla" data-cuenta="' + c.cliente_id + '"><b>' + esc(c.cliente) + "</b></button><small class='sub'>" + esc(c.documento) + " · " + c.documentos + " comprobante(s)</small>"; } }
    ].concat(a.tramos.map(function (t) {
      return { titulo: t.titulo, clase: "num " + (t.clave === "d90" ? "celda-peligro" : ""), html: function (c) { return c[t.clave] ? soles(c[t.clave]) : '<span class="sub">—</span>'; } };
    })).concat([
      { titulo: "Total", clase: "num", html: function (c) { return "<b>" + soles(c.total) + "</b>"; } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (c) {
        return '<button type="button" class="btn-icono" data-cuenta="' + c.cliente_id + '" title="Estado de cuenta" aria-label="Estado de cuenta de ' + esc(c.cliente) + '">' + ICO.cuenta + "</button>"; } }
    ]);
    const filas = a.filas.slice();
    $("#tabla-antiguedad").innerHTML = tabla(cols, filas, { vacio: "No hay cuentas por cobrar.", clase: "tabla--ancha tabla--antiguedad" }) +
      (filas.length ? '<div class="fila-total"><span>Total por cobrar</span><b>' + soles(a.totales.total) + "</b></div>" : "");
  }

  function exportarAntiguedad() {
    const a = DB.antiguedad();
    const filas = [["ANTIGÜEDAD DE SALDOS — CUENTAS POR COBRAR"], ["Empresa:", EMPRESA + " (datos ficticios)"], ["Al:", fecha(DB.hoy())], [],
      ["Cliente", "RUC/DNI"].concat(a.tramos.map(function (t) { return t.titulo; })).concat(["Total"])];
    a.filas.forEach(function (c) { filas.push([c.cliente, c.documento].concat(a.tramos.map(function (t) { return c[t.clave] || 0; })).concat([c.total])); });
    filas.push(["TOTAL", ""].concat(a.tramos.map(function (t) { return a.totales[t.clave]; })).concat([a.totales.total]));
    const detalle = [["Cliente", "Comprobante", "Fecha", "Vencimiento", "Días de atraso", "Total", "Saldo"]];
    a.pendientes.forEach(function (v) { detalle.push([v.cliente, v.comprobante_numero, fecha(v.fecha), fecha(v.vencimiento), Math.max(0, v.estado.dias), v.total, v.saldo]); });
    exportarExcel([
      { nombre: "Antigüedad", filas: filas, anchos: [40, 13, 13, 13, 13, 13, 13, 14] },
      { nombre: "Detalle pendientes", filas: detalle, anchos: [40, 16, 12, 13, 14, 12, 12] }
    ], "cuentas_por_cobrar_" + DB.hoy() + ".xlsx");
  }

  /* =================== Clientes =================== */
  function pintarClientes() {
    const clientes = DB.listarClientes($("#cl-buscar").value.trim());
    $("#tabla-clientes").innerHTML = tabla([
      { titulo: "Cliente", html: function (c) { return "<b>" + esc(c.nombre) + "</b><small class='sub'>" + esc(c.tipo_doc + " " + c.documento) + (c.telefono ? " · " + esc(c.telefono) : "") + "</small>"; } },
      { titulo: "Crédito", html: function (c) { return c.dias_credito ? c.dias_credito + " días" + (c.limite_credito ? "<small class='sub'>Línea " + soles(c.limite_credito) + "</small>" : "<small class='sub'>Sin límite</small>") : '<span class="sub">Solo contado</span>'; } },
      { titulo: "Deuda", clase: "num", html: function (c) { return c.deuda ? "<b>" + soles(c.deuda) + "</b>" + (c.vencido ? "<small class='sub texto-peligro'>" + soles(c.vencido) + " vencido</small>" : "") : '<span class="sub">—</span>'; } },
      { titulo: "Disponible", clase: "num", html: function (c) { return c.disponible === null ? '<span class="sub">—</span>' : soles(Math.max(0, c.disponible)); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (c) {
        return '<button type="button" class="btn-icono" data-cuenta="' + c.id + '" title="Estado de cuenta" aria-label="Estado de cuenta de ' + esc(c.nombre) + '">' + ICO.cuenta + "</button>" +
          '<button type="button" class="btn-icono" data-editar-cliente="' + c.id + '" title="Editar" aria-label="Editar ' + esc(c.nombre) + '">' + ICONOS.editar + "</button>" +
          '<button type="button" class="btn-icono btn-icono--peligro" data-eliminar-cliente="' + c.id + '" title="Eliminar" aria-label="Eliminar ' + esc(c.nombre) + '">' + ICONOS.eliminar + "</button>";
      } }
    ], clientes, { vacio: "No se encontraron clientes." });
  }
  function abrirCliente(id) {
    const f = $("#form-cliente");
    f.reset(); $("#cl-error").textContent = "";
    if (id) {
      const c = DB.obtenerCliente(id);
      $("#dcl-titulo").textContent = "Editar cliente";
      f.id.value = c.id; f.documento.value = c.documento; f.nombre.value = c.nombre; f.telefono.value = c.telefono;
      f.correo.value = c.correo; f.dias_credito.value = c.dias_credito; f.limite_credito.value = c.limite_credito;
    } else {
      $("#dcl-titulo").textContent = "Nuevo cliente"; f.id.value = "";
    }
    $("#dialogo-cliente").showModal();
  }
  function guardarCliente(e) {
    e.preventDefault();
    const f = e.target;
    try {
      DB.guardarCliente({ id: f.id.value ? Number(f.id.value) : null, documento: f.documento.value, nombre: f.nombre.value, telefono: f.telefono.value,
        correo: f.correo.value, dias_credito: f.dias_credito.value === "" ? 0 : Number(f.dias_credito.value), limite_credito: f.limite_credito.value === "" ? 0 : f.limite_credito.value });
      $("#dialogo-cliente").close();
      avisar(f.id.value ? "Cliente actualizado." : "Cliente creado.");
      refrescar();
    } catch (err) { $("#cl-error").textContent = err.message; }
  }
  async function eliminarCliente(id) {
    const c = DB.obtenerCliente(id);
    if (c.n_ventas > 0) { avisar("No se puede eliminar: " + c.nombre + " tiene " + c.n_ventas + " venta(s) registradas.", "error"); return; }
    if (!(await confirmar("¿Eliminar a " + c.nombre + "?", "Esta acción no se puede deshacer.", "Eliminar"))) return;
    DB.eliminarCliente(id); avisar("Cliente eliminado."); refrescar();
  }

  /* ---- Estado de cuenta ---- */
  function abrirCuenta(id) {
    const c = DB.obtenerCliente(id);
    const movs = DB.estadoCuenta(id);
    $("#dec-titulo").textContent = "Estado de cuenta";
    $("#dec-cuerpo").innerHTML =
      '<div class="cuenta-cabecera"><div><b>' + esc(c.nombre) + "</b><small class='sub'>" + esc(c.tipo_doc + " " + c.documento) + "</small></div>" +
      '<div class="cuenta-saldos"><span>Saldo <b>' + soles(c.deuda) + "</b></span>" + (c.vencido ? '<span class="texto-peligro">Vencido <b>' + soles(c.vencido) + "</b></span>" : "") + "</div></div>" +
      tabla([
        { titulo: "Fecha", html: function (m) { return fecha(m.fecha); } },
        { titulo: "Detalle", html: function (m) { return "<b>" + esc(m.tipo) + "</b><small class='sub'>" + esc(m.detalle) + "</small>"; } },
        { titulo: "Cargo", clase: "num", html: function (m) { return m.cargo ? soles(m.cargo) : ""; } },
        { titulo: "Abono", clase: "num", html: function (m) { return m.abono ? soles(m.abono) : ""; } },
        { titulo: "Saldo", clase: "num", html: function (m) { return "<b>" + soles(m.saldo) + "</b>"; } }
      ], movs.slice().reverse(), { vacio: "Este cliente aún no tiene movimientos.", clase: "tabla--ancha" }) +
      '<div class="dialogo__pie"><button type="button" class="btn btn--secundario btn--chico" data-exportar-cuenta="' + c.id + '">' + "Exportar a Excel</button>" +
      '<button type="button" class="btn btn--primario btn--chico" data-venta-cliente="' + c.id + '">Nueva venta</button></div>';
    $("#dialogo-cuenta").showModal();
  }
  function exportarCuenta(id) {
    const c = DB.obtenerCliente(id);
    const filas = [["ESTADO DE CUENTA"], ["Cliente:", c.nombre], [c.tipo_doc + ":", c.documento], ["Emitido:", fecha(DB.hoy())], [],
      ["Fecha", "Tipo", "Detalle", "Cargo", "Abono", "Saldo"]];
    DB.estadoCuenta(id).forEach(function (m) { filas.push([fecha(m.fecha), m.tipo, m.detalle, m.cargo || "", m.abono || "", m.saldo]); });
    filas.push([], ["", "", "SALDO PENDIENTE", "", "", c.deuda]);
    exportarExcel([{ nombre: "Estado de cuenta", filas: filas, anchos: [11, 8, 46, 12, 12, 12] }], "estado_cuenta_" + c.documento + "_" + DB.hoy() + ".xlsx");
  }

  /* ---- Recordatorio por WhatsApp ---- */
  function abrirRecordatorio(id) {
    const v = DB.obtenerVenta(id);
    const saludo = v.documento.length === 11 ? "Estimados " + v.cliente : "Hola " + v.cliente.split(" ")[0];
    const situacion = v.estado.clave === "vencida"
      ? "venció el " + fecha(v.vencimiento) + " (hace " + v.estado.dias + " días)"
      : (v.estado.dias === 0 ? "vence hoy" : "vence el " + fecha(v.vencimiento));
    const texto = saludo + ", le saludamos de " + EMPRESA + ".\n\n" +
      "Le recordamos que la " + (v.comprobante === "FACTURA" ? "factura " : "boleta ") + v.comprobante_numero + " por " + soles(v.total) +
      (v.cobrado > 0 ? " (saldo pendiente " + soles(v.saldo) + ")" : "") + " " + situacion + ".\n\n" +
      "¿Podría indicarnos la fecha estimada de pago? Si ya realizó el pago, por favor envíenos la constancia.\n\nMuchas gracias.";
    $("#dr-mensaje").value = texto;
    actualizarEnlaceWsp();
    $("#dialogo-recordatorio").showModal();
  }
  function actualizarEnlaceWsp() { $("#dr-enviar").href = "https://wa.me/?text=" + encodeURIComponent($("#dr-mensaje").value); }

  /* =================== Exportaciones =================== */
  function exportarVentas() {
    const ventas = DB.listarVentas(filtroVentas());
    const filas = [["Fecha", "Comprobante", "Tipo", "Cliente", "RUC/DNI", "Descripción", "Condición", "Vencimiento", "Valor venta", "IGV", "Total", "Cobrado", "Saldo", "Estado"]];
    ventas.forEach(function (v) {
      const base = DB.r2(v.total / 1.18);
      filas.push([fecha(v.fecha), v.comprobante_numero, v.comprobante === "FACTURA" ? "Factura" : "Boleta", v.cliente, v.documento, v.descripcion,
        v.condicion === "CREDITO" ? "Crédito" : "Contado", v.condicion === "CREDITO" ? fecha(v.vencimiento) : "", base, DB.r2(v.total - base), v.total, DB.r2(v.cobrado), v.saldo,
        v.estado.clave === "vencida" ? "Vencida (" + v.estado.dias + " d)" : v.estado.texto]);
    });
    exportarExcel([{ nombre: "Ventas", filas: filas, anchos: [11, 15, 8, 38, 13, 34, 9, 12, 12, 10, 11, 11, 11, 16] }], "registro_ventas_" + DB.hoy() + ".xlsx");
  }
  function exportarCobros() {
    const filas = [["Fecha", "Cliente", "Comprobante", "Medio", "N° operación", "Monto"]];
    DB.listarCobros(100000).forEach(function (c) { filas.push([fecha(c.fecha), c.cliente, c.comprobante_numero, c.medio, c.operacion, c.monto]); });
    exportarExcel([{ nombre: "Cobros", filas: filas, anchos: [11, 38, 15, 14, 13, 11] }], "cobros_" + DB.hoy() + ".xlsx");
  }

  /* =================== Eventos =================== */
  function enlazarEventos() {
    document.addEventListener("click", function (e) {
      const b = e.target.closest("[data-cerrar],[data-detalle],[data-cobrar],[data-recordar],[data-cuenta],[data-editar-cliente],[data-eliminar-cliente],[data-exportar-cuenta],[data-venta-cliente]");
      if (!b) return;
      const d = b.dataset;
      if (d.cerrar !== undefined) { b.closest("dialog").close(); return; }
      const abierto = document.querySelector("dialog[open]");
      if (d.detalle) abrirDetalle(Number(d.detalle));
      if (d.cobrar) { if (abierto) abierto.close(); estado.preCobro = Number(d.cobrar); navegar("cobranzas"); }
      if (d.recordar) abrirRecordatorio(Number(d.recordar));
      if (d.cuenta) abrirCuenta(Number(d.cuenta));
      if (d.editarCliente) abrirCliente(Number(d.editarCliente));
      if (d.eliminarCliente) eliminarCliente(Number(d.eliminarCliente));
      if (d.exportarCuenta) exportarCuenta(Number(d.exportarCuenta));
      if (d.ventaCliente) { if (abierto) abierto.close(); abrirVenta(Number(d.ventaCliente)); }
    });

    $("#btn-nueva-venta").addEventListener("click", function () { abrirVenta(null); });
    const fv = $("#form-venta");
    fv.addEventListener("submit", guardarVenta);
    fv.cliente_id.addEventListener("change", function () { actualizarFormVenta("cliente"); });
    fv.querySelectorAll("[name=condicion]").forEach(function (r) { r.addEventListener("change", function () { actualizarFormVenta("condicion"); }); });
    fv.comprobante.addEventListener("change", function () { actualizarFormVenta(); });
    fv.fecha.addEventListener("change", function () { actualizarFormVenta("fecha"); });
    fv.total.addEventListener("input", function () { actualizarFormVenta(); });

    let espera;
    $("#v-buscar").addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(pintarVentas, 180); });
    $("#v-estado").addEventListener("change", pintarVentas);
    $("#v-condicion").addEventListener("change", pintarVentas);
    $("#btn-exportar-ventas").addEventListener("click", exportarVentas);

    const fc = $("#form-cobro");
    fc.addEventListener("submit", guardarCobro);
    fc.venta_id.addEventListener("change", function () { $("#c-error").textContent = ""; actualizarCobro(true); });
    $("#btn-exportar-cobros").addEventListener("click", exportarCobros);

    $("#btn-exportar-antiguedad").addEventListener("click", exportarAntiguedad);

    $("#cl-buscar").addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(pintarClientes, 180); });
    $("#btn-nuevo-cliente").addEventListener("click", function () { abrirCliente(null); });
    $("#form-cliente").addEventListener("submit", guardarCliente);

    $("#dr-mensaje").addEventListener("input", actualizarEnlaceWsp);
    $("#dr-copiar").addEventListener("click", function () {
      navigator.clipboard.writeText($("#dr-mensaje").value).then(function () { avisar("Mensaje copiado."); }, function () { avisar("No se pudo copiar; selecciona el texto y cópialo.", "error"); });
    });

    $("#btn-descargar-db").addEventListener("click", function () { descargar(DB.exportarArchivo(), "ventas_demo_" + DB.hoy() + ".sqlite", "application/vnd.sqlite3"); });
    $("#btn-reiniciar").addEventListener("click", async function () {
      if (!(await confirmar("¿Restablecer la demo?", "Se borrarán tus cambios y se cargarán de nuevo los datos de ejemplo.", "Restablecer"))) return;
      await DB.reiniciar();
      $("#estado-guardado").textContent = "";
      avisar("Demo restablecida con los datos de ejemplo.");
      refrescar();
    });
  }

  iniciar();
})();
