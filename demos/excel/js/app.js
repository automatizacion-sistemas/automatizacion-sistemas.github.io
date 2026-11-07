/* ==========================================================================
   app.js — Demo de automatización de Excel con Python
   La interfaz prepara los archivos y muestra el resultado; el trabajo lo hace
   python/consolidar.py, que se ejecuta con Pyodide en js/python-worker.mjs.
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, num, esc, tabla, avisar, descargar } = window.UI;

  const ICO_ARCHIVO = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M8 13h2" /> <path d="M14 13h2" /> <path d="M8 17h2" /> <path d="M14 17h2" /> </svg>', ICO_DESCARGA = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M12 15V3" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="m7 10 5 5 5-5" /> </svg>', ICO_QUITAR = '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M18 6 6 18" /> <path d="m6 6 12 12" /> </svg>';
  const TITULOS = { consolidar: "Consolidar", codigo: "Código Python", proyecto: "Úsalo en tu empresa" };
  const EJEMPLOS = [
    { nombre: "ventas_lima_centro_2026-10.xlsx", problema: "Ordenado y limpio: el caso ideal." },
    { nombre: "ventas_arequipa_octubre.xlsx", problema: "Título arriba, encabezados en la fila 4, fila de TOTAL y un importe mal digitado." },
    { nombre: "Ventas Trujillo oct-2026.xlsx", problema: "Otros nombres de columna, fechas y precios como texto, productos en MAYÚSCULAS." },
    { nombre: "ventas_piura_2026-10.xlsx", problema: "Una devolución negativa, una fecha vacía, un precio «consultar» y dos ventas de setiembre." },
    { nombre: "ventas_cusco_2026-10.xlsx", problema: "Columnas en otro orden, filas vacías y 3 líneas copiadas dos veces." },
    { nombre: "ventas_chiclayo_2026-10.xlsx", problema: "Los datos están en la segunda hoja y no hay columna de cliente." },
    { nombre: "notas_reunion.xlsx", problema: "No es un reporte de ventas: debe omitirse." }
  ];
  const TIPOS = { Excluida: "excluida", Corregida: "corregida", Unificada: "unificada", Omitida: "omitida" };
  const MAX_BYTES = 5 * 1024 * 1024;
  const estado = { vista: "consolidar", seleccion: new Set(EJEMPLOS.map(function (e) { return e.nombre; })), propios: [], worker: null, ocupado: false, resultado: null, excel: null };

  /* =================== Navegación =================== */
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "consolidar"; }
  function irA(vista) {
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) { a.classList.toggle("activo", a.dataset.vista === vista); a.toggleAttribute("aria-current", a.dataset.vista === vista); });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de Excel con Python";
    if (vista === "codigo") cargarCodigo();
    window.scrollTo(0, 0);
  }

  /* =================== Archivos de entrada =================== */
  function pintarArchivos() {
    const ejemplos = EJEMPLOS.map(function (e) {
      const id = "ej-" + e.nombre.replace(/[^a-z0-9]/gi, "");
      return '<li class="archivo"><input type="checkbox" id="' + id + '" data-ejemplo="' + esc(e.nombre) + '"' + (estado.seleccion.has(e.nombre) ? " checked" : "") + ">" +
        '<label for="' + id + '"><span class="archivo__icono">' + ICO_ARCHIVO + "</span><span><b>" + esc(e.nombre) + "</b><small>" + esc(e.problema) + "</small></span></label>" +
        '<a class="btn-icono" href="ejemplos/' + encodeURIComponent(e.nombre) + '" download title="Descargar para verlo en Excel" aria-label="Descargar ' + esc(e.nombre) + '">' + ICO_DESCARGA + "</a></li>";
    }).join("");
    const propios = estado.propios.map(function (p, i) {
      return '<li class="archivo archivo--propio"><span class="archivo__marca" aria-hidden="true"></span><span class="archivo__etiqueta"><span class="archivo__icono">' + ICO_ARCHIVO + "</span><span><b>" + esc(p.nombre) + "</b><small>Tu archivo · " + num(Math.round(p.bytes.byteLength / 1024)) + " KB</small></span></span>" +
        '<button type="button" class="btn-icono btn-icono--peligro" data-quitar="' + i + '" title="Quitar" aria-label="Quitar ' + esc(p.nombre) + '">' + ICO_QUITAR + "</button></li>";
    }).join("");
    $("#lista-archivos").innerHTML = ejemplos + propios;
    actualizarConteo();
  }
  // Al marcar o desmarcar no se redibuja la lista, para no perder el foco del teclado
  function actualizarConteo() {
    const n = estado.seleccion.size + estado.propios.length;
    $("#n-seleccionados").textContent = n + " archivo(s) seleccionado(s)";
    $("#btn-ejecutar").disabled = !n || estado.ocupado;
  }
  function agregarPropios(lista) {
    $("#error-archivos").textContent = "";
    const errores = [];
    let pendientes = lista.length;
    Array.from(lista).forEach(function (f) {
      const fin = function () { if (--pendientes === 0) { pintarArchivos(); if (errores.length) $("#error-archivos").textContent = errores.join(" "); } };
      if (!/\.xlsx$/i.test(f.name)) { errores.push("«" + f.name + "» no es un archivo .xlsx."); return fin(); }
      if (f.size > MAX_BYTES) { errores.push("«" + f.name + "» supera 5 MB."); return fin(); }
      if (estado.propios.concat(EJEMPLOS).some(function (p) { return p.nombre === f.name; })) { errores.push("Ya hay un archivo llamado «" + f.name + "»."); return fin(); }
      f.arrayBuffer().then(function (b) { estado.propios.push({ nombre: f.name, bytes: b }); fin(); }, function () { errores.push("No se pudo leer «" + f.name + "»."); fin(); });
    });
  }

  /* =================== Ejecución =================== */
  function consola(texto, clase) {
    const c = $("#consola");
    const vacia = c.querySelector(".consola__vacia");
    if (vacia) vacia.remove();
    const linea = document.createElement("div");
    linea.className = "consola__linea" + (clase ? " consola__linea--" + clase : "") + (/^\s*✓/.test(texto) ? " consola__linea--ok" : /^\s*✗/.test(texto) ? " consola__linea--mal" : /^\$/.test(texto) ? " consola__linea--comando" : /^Listo/.test(texto) ? " consola__linea--listo" : "");
    linea.textContent = texto;
    c.appendChild(linea);
    c.scrollTop = c.scrollHeight;
  }
  function ocupado(si, texto) {
    estado.ocupado = si;
    $("#btn-ejecutar").disabled = si || !(estado.seleccion.size + estado.propios.length);
    $("#btn-ejecutar").classList.toggle("cargando", si);
    if (texto !== undefined) $("#estado-python").textContent = texto;
  }
  function obtenerWorker() {
    if (estado.worker) return estado.worker;
    const w = new Worker("js/python-worker.mjs", { type: "module" });
    w.onmessage = function (e) {
      const m = e.data;
      if (m.tipo === "estado") $("#estado-python").textContent = m.texto;
      if (m.tipo === "log") consola(m.texto);
      if (m.tipo === "error") { consola(m.texto, "error"); ocupado(false, "No se pudo completar la consolidación."); avisar(m.texto, "error"); }
      if (m.tipo === "listo") {
        estado.resultado = m.resumen;
        estado.excel = { bytes: m.excel, nombre: m.nombre };
        ocupado(false, "Listo en " + String(m.resumen.segundos).replace(".", ",") + " s. Python sigue cargado: puedes cambiar los archivos y volver a ejecutar.");
        pintarResultado();
      }
    };
    w.onerror = function (e) {
      console.error(e);
      ocupado(false, "Este navegador no pudo iniciar Python. Prueba con una versión reciente de Chrome, Edge, Firefox o Safari.");
      consola("Error al iniciar Python en este navegador.", "error");
      estado.worker = null;
    };
    estado.worker = w;
    return w;
  }
  async function ejecutar() {
    if (estado.ocupado) return;
    ocupado(true, "Preparando los archivos…");
    $("#resultado").hidden = true;
    $("#consola").innerHTML = "";
    try {
      const ejemplos = await Promise.all(EJEMPLOS.filter(function (e) { return estado.seleccion.has(e.nombre); }).map(async function (e) {
        const r = await fetch("ejemplos/" + encodeURIComponent(e.nombre));
        if (!r.ok) throw new Error("No se pudo descargar " + e.nombre);
        return { nombre: e.nombre, bytes: await r.arrayBuffer() };
      }));
      const archivos = ejemplos.concat(estado.propios.map(function (p) { return { nombre: p.nombre, bytes: p.bytes.slice(0) }; }));
      obtenerWorker().postMessage({ tipo: "ejecutar", archivos: archivos });
    } catch (err) {
      ocupado(false, err.message); consola(err.message, "error");
    }
  }

  /* =================== Resultado =================== */
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" + (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function pintarResultado() {
    const r = estado.resultado, c = r.conteo_observaciones || {};
    const procesados = r.archivos.filter(function (a) { return a.estado === "Procesado"; }).length;
    $("#resultado").hidden = false;
    $("#resultado-sub").textContent = "Período: " + r.periodo_texto + " · " + num(r.lineas) + " líneas de venta de " + procesados + " archivo(s) · procesado en " + String(r.segundos).replace(".", ",") + " s";
    $("#nombre-salida").textContent = "Descargar " + estado.excel.nombre;
    $("#kpis").innerHTML =
      kpi("Venta total", soles(r.venta_total), r.periodo_texto) +
      kpi("Comprobantes", num(r.comprobantes), num(r.unidades) + " unidades") +
      kpi("Ticket promedio", soles(r.ticket_promedio), "por comprobante") +
      kpi("Archivos", procesados + " de " + r.archivos.length, procesados < r.archivos.length ? (r.archivos.length - procesados) + " omitido(s)" : "todos procesados") +
      kpi("Filas excluidas", num(c.Excluida || 0), (c.Corregida || 0) + " corregida(s) · " + (c.Unificada || 0) + " nombre(s) unificado(s)", c.Excluida ? "alerta" : "");
    $("#tabla-sucursales").innerHTML = tabla([
      { titulo: "Sucursal", clase: "celda-titular", html: function (s) { return "<b>" + esc(s.sucursal) + "</b>"; } },
      { titulo: "Comprobantes", clase: "num", html: function (s) { return num(s.comprobantes); } },
      { titulo: "Venta", clase: "num", html: function (s) { return "<b>" + soles(s.venta) + "</b>"; } },
      { titulo: "Participación", html: function (s) { return '<span class="barra-part"><span style="width:' + s.participacion + '%"></span></span><small>' + String(s.participacion).replace(".", ",") + " %</small>"; } }
    ], r.por_sucursal);
    $("#tabla-productos").innerHTML = tabla([
      { titulo: "Producto", clase: "celda-titular", html: function (p) { return "<b>" + esc(p.producto) + "</b>"; } },
      { titulo: "Unidades", clase: "num", html: function (p) { return num(p.unidades); } },
      { titulo: "Venta", clase: "num", html: function (p) { return soles(p.venta); } },
      { titulo: "%", clase: "num", html: function (p) { return String(p.participacion).replace(".", ",") + " %"; } }
    ], r.por_producto.slice(0, 6));
    $("#filtro-obs").innerHTML = '<option value="">Todas (' + r.observaciones.length + ")</option>" + Object.keys(TIPOS).filter(function (t) { return c[t]; }).map(function (t) { return '<option value="' + t + '">' + t + "s (" + c[t] + ")</option>"; }).join("");
    pintarObservaciones();
    $("#tabla-archivos").innerHTML = tabla([
      { titulo: "Archivo", clase: "celda-titular", html: function (a) { return "<b>" + esc(a.archivo) + "</b><small class='sub'>" + esc(a.sucursal || "—") + "</small>"; } },
      { titulo: "Estado", html: function (a) { return '<span class="chip-obs chip-obs--' + (a.estado === "Procesado" ? "ok" : "excluida") + '">' + esc(a.estado) + "</span>"; } },
      { titulo: "Hoja", html: function (a) { return esc(a.hoja || "—"); } },
      { titulo: "Encabezados", html: function (a) { return a.fila_encabezado ? "Fila " + a.fila_encabezado : "—"; } },
      { titulo: "Válidas", clase: "num", campo: "validas" },
      { titulo: "Excluidas", clase: "num", html: function (a) { return a.excluidas ? '<b class="texto-peligro">' + a.excluidas + "</b>" : "0"; } }
    ], r.archivos);
    $("#resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function pintarObservaciones() {
    const f = $("#filtro-obs").value;
    const lista = estado.resultado.observaciones.filter(function (o) { return !f || o.tipo === f; });
    $("#tabla-observaciones").innerHTML = tabla([
      { titulo: "Tipo", html: function (o) { return '<span class="chip-obs chip-obs--' + TIPOS[o.tipo] + '">' + esc(o.tipo) + "</span>"; } },
      { titulo: "Archivo", html: function (o) { return esc(o.archivo) + (o.fila ? "<small class='sub'>fila " + o.fila + "</small>" : ""); } },
      { titulo: "Detalle", clase: "celda-titular celda-detalle", html: function (o) { return esc(o.detalle); } }
    ], lista, { vacio: "No hay observaciones de este tipo." });
  }

  /* =================== Código =================== */
  let codigoCargado = false;
  const PALABRAS = /^(def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|try|except|raise|with|lambda|None|True|False|is|continue|break|pass|yield|global)$/;
  function resaltar(codigo) {
    const re = /("""[\s\S]*?"""|'''[\s\S]*?''')|(#[^\n]*)|([rf]?"(?:\\.|[^"\\\n])*"|[rf]?'(?:\\.|[^'\\\n])*')|(@\w+)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
    let salida = "", ultimo = 0, m;
    while ((m = re.exec(codigo))) {
      salida += esc(codigo.slice(ultimo, m.index));
      const t = esc(m[0]);
      if (m[1]) salida += '<span class="py-doc">' + t + "</span>";
      else if (m[2]) salida += '<span class="py-com">' + t + "</span>";
      else if (m[3]) salida += '<span class="py-str">' + t + "</span>";
      else if (m[4]) salida += '<span class="py-dec">' + t + "</span>";
      else if (m[5]) salida += '<span class="py-num">' + t + "</span>";
      else if (PALABRAS.test(m[6])) salida += '<span class="py-kw">' + t + "</span>";
      else if (codigo[re.lastIndex] === "(" && /^[a-z_]/.test(m[6])) salida += '<span class="py-fn">' + t + "</span>";
      else salida += t;
      ultimo = re.lastIndex;
    }
    return salida + esc(codigo.slice(ultimo));
  }
  async function cargarCodigo() {
    if (codigoCargado) return;
    try {
      const texto = await (await fetch("python/consolidar.py")).text();
      $("#codigo").innerHTML = "<code>" + resaltar(texto) + "</code>";
      $("#codigo-lineas").textContent = texto.split("\n").length + " líneas · Python 3";
      codigoCargado = true;
    } catch (e) { $("#codigo").textContent = "No se pudo cargar el código."; }
  }

  /* =================== Eventos =================== */
  document.addEventListener("change", function (e) {
    const t = e.target;
    if (t.dataset.ejemplo) { if (t.checked) estado.seleccion.add(t.dataset.ejemplo); else estado.seleccion.delete(t.dataset.ejemplo); actualizarConteo(); }
  });
  document.addEventListener("click", function (e) {
    const b = e.target.closest("[data-quitar]");
    if (b) { estado.propios.splice(Number(b.dataset.quitar), 1); pintarArchivos(); }
  });
  $("#mis-archivos").addEventListener("change", function (e) { if (e.target.files.length) agregarPropios(e.target.files); e.target.value = ""; });
  $("#btn-ejecutar").addEventListener("click", ejecutar);
  $("#filtro-obs").addEventListener("change", pintarObservaciones);
  $("#btn-descargar").addEventListener("click", function () {
    if (estado.excel) descargar(new Blob([estado.excel.bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), estado.excel.nombre);
  });
  window.addEventListener("hashchange", function () { irA(leerHash()); });

  pintarArchivos();
  irA(leerHash());
  if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
    $("#btn-ejecutar").disabled = true;
    $("#estado-python").textContent = "Este navegador no permite ejecutar Python. Usa una versión reciente de Chrome, Edge, Firefox o Safari, o descarga el proyecto para ejecutarlo en tu computadora.";
  }
})();
