/* ==========================================================================
   app.js — Pantallas del control de ingresos y gastos
   Vistas: resumen · movimientos · resultados · presupuesto · importar
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, num, fecha, esc, tabla, avisar, confirmar, descargar, exportarExcel, ICONOS } = window.UI;

  const ICO_CUENTA = ['<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <rect width="20" height="12" x="2" y="6" rx="2" /> <circle cx="12" cy="12" r="2" /> <path d="M6 12h.01M18 12h.01" /> </svg>', '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M10 18v-7" /> <path d="M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" /> <path d="M14 18v-7" /> <path d="M18 18v-7" /> <path d="M3 22h18" /> <path d="M6 18v-7" /> </svg>', '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /> <path d="M12 18h.01" /> </svg>'];
  const TITULOS = { resumen: "Resumen", movimientos: "Movimientos", resultados: "Estado de resultados", presupuesto: "Presupuesto", importar: "Importar extracto" };
  const TIPO_TXT = { INGRESO: "Ingreso", GASTO: "Gasto", RETIRO: "Retiro personal", TRANSFERENCIA: "Transferencia" };
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];
  const estado = { vista: "resumen", importacion: null };

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
  function leerHash() { const h = location.hash.replace("#", ""); return TITULOS[h] ? h : "resumen"; }
  function irA(vista) {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); });
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("a[data-vista]").forEach(function (a) { a.classList.toggle("activo", a.dataset.vista === vista); a.toggleAttribute("aria-current", a.dataset.vista === vista); });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de ingresos y gastos";
    pintar();
    window.scrollTo(0, 0);
  }
  function pintar() { ({ resumen: pintarResumen, movimientos: pintarMovimientos, resultados: pintarResultados, presupuesto: pintarPresupuesto, importar: pintarImportar })[estado.vista](); }

  function nombreMes(clave) { const [a, m] = clave.split("-"); return MESES_L[Number(m) - 1] + " " + a; }
  function llenarSelectores() {
    const meses = DB.mesesHasta(13).reverse();
    const ops = meses.map(function (m, i) { return '<option value="' + m.clave + '">' + nombreMes(m.clave).replace(/^./, function (c) { return c.toUpperCase(); }) + (i === 0 ? " (en curso)" : "") + "</option>"; }).join("");
    $("#r-mes").innerHTML = ops;
    $("#m-mes").innerHTML = '<option value="">Todos los meses</option>' + ops;
    const cuentas = DB.cuentas().map(function (c) { return '<option value="' + c.id + '">' + esc(c.nombre) + "</option>"; }).join("");
    $("#m-cuenta").innerHTML = '<option value="">Todas las cuentas</option>' + cuentas;
    $("#i-cuenta").innerHTML = cuentas; $("#i-cuenta").value = "2";
  }

  /* =================== Piezas =================== */
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" +
      (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function montoFirmado(m) {
    if (m.tipo === "INGRESO") return '<b class="monto monto--entra">+' + soles(m.monto) + "</b>";
    if (m.tipo === "TRANSFERENCIA") return '<span class="monto monto--neutro">' + soles(m.monto) + "</span>";
    return '<b class="monto monto--sale">−' + soles(m.monto) + "</b>";
  }
  function chipTipo(t) { return '<span class="chip-fin chip-fin--' + t.toLowerCase() + '">' + TIPO_TXT[t] + "</span>"; }
  function variacion(actual, anterior) {
    if (!anterior) return "";
    const v = Math.round((actual - anterior) / anterior * 100);
    return (v >= 0 ? "+" : "") + v + " %";
  }

  /* =================== Resumen =================== */
  function pintarResumen() {
    const clave = $("#r-mes").value, meses = DB.mesesHasta(13).map(function (m) { return m.clave; });
    const enCurso = clave === DB.hoy().slice(0, 7);
    // El mes en curso se compara con los mismos días del mes anterior
    const i = meses.indexOf(clave), t = DB.totalesMes(clave), ant = i > 0 ? DB.totalesMes(meses[i - 1], enCurso ? Number(DB.hoy().slice(8)) : null) : null;
    const cuentas = DB.cuentas(), total = cuentas.reduce(function (s, c) { return s + c.saldo; }, 0);
    const comparado = enCurso ? " vs. los mismos días del mes anterior" : " vs. mes anterior";
    $("#kpis").innerHTML =
      kpi("Ingresos", soles(t.INGRESO), ant && ant.INGRESO ? variacion(t.INGRESO, ant.INGRESO) + comparado : "") +
      kpi("Gastos del negocio", soles(t.GASTO), ant && ant.GASTO ? variacion(t.GASTO, ant.GASTO) + comparado : "") +
      kpi("Utilidad del negocio", soles(t.utilidad), "margen " + String(t.margen).replace(".", ",") + " %", t.utilidad < 0 ? "peligro" : "") +
      kpi("Retiros personales", soles(t.RETIRO), t.utilidad > 0 ? Math.round(t.RETIRO / t.utilidad * 100) + " % de la utilidad" : "", t.RETIRO > t.utilidad ? "alerta" : "");

    // El mensaje que un emprendedor necesita leer
    const mes = nombreMes(clave);
    let msg;
    if (t.utilidad <= 0) msg = "En " + mes + (enCurso ? " (hasta hoy)" : "") + " los gastos superan a los ingresos por <b>" + soles(-t.utilidad) + "</b>. Además retiraste " + soles(t.RETIRO) + " para gastos personales.";
    else if (t.RETIRO > t.utilidad) msg = "En " + mes + (enCurso ? " (hasta hoy)" : "") + " el negocio ganó <b>" + soles(t.utilidad) + "</b>, pero retiraste <b>" + soles(t.RETIRO) + "</b> para gastos personales: sacaste <b>" + soles(t.RETIRO - t.utilidad) + " más de lo que ganó</b> y el capital del negocio disminuyó.";
    else msg = "En " + mes + (enCurso ? " (hasta hoy)" : "") + " el negocio ganó <b>" + soles(t.utilidad) + "</b> (margen de " + String(t.margen).replace(".", ",") + " %). Retiraste " + soles(t.RETIRO) + " para gastos personales y quedan <b>" + soles(t.despuesRetiros) + "</b> para reinvertir o ahorrar.";
    $("#mensaje-clave").className = "mensaje-clave mensaje-clave--" + (t.utilidad <= 0 ? "mal" : t.RETIRO > t.utilidad ? "ojo" : "bien");
    $("#mensaje-clave").innerHTML = msg;

    const er = DB.estadoResultados(12);
    GRAFICOS.barras("graf-meses", { etiquetas: er.meses.map(function (m) { return m.etiqueta; }), soles: true, series: [
      { nombre: "Ingresos", datos: er.ingresos.totales, color: "celeste" }, { nombre: "Gastos", datos: er.gastos.totales, color: "azul" }, { nombre: "Retiros", datos: er.retiros.totales, color: "ambar" }] });
    const gastos = DB.consultar("SELECT c.nombre, SUM(m.monto) AS t FROM movimientos m JOIN categorias c ON c.id = m.categoria_id WHERE m.tipo = 'GASTO' AND substr(m.fecha,1,7) = ? GROUP BY c.id ORDER BY t DESC", [clave]);
    $("#g-cat-sub").textContent = "Gastos de " + mes + " por categoría";
    GRAFICOS.barras("graf-categorias", { etiquetas: gastos.map(function (g) { return g.nombre.replace(" (luz, agua, gas, internet)", ""); }), horizontal: true, soles: true,
      series: [{ nombre: "Gasto", datos: gastos.map(function (g) { return DB.r2(g.t); }), color: "azul" }] });

    $("#cuentas").innerHTML = cuentas.map(function (c, k) {
      return '<div class="cuenta"><span class="cuenta__icono">' + (ICO_CUENTA[k] || ICO_CUENTA[1]) + "</span><span><small>" + esc(c.nombre) + "</small><b>" + soles(c.saldo) + "</b></span></div>";
    }).join("") + '<div class="cuenta cuenta--total"><span><small>Total disponible</small><b>' + soles(total) + "</b></span></div>";
    $("#tabla-ultimos").innerHTML = tablaMov(DB.listar().slice(0, 7), true);
  }

  /* =================== Movimientos =================== */
  function filtroMov() {
    const mes = $("#m-mes").value;
    return { texto: $("#m-buscar").value.trim(), tipo: $("#m-tipo").value, cuenta: $("#m-cuenta").value,
      desde: mes ? mes + "-01" : "", hasta: mes ? mes + "-31" : "" };
  }
  function pintarMovimientos() {
    const lista = DB.listar(filtroMov());
    const suma = function (t) { return lista.filter(function (m) { return m.tipo === t; }).reduce(function (s, m) { return s + m.monto; }, 0); };
    $("#m-totales").innerHTML = '<span>Ingresos <b class="monto--entra">' + soles(suma("INGRESO")) + "</b></span><span>Gastos <b class=\"monto--sale\">" + soles(suma("GASTO")) + "</b></span><span>Retiros <b>" + soles(suma("RETIRO")) + "</b></span><span>" + lista.length + " movimiento(s)</span>";
    $("#tabla-mov").innerHTML = tablaMov(lista.slice(0, 200), false);
    $("#m-nota").textContent = lista.length > 200 ? "Se muestran los 200 más recientes. Usa los filtros o exporta a Excel para ver todos." : "";
  }
  function tablaMov(lista, compacta) {
    const cols = [
      { titulo: "Fecha", html: function (m) { return fecha(m.fecha); } },
      { titulo: "Detalle", clase: "celda-titular", html: function (m) { return "<b>" + esc(m.descripcion || TIPO_TXT[m.tipo]) + "</b><small class='sub'>" + esc(m.tipo === "TRANSFERENCIA" ? m.cuenta + " → " + m.cuenta_destino : (m.categoria + (compacta ? "" : " · " + m.cuenta))) + (m.origen === "Importado" ? " · importado" : "") + "</small>"; } }
    ];
    if (!compacta) cols.push({ titulo: "Tipo", html: function (m) { return chipTipo(m.tipo); } }, { titulo: "Comprobante", html: function (m) { return esc(m.comprobante); } });
    cols.push({ titulo: "Monto", clase: "num", html: montoFirmado });
    if (!compacta) cols.push({ titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (m) { return '<button type="button" class="btn-icono btn-icono--peligro" data-eliminar="' + m.id + '" title="Eliminar" aria-label="Eliminar movimiento">' + ICONOS.eliminar + "</button>"; } });
    return tabla(cols, lista, { vacio: "No hay movimientos con esos filtros." });
  }
  function exportarMov() {
    const filas = [["Fecha", "Tipo", "Categoría", "Cuenta", "Cuenta destino", "Descripción", "Comprobante", "Entrada", "Salida", "Origen"]];
    DB.listar(filtroMov()).slice().reverse().forEach(function (m) {
      filas.push([fecha(m.fecha), TIPO_TXT[m.tipo], m.categoria || "", m.cuenta, m.cuenta_destino || "", m.descripcion, m.comprobante,
        m.tipo === "INGRESO" ? m.monto : "", m.tipo === "GASTO" || m.tipo === "RETIRO" ? m.monto : "", m.origen]);
    });
    exportarExcel([{ nombre: "Movimientos", filas: filas, anchos: [11, 15, 30, 16, 16, 44, 15, 11, 11, 10] }], "movimientos_" + DB.hoy() + ".xlsx");
  }

  /* =================== Estado de resultados =================== */
  function pintarResultados() {
    const er = DB.estadoResultados(12);
    const celdas = function (vals, total, clase) { return vals.map(function (v) { return '<td class="num ' + (clase || "") + (v < 0 ? " negativo" : "") + '">' + (v ? num(Math.round(v)) : "—") + "</td>"; }).join("") + '<td class="num total ' + (clase || "") + (total < 0 ? " negativo" : "") + '">' + num(Math.round(total)) + "</td>"; };
    const sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
    let h = '<div class="tabla-envoltura" tabindex="0" role="region" aria-label="Estado de resultados (se desplaza horizontalmente)"><table class="tabla er"><thead><tr><th scope="col" class="er__concepto">Concepto (S/)</th>' + er.meses.map(function (m) { return '<th scope="col" class="num">' + m.etiqueta + "</th>"; }).join("") + '<th scope="col" class="num">Total</th></tr></thead><tbody>';
    const seccion = function (titulo, s, clase) {
      h += '<tr class="er__seccion"><th scope="row" colspan="' + (er.meses.length + 2) + '">' + titulo + "</th></tr>";
      s.filas.forEach(function (f) { h += '<tr><th scope="row" class="er__concepto er__sangria">' + esc(f.categoria.nombre) + "</th>" + celdas(f.valores, f.total) + "</tr>"; });
      h += '<tr class="er__subtotal ' + clase + '"><th scope="row" class="er__concepto">Total ' + titulo.toLowerCase() + "</th>" + celdas(s.totales, s.total) + "</tr>";
    };
    seccion("Ingresos", er.ingresos, "");
    seccion("Gastos", er.gastos, "");
    h += '<tr class="er__resultado"><th scope="row" class="er__concepto">Utilidad del negocio</th>' + celdas(er.utilidad, er.utilidadTotal) + "</tr>";
    h += '<tr class="er__margen"><th scope="row" class="er__concepto">Margen</th>' + er.margen.map(function (m) { return '<td class="num' + (m < 0 ? " negativo" : "") + '">' + String(m).replace(".", ",") + " %</td>"; }).join("") +
      '<td class="num total">' + (er.ingresos.total ? String(Math.round(er.utilidadTotal / er.ingresos.total * 1000) / 10).replace(".", ",") : 0) + " %</td></tr>";
    h += '<tr class="er__seccion"><th scope="row" colspan="' + (er.meses.length + 2) + '">Fuera del negocio</th></tr>';
    h += '<tr><th scope="row" class="er__concepto er__sangria">Retiros personales</th>' + celdas(er.retiros.totales, er.retiros.total) + "</tr>";
    h += '<tr class="er__resultado er__final"><th scope="row" class="er__concepto">Queda en el negocio</th>' + celdas(er.despuesRetiros, sum(er.despuesRetiros)) + "</tr>";
    h += "</tbody></table></div>";
    $("#tabla-er").innerHTML = h;
  }
  function exportarER() {
    const er = DB.estadoResultados(12);
    const filas = [["ESTADO DE RESULTADOS MENSUAL — Pastelería Dulce Hogar (datos ficticios)"], ["Emitido:", fecha(DB.hoy())], [], ["Concepto"].concat(er.meses.map(function (m) { return m.etiqueta; })).concat(["Total"])];
    const fila = function (nombre, vals, total) { filas.push([nombre].concat(vals).concat([total])); };
    filas.push(["INGRESOS"]); er.ingresos.filas.forEach(function (f) { fila("  " + f.categoria.nombre, f.valores, f.total); }); fila("Total ingresos", er.ingresos.totales, er.ingresos.total);
    filas.push(["GASTOS"]); er.gastos.filas.forEach(function (f) { fila("  " + f.categoria.nombre, f.valores, f.total); }); fila("Total gastos", er.gastos.totales, er.gastos.total);
    fila("UTILIDAD DEL NEGOCIO", er.utilidad, er.utilidadTotal);
    fila("Margen %", er.margen, er.ingresos.total ? Math.round(er.utilidadTotal / er.ingresos.total * 1000) / 10 : 0);
    fila("Retiros personales", er.retiros.totales, er.retiros.total);
    fila("QUEDA EN EL NEGOCIO", er.despuesRetiros, DB.r2(er.utilidadTotal - er.retiros.total));
    exportarExcel([{ nombre: "Estado de resultados", filas: filas, anchos: [40].concat(er.meses.map(function () { return 11; })).concat([13]) }], "estado_resultados_" + DB.hoy() + ".xlsx");
  }

  /* =================== Presupuesto =================== */
  function pintarPresupuesto() {
    const p = DB.presupuesto();
    $("#p-sub").textContent = "Día " + p.dia + " de " + p.diasMes + " de " + nombreMes(DB.hoy().slice(0, 7)) + ". La proyección estima cómo cerrará el mes con el ritmo de gasto actual.";
    const ESTADO = { ok: ["ok", "Dentro del presupuesto"], riesgo: ["riesgo", "Podría excederse"], excedido: ["excedido", "Excedido"], sin: ["sin", "Sin presupuesto"] };
    $("#tabla-presupuesto").innerHTML = tabla([
      { titulo: "Categoría", clase: "celda-titular", html: function (f) { return "<b>" + esc(f.categoria.nombre) + "</b><small class='sub'>Promedio últimos 3 meses: " + soles(f.promedio) + "</small>"; } },
      { titulo: "Presupuesto", clase: "num", html: function (f) { return '<button type="button" class="enlace-tabla" data-presupuesto="' + f.categoria.id + '" aria-label="Editar presupuesto de ' + esc(f.categoria.nombre) + '">' + (f.categoria.presupuesto ? soles(f.categoria.presupuesto) : "Definir") + "</button>"; } },
      { titulo: "Gastado", clase: "num", html: function (f) { return "<b>" + soles(f.gastado) + "</b>"; } },
      { titulo: "Avance", html: function (f) {
        if (!f.categoria.presupuesto) return '<span class="sub">—</span>';
        const ancho = Math.min(100, f.pct), marca = Math.min(100, Math.round(p.dia / p.diasMes * 100));
        return '<div class="barra-pres barra-pres--' + f.estado + '" role="img" aria-label="' + f.pct + ' % del presupuesto usado"><span style="width:' + ancho + '%"></span><i style="left:' + marca + '%" title="Día del mes"></i></div><small class="sub">' + f.pct + " %</small>";
      } },
      { titulo: "Proyección", clase: "num", html: function (f) { return soles(f.proyeccion); } },
      { titulo: "Estado", html: function (f) { const e = ESTADO[f.estado]; return '<span class="chip-pres chip-pres--' + e[0] + '">' + e[1] + "</span>"; } }
    ], p.filas, { clase: "tabla--presupuesto" });
  }
  function editarPresupuesto(boton) {
    const id = Number(boton.dataset.presupuesto);
    const cat = DB.categorias("GASTO").find(function (c) { return c.id === id; });
    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.step = "50"; input.inputMode = "decimal"; input.className = "editar-presupuesto";
    input.value = cat.presupuesto || ""; input.setAttribute("aria-label", "Nuevo presupuesto de " + cat.nombre);
    boton.replaceWith(input); input.focus(); input.select();
    let hecho = false;
    const guardar = function (aceptar) {
      if (hecho) return; hecho = true;
      if (aceptar) {
        try { DB.actualizarPresupuesto(id, input.value === "" ? 0 : input.value); avisar("Presupuesto actualizado."); }
        catch (e) { avisar(e.message, "error"); }
      }
      pintarPresupuesto();
    };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") guardar(true); if (e.key === "Escape") guardar(false); });
    input.addEventListener("blur", function () { guardar(true); });
  }

  /* =================== Importar =================== */
  function pintarImportar() {
    const cats = DB.categorias();
    $("#re-categoria").innerHTML = opcionesCategoria(cats, null);
    $("#tabla-reglas").innerHTML = tabla([
      { titulo: "Palabra clave", html: function (r) { return "<code>" + esc(r.palabra) + "</code>"; } },
      { titulo: "Categoría", html: function (r) { return esc(r.categoria) + "<small class='sub'>" + TIPO_TXT[r.tipo] + "</small>"; } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (r) { return '<button type="button" class="btn-icono btn-icono--peligro" data-eliminar-regla="' + r.id + '" title="Eliminar regla" aria-label="Eliminar regla ' + esc(r.palabra) + '">' + ICONOS.eliminar + "</button>"; } }
    ], DB.reglas(), { vacio: "No hay reglas." });
    if (estado.importacion) pintarRevision();
  }
  function opcionesCategoria(cats, seleccion, signo) {
    const grupos = { INGRESO: "Ingresos", GASTO: "Gastos", RETIRO: "Retiros personales" };
    return '<option value="">Sin categoría</option>' + Object.keys(grupos).filter(function (t) { return !signo || (signo > 0 ? t === "INGRESO" : t !== "INGRESO"); }).map(function (t) {
      return '<optgroup label="' + grupos[t] + '">' + cats.filter(function (c) { return c.tipo === t; }).map(function (c) { return '<option value="' + c.id + '"' + (c.id === seleccion ? " selected" : "") + ">" + esc(c.nombre) + "</option>"; }).join("") + "</optgroup>";
    }).join("");
  }
  function analizar() {
    $("#i-error").textContent = "";
    try {
      const filas = DB.analizarExtracto($("#i-texto").value, Number($("#i-cuenta").value));
      estado.importacion = { filas: filas, cuenta: Number($("#i-cuenta").value) };
      pintarRevision();
      $("#i-revision").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { $("#i-error").textContent = e.message; $("#i-revision").hidden = true; }
  }
  function pintarRevision() {
    const imp = estado.importacion, cats = DB.categorias();
    $("#i-revision").hidden = false;
    const validas = imp.filas.filter(function (f) { return !f.error; });
    const n = { total: imp.filas.length, nuevas: validas.filter(function (f) { return !f.duplicado; }).length, dup: validas.filter(function (f) { return f.duplicado; }).length,
      sin: validas.filter(function (f) { return f.importar && !f.categoria_id; }).length, err: imp.filas.filter(function (f) { return f.error; }).length, sel: validas.filter(function (f) { return f.importar; }).length };
    $("#i-resumen").innerHTML = n.total + " línea(s): <b>" + n.nuevas + " nuevas</b>" + (n.dup ? ", " + n.dup + " duplicada(s)" : "") + (n.err ? ", " + n.err + " con error" : "") +
      (n.sin ? ' · <span class="texto-peligro">' + n.sin + " sin categoría</span>" : "");
    $("#tabla-importar").innerHTML = tabla([
      { titulo: "", etiqueta: "Importar", html: function (f) { return f.error ? "" : '<input type="checkbox" class="check-importar" data-linea="' + f.linea + '"' + (f.importar ? " checked" : "") + ' aria-label="Importar línea ' + f.linea + '">'; } },
      { titulo: "Fecha", html: function (f) { return f.error ? "Línea " + f.linea : fecha(f.fecha); } },
      { titulo: "Descripción", clase: "celda-titular", html: function (f) { return f.error ? '<span class="texto-peligro">' + esc(f.error) + "</span><small class='sub'>" + esc(f.texto) + "</small>" : "<b>" + esc(f.descripcion) + "</b>"; } },
      { titulo: "Monto", clase: "num", html: function (f) { return f.error ? "" : f.tipo === "INGRESO" ? '<b class="monto monto--entra">+' + soles(f.monto) + "</b>" : '<b class="monto monto--sale">−' + soles(f.monto) + "</b>"; } },
      { titulo: "Categoría", html: function (f) { return f.error ? "" : '<select class="select-categoria' + (f.importar && !f.categoria_id ? " select-categoria--falta" : "") + '" data-linea="' + f.linea + '" aria-label="Categoría de la línea ' + f.linea + '">' + opcionesCategoria(cats, f.categoria_id, f.tipo === "INGRESO" ? 1 : -1) + "</select>"; } },
      { titulo: "Detección", html: function (f) {
        if (f.error) return '<span class="chip-imp chip-imp--error">Error</span>';
        if (f.duplicado) return '<span class="chip-imp chip-imp--dup">Ya registrado</span>';
        if (f.futura) return '<span class="chip-imp chip-imp--error">Fecha futura</span>';
        return f.regla ? '<span class="chip-imp chip-imp--regla">Regla «' + esc(f.regla) + "»</span>" : '<span class="chip-imp chip-imp--manual">Elegir categoría</span>';
      } }
    ], imp.filas, { clase: "tabla--importar" });
    $("#i-importar").disabled = !n.sel;
  }
  function confirmarImportacion() {
    const imp = estado.importacion;
    try {
      const n = DB.importar(imp.filas, imp.cuenta);
      avisar(n + " movimiento(s) importados y categorizados.");
      // Se vuelve a analizar el mismo texto: ahora esas líneas aparecen como "Ya registrado"
      estado.importacion = { filas: DB.analizarExtracto($("#i-texto").value, imp.cuenta), cuenta: imp.cuenta };
      pintarRevision();
    } catch (e) { avisar(e.message, "error"); }
  }

  /* =================== Registrar movimiento =================== */
  function abrirMov() {
    const f = $("#form-mov");
    f.reset(); $("#mv-error").textContent = "";
    const cuentas = DB.cuentas().map(function (c) { return '<option value="' + c.id + '">' + esc(c.nombre) + "</option>"; }).join("");
    f.cuenta_id.innerHTML = cuentas; f.cuenta_destino_id.innerHTML = cuentas; f.cuenta_destino_id.value = "2";
    f.fecha.value = DB.hoy(); f.fecha.max = DB.hoy();
    actualizarMov();
    $("#dialogo-mov").showModal();
    f.monto.focus();
  }
  function actualizarMov() {
    const f = $("#form-mov"), tipo = f.querySelector("[name=tipo]:checked").value;
    const ayuda = { INGRESO: "Dinero que entra por las ventas o servicios del negocio.", GASTO: "Dinero que sale para operar el negocio (insumos, alquiler, sueldos…).",
      RETIRO: "Dinero que sacas del negocio para gastos personales o de la casa. No cuenta como gasto del negocio.", TRANSFERENCIA: "Mover dinero entre tus cuentas (por ejemplo, depositar la caja en el banco). No afecta la utilidad." };
    $("#dm-ayuda").textContent = ayuda[tipo];
    $("#campo-categoria").hidden = tipo === "TRANSFERENCIA"; $("#campo-destino").hidden = tipo !== "TRANSFERENCIA";
    $("#campo-comprobante").hidden = tipo === "TRANSFERENCIA" || tipo === "RETIRO";
    $("#mv-cuenta-label").textContent = tipo === "TRANSFERENCIA" ? "Desde la cuenta" : tipo === "INGRESO" ? "Entra a la cuenta" : "Sale de la cuenta";
    const cats = DB.categorias(tipo === "TRANSFERENCIA" ? "GASTO" : tipo);
    f.categoria_id.innerHTML = '<option value="">Selecciona</option>' + cats.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nombre) + "</option>"; }).join("");
    if (tipo === "RETIRO" && cats.length === 1) f.categoria_id.value = String(cats[0].id);
    $("#mv-saldo").textContent = "Saldo actual: " + soles(DB.saldoDe(f.cuenta_id.value));
  }
  function guardarMov(e) {
    e.preventDefault();
    const f = e.target, tipo = f.querySelector("[name=tipo]:checked").value;
    try {
      DB.registrar({ tipo: tipo, monto: f.monto.value, fecha: f.fecha.value, cuenta_id: Number(f.cuenta_id.value), cuenta_destino_id: tipo === "TRANSFERENCIA" ? Number(f.cuenta_destino_id.value) : null,
        categoria_id: tipo === "TRANSFERENCIA" ? null : Number(f.categoria_id.value), descripcion: f.descripcion.value, comprobante: tipo === "TRANSFERENCIA" || tipo === "RETIRO" ? "Sin comprobante" : f.comprobante.value });
      $("#dialogo-mov").close(); avisar(TIPO_TXT[tipo] + " registrado."); pintar();
    } catch (err) { $("#mv-error").textContent = err.message; }
  }

  /* =================== Eventos =================== */
  function enlazarEventos() {
    document.addEventListener("click", async function (e) {
      const b = e.target.closest("[data-cerrar],[data-eliminar],[data-eliminar-regla],[data-presupuesto]");
      if (!b) return;
      const d = b.dataset;
      if (d.cerrar !== undefined) { b.closest("dialog").close(); return; }
      if (d.presupuesto) editarPresupuesto(b);
      if (d.eliminar && await confirmar("¿Eliminar este movimiento?", "Los saldos y reportes se recalcularán.", "Eliminar")) {
        try { DB.eliminar(Number(d.eliminar)); avisar("Movimiento eliminado."); pintar(); } catch (err) { avisar(err.message, "error"); }
      }
      if (d.eliminarRegla) { DB.eliminarRegla(Number(d.eliminarRegla)); avisar("Regla eliminada."); pintarImportar(); }
    });
    document.addEventListener("change", function (e) {
      const t = e.target;
      if (!estado.importacion) return;
      const fila = estado.importacion.filas.find(function (f) { return String(f.linea) === t.dataset.linea; });
      if (!fila) return;
      if (t.classList.contains("check-importar")) fila.importar = t.checked;
      if (t.classList.contains("select-categoria")) { fila.categoria_id = t.value ? Number(t.value) : null; fila.regla = null; }
      pintarRevision();
    });

    $("#btn-nuevo").addEventListener("click", abrirMov);
    const fm = $("#form-mov");
    fm.addEventListener("submit", guardarMov);
    fm.querySelectorAll("[name=tipo]").forEach(function (r) { r.addEventListener("change", function () { $("#mv-error").textContent = ""; actualizarMov(); }); });
    fm.cuenta_id.addEventListener("change", actualizarMov);

    $("#r-mes").addEventListener("change", pintarResumen);
    let espera;
    $("#m-buscar").addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(pintarMovimientos, 180); });
    ["#m-tipo", "#m-cuenta", "#m-mes"].forEach(function (s) { $(s).addEventListener("change", pintarMovimientos); });
    $("#btn-exportar-mov").addEventListener("click", exportarMov);
    $("#btn-exportar-er").addEventListener("click", exportarER);

    $("#i-ejemplo").addEventListener("click", function () { $("#i-cuenta").value = "2"; $("#i-texto").value = DATOS_EJEMPLO.extractoEjemplo(DB); analizar(); });
    $("#i-analizar").addEventListener("click", analizar);
    $("#i-archivo").addEventListener("change", function (e) {
      const archivo = e.target.files[0];
      if (!archivo) return;
      if (archivo.size > 1024 * 1024) { $("#i-error").textContent = "El archivo supera 1 MB."; return; }
      const lector = new FileReader();
      lector.onload = function () { $("#i-texto").value = String(lector.result).replace(/^﻿/, ""); analizar(); };
      lector.onerror = function () { $("#i-error").textContent = "No se pudo leer el archivo."; };
      lector.readAsText(archivo, "utf-8");
      e.target.value = "";
    });
    $("#i-importar").addEventListener("click", confirmarImportacion);
    $("#form-regla").addEventListener("submit", function (e) {
      e.preventDefault(); $("#re-error").textContent = "";
      try { DB.agregarRegla($("#re-palabra").value, Number($("#re-categoria").value)); $("#re-palabra").value = ""; avisar("Regla agregada."); pintarImportar(); }
      catch (err) { $("#re-error").textContent = err.message; }
    });

    $("#btn-descargar-db").addEventListener("click", function () { descargar(DB.exportarArchivo(), "finanzas_demo_" + DB.hoy() + ".sqlite", "application/vnd.sqlite3"); });
    $("#btn-reiniciar").addEventListener("click", async function () {
      if (!(await confirmar("¿Restablecer la demo?", "Se borrarán tus cambios y se cargarán de nuevo los datos de ejemplo.", "Restablecer"))) return;
      await DB.reiniciar();
      estado.importacion = null; $("#i-revision").hidden = true;
      $("#estado-guardado").textContent = ""; avisar("Demo restablecida con los datos de ejemplo.");
      llenarSelectores(); irA(estado.vista);
    });
  }

  iniciar();
})();
