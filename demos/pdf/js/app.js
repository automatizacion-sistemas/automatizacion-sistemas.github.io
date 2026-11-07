/* ==========================================================================
   app.js — Demo del generador de documentos PDF
   La interfaz prepara la plantilla y el Excel; python/generar_documentos.py
   (ejecutado con Pyodide en js/python-worker.mjs) valida los datos y crea los PDF.
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { esc, tabla, avisar, descargar } = window.UI;

  const ICO = { ver: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /> <circle cx="12" cy="12" r="3" /> </svg>', bajar: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M12 15V3" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="m7 10 5 5 5-5" /> </svg>', ok: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <circle cx="12" cy="12" r="10" /> <path d="m16 9-5.5 5.5L8 12" /> </svg>', listo: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M20 6 9 17l-5-5" /> </svg>', error: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" /> </svg>' };
  const TITULOS = { generar: "Generar documentos", codigo: "Código Python", proyecto: "Úsalo en tu empresa" };
  const EJEMPLOS = { constancia_trabajo: "trabajadores.xlsx", carta_cobranza: "deudas.xlsx" };
  const MAX_BYTES = 5 * 1024 * 1024;
  const estado = {
    vista: "generar", tipo: "constancia_trabajo", originales: {}, editadas: {}, excel: null, propio: {},
    worker: null, listo: false, secuencia: 0, analisis: null, ocupado: false, urls: [], archivos: {}, codigoCargado: false
  };

  /* =================== Navegación =================== */
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "generar"; }
  function irA(vista) {
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) { a.classList.toggle("activo", a.dataset.vista === vista); a.toggleAttribute("aria-current", a.dataset.vista === vista); });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo del generador de PDF";
    if (vista === "codigo") cargarCodigo();
    window.scrollTo(0, 0);
  }

  /* =================== Python (worker) =================== */
  function pastilla(texto, clase) {
    const p = $("#pastilla-python");
    p.className = "pastilla-python" + (clase ? " pastilla-python--" + clase : "");
    p.querySelector("span").textContent = texto;
    if (clase === "listo") p.firstElementChild.outerHTML = ICO.listo;
    if (clase === "error") p.firstElementChild.outerHTML = ICO.error;
  }
  function iniciarPython() {
    if (typeof Worker === "undefined" || typeof WebAssembly === "undefined") {
      pastilla("Sin soporte de Python", "error");
      $("#tabla-datos").innerHTML = '<p class="vacio">Este navegador no permite ejecutar Python. Usa una versión reciente de Chrome, Edge, Firefox o Safari, o descarga el proyecto.</p>';
      return;
    }
    const w = new Worker("js/python-worker.mjs", { type: "module" });
    w.onmessage = function (e) {
      const m = e.data;
      if (m.tipo === "estado") pastilla(m.texto.replace(" en tu navegador", "").replace("…", "") + "…");
      if (m.tipo === "listo-python") { estado.listo = true; pastilla("Python listo", "listo"); $("#pastilla-python").title = m.texto; consola(m.texto); }
      if (m.tipo === "log") consola(m.texto);
      if (m.tipo === "analisis" && m.id === estado.secuencia) { estado.analisis = m.datos; pintarAnalisis(); }
      if (m.tipo === "documentos") recibirDocumentos(m);
      if (m.tipo === "error") {
        if (estado.ocupado) { ocupado(false); $("#estado-generar").textContent = m.texto; consola(m.texto, "error"); }
        else if (m.id === estado.secuencia) $("#error-datos").textContent = m.texto;
        avisar(m.texto, "error");
      }
    };
    w.onerror = function (e) { console.error(e); pastilla("Python no pudo iniciar", "error"); estado.worker = null; };
    estado.worker = w;
    w.postMessage({ tipo: "cargar" });
  }

  /* =================== Plantilla y datos =================== */
  async function cargarTipo(tipo) {
    estado.tipo = tipo;
    try {
      if (!estado.originales[tipo]) estado.originales[tipo] = await (await fetch("python/plantillas/" + tipo + ".txt")).text();
      $("#plantilla").value = estado.editadas[tipo] !== undefined ? estado.editadas[tipo] : estado.originales[tipo];
      if (estado.propio[tipo]) estado.excel = estado.propio[tipo];
      else {
        const nombre = EJEMPLOS[tipo];
        estado.excel = { nombre: nombre, bytes: await (await fetch("python/datos/" + nombre)).arrayBuffer(), propio: false };
      }
    } catch (e) {
      $("#error-datos").textContent = "No se pudieron cargar los archivos de ejemplo.";
      return;
    }
    pintarArchivoActual();
    $("#resultado").hidden = true;
    analizar();
  }
  function pintarArchivoActual() {
    const ej = EJEMPLOS[estado.tipo];
    $("#archivo-actual").innerHTML = '<span class="archivo__icono"><svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /> <path d="M14 2v5a1 1 0 0 0 1 1h5" /> <path d="M8 13h2" /> <path d="M14 13h2" /> <path d="M8 17h2" /> <path d="M14 17h2" /> </svg></span><span><b>' + esc(estado.excel.nombre) + "</b><small>" + (estado.excel.propio ? 'Tu archivo · <button type="button" class="enlace-tabla" id="volver-ejemplo">volver al ejemplo</button>' : "Excel de ejemplo (datos ficticios)") + "</small></span>";
    $("#descargar-ejemplo").href = "python/datos/" + ej;
    $("#descargar-ejemplo").setAttribute("download", ej);
  }
  let espera;
  function analizar(conEspera) {
    clearTimeout(espera);
    const correr = function () {
      if (!estado.worker || !estado.excel) return;
      estado.secuencia++;
      $("#error-datos").textContent = "";
      estado.worker.postMessage({ tipo: "analizar", id: estado.secuencia, plantilla: $("#plantilla").value, nombrePlantilla: estado.tipo, excel: { nombre: estado.excel.nombre, bytes: estado.excel.bytes.slice(0) } });
    };
    if (conEspera) espera = setTimeout(correr, 500); else correr();
  }
  function pintarAnalisis() {
    const a = estado.analisis;
    $("#error-plantilla").textContent = a.error_plantilla || (a.faltan && a.faltan.length ? "La plantilla usa columnas que no están en el Excel: " + a.faltan.join(", ") + "." : "");
    if (!a.ok) {
      $("#error-datos").textContent = a.error;
      $("#tabla-datos").innerHTML = ""; $("#columnas").innerHTML = ""; $("#resumen-datos").textContent = "";
      $("#btn-generar").disabled = true;
      return;
    }
    const usados = new Set(a.campos || []);
    $("#columnas").innerHTML = a.columnas.map(function (c) { return '<button type="button" class="columna-chip' + (usados.has(c) ? " columna-chip--usada" : "") + '" data-insertar="' + esc(c) + '" title="Insertar {' + esc(c) + '} en la plantilla">{' + esc(c) + "}</button>"; }).join("") +
      (a.faltan || []).map(function (c) { return '<span class="columna-chip columna-chip--falta" title="La plantilla la usa, pero no existe en el Excel">{' + esc(c) + "} no existe</span>"; }).join("");
    const listas = a.filas.filter(function (f) { return !f.errores.length; }).length;
    const n = a.filas.length, conError = n - listas;
    $("#resumen-datos").textContent = n + (n === 1 ? " fila · " : " filas · ") + listas + (listas === 1 ? " lista · " : " listas · ") + conError + " con errores";
    // Se muestran las 2 primeras columnas para que la tabla se lea bien (la plantilla usa todas)
    const cols = a.columnas.slice(0, 2);
    $("#tabla-datos").innerHTML = tabla([
      { titulo: "Fila", clase: "num", campo: "fila" }
    ].concat(cols.map(function (c, i) { return { titulo: c, clase: i === 0 ? "celda-titular" : "", html: function (f) { return esc(f.valores[i]) || '<span class="sub">—</span>'; } }; })).concat([
      { titulo: "Estado", html: function (f) { return f.errores.length ? '<span class="chip-obs chip-obs--excluida" title="' + esc(f.errores.join("; ")) + '">Con errores</span><small class="sub">' + esc(f.errores.join("; ")) + "</small>" : '<span class="chip-obs chip-obs--ok">Lista</span>'; } }
    ]), a.filas, { clase: "tabla--datos", claseFila: function (f) { return f.errores.length ? "fila-error" : ""; } });
    // La tabla se desplaza dentro de su recuadro: debe poder recorrerse con el teclado
    const env = $("#tabla-datos .tabla-envoltura");
    if (env) { env.tabIndex = 0; env.setAttribute("role", "region"); env.setAttribute("aria-label", "Filas del Excel (se desplaza)"); }
    const bloqueado = !!(a.error_plantilla || (a.faltan && a.faltan.length) || !listas);
    $("#btn-generar").disabled = bloqueado || estado.ocupado;
    $("#estado-generar").textContent = bloqueado ? (listas ? "Corrige la plantilla para poder generar." : "No hay filas sin errores para generar.") :
      "Se generarán " + listas + " PDF" + (a.filas.length - listas ? " (las " + (a.filas.length - listas) + " filas con errores se omiten y quedan en el registro)" : "") + ", un PDF con todos juntos y el registro en Excel.";
  }
  function insertarCampo(campo) {
    const t = $("#plantilla"), ini = t.selectionStart, fin = t.selectionEnd, texto = "{" + campo + "}";
    t.value = t.value.slice(0, ini) + texto + t.value.slice(fin);
    t.focus(); t.selectionStart = t.selectionEnd = ini + texto.length;
    estado.editadas[estado.tipo] = t.value;
    analizar(true);
  }

  /* =================== Generar =================== */
  function consola(texto, clase) {
    const c = $("#consola"), l = document.createElement("div");
    l.className = "consola__linea" + (clase ? " consola__linea--" + clase : /^\s*✓/.test(texto) ? " consola__linea--ok" : /^\s*✗/.test(texto) ? " consola__linea--mal" : /^\$/.test(texto) ? " consola__linea--comando" : /^Listo/.test(texto) ? " consola__linea--listo" : "");
    l.textContent = texto; c.appendChild(l); c.scrollTop = c.scrollHeight;
  }
  function ocupado(si) {
    estado.ocupado = si;
    $("#btn-generar").classList.toggle("cargando", si);
    $("#btn-generar").disabled = si || !estado.analisis || !estado.analisis.ok;
  }
  function generar() {
    if (estado.ocupado || !estado.worker) return;
    ocupado(true);
    $("#estado-generar").textContent = estado.listo ? "Generando los PDF…" : "Esperando a que Python termine de cargar…";
    estado.worker.postMessage({ tipo: "generar", id: ++estado.secuencia, plantilla: $("#plantilla").value, nombrePlantilla: estado.tipo, excel: { nombre: estado.excel.nombre, bytes: estado.excel.bytes.slice(0) } });
  }
  function recibirDocumentos(m) {
    ocupado(false);
    estado.urls.forEach(URL.revokeObjectURL);
    estado.urls = []; estado.archivos = {};
    m.archivos.forEach(function (a) {
      const tipo = /\.pdf$/.test(a.nombre) ? "application/pdf" : /\.zip$/.test(a.nombre) ? "application/zip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([a.bytes], { type: tipo }), url = URL.createObjectURL(blob);
      estado.urls.push(url); estado.archivos[a.nombre] = { blob: blob, url: url };
    });
    const r = m.resumen, docs = r.resultados.filter(function (x) { return !x.error; }), errores = r.resultados.filter(function (x) { return x.error; });
    estado.zip = r.zip ? r.zip.split("/").pop() : null;
    $("#resultado").hidden = false;
    $("#resultado-sub").textContent = docs.length + " PDF generados en " + String(r.segundos).replace(".", ",") + " s" + (errores.length ? " · " + errores.length + " fila(s) omitidas por errores" : "");
    $("#estado-generar").textContent = "Listo: " + docs.length + " documento(s). Puedes editar la plantilla o los datos y volver a generar.";
    $("#tabla-documentos").innerHTML = tabla([
      { titulo: "Archivo", clase: "celda-titular", html: function (d) { return "<b>" + esc(d.archivo) + "</b><small class='sub'>" + esc(d.resumen) + "</small>"; } },
      { titulo: "Código de verificación", html: function (d) { return "<code>" + esc(d.codigo) + "</code>"; } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (d) {
        return '<button type="button" class="btn-icono" data-ver="' + esc(d.archivo) + '" title="Ver" aria-label="Ver ' + esc(d.archivo) + '">' + ICO.ver + "</button>" +
          '<button type="button" class="btn-icono" data-bajar="' + esc(d.archivo) + '" title="Descargar" aria-label="Descargar ' + esc(d.archivo) + '">' + ICO.bajar + "</button>"; } }
    ], docs, { vacio: "No se generó ningún documento." });
    $("#lista-errores").innerHTML = errores.length ? '<div class="errores-generacion"><h3>' + ICO.error + " Filas omitidas</h3><ul>" + errores.map(function (x) { return "<li><b>Fila " + x.fila + ":</b> " + esc(x.error) + "</li>"; }).join("") + "</ul></div>" : "";
    if (docs.length) ver(docs[0].archivo);
    $("#resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function ver(nombre) {
    const a = estado.archivos[nombre];
    if (!a) return;
    $("#previa").src = a.url + "#view=FitH";
    $("#abrir-pdf").href = a.url;
    $("#nombre-previa").textContent = nombre;
    $$("[data-ver]").forEach(function (b) { b.closest("tr").classList.toggle("fila-activa", b.dataset.ver === nombre); });
  }
  function bajar(nombre) { const a = estado.archivos[nombre]; if (a) descargar(a.blob, nombre); }

  /* =================== Código =================== */
  const PALABRAS = /^(def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|try|except|raise|with|lambda|None|True|False|is|continue|break|pass|yield|global)$/;
  function resaltar(codigo) {
    const re = /("""[\s\S]*?"""|'''[\s\S]*?''')|(#[^\n]*)|([rfb]?"(?:\\.|[^"\\\n])*"|[rfb]?'(?:\\.|[^'\\\n])*')|(@\w+)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
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
    if (estado.codigoCargado) return;
    try {
      const texto = await (await fetch("python/generar_documentos.py")).text();
      $("#codigo").innerHTML = "<code>" + resaltar(texto) + "</code>";
      $("#codigo-lineas").textContent = texto.split("\n").length + " líneas · Python 3";
      estado.codigoCargado = true;
    } catch (e) { $("#codigo").textContent = "No se pudo cargar el código."; }
  }

  /* =================== Eventos =================== */
  $$("[name=tipo]").forEach(function (r) { r.addEventListener("change", function () { if (r.checked) cargarTipo(r.value); }); });
  $("#plantilla").addEventListener("input", function () { estado.editadas[estado.tipo] = $("#plantilla").value; analizar(true); });
  $("#btn-restaurar").addEventListener("click", function () {
    delete estado.editadas[estado.tipo];
    $("#plantilla").value = estado.originales[estado.tipo] || "";
    analizar(); avisar("Plantilla original restaurada.");
  });
  $("#mi-excel").addEventListener("change", function (e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    $("#error-datos").textContent = "";
    if (!/\.xlsx$/i.test(f.name)) { $("#error-datos").textContent = "«" + f.name + "» no es un archivo .xlsx."; return; }
    if (f.size > MAX_BYTES) { $("#error-datos").textContent = "El archivo supera 5 MB."; return; }
    f.arrayBuffer().then(function (b) {
      estado.excel = estado.propio[estado.tipo] = { nombre: f.name, bytes: b, propio: true };
      pintarArchivoActual(); $("#resultado").hidden = true; analizar();
    });
  });
  document.addEventListener("click", function (e) {
    const b = e.target.closest("[data-insertar],[data-ver],[data-bajar],#volver-ejemplo");
    if (!b) return;
    if (b.dataset.insertar) insertarCampo(b.dataset.insertar);
    if (b.dataset.ver) ver(b.dataset.ver);
    if (b.dataset.bajar) bajar(b.dataset.bajar);
    if (b.id === "volver-ejemplo") { delete estado.propio[estado.tipo]; cargarTipo(estado.tipo); }
  });
  $("#btn-generar").addEventListener("click", generar);
  $("#btn-zip").addEventListener("click", function () { if (estado.zip) bajar(estado.zip); });
  $("#btn-combinado").addEventListener("click", function () { bajar("todos_los_documentos.pdf"); });
  $("#btn-registro").addEventListener("click", function () { bajar("registro_documentos.xlsx"); });
  window.addEventListener("hashchange", function () { irA(leerHash()); });

  irA(leerHash());
  iniciarPython();
  cargarTipo(estado.tipo);
})();
