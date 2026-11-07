/* ==========================================================================
   app.js — Lógica de pantallas del sistema de inventarios
   Vistas: dashboard · productos · movimientos · kardex (navegación por #hash)
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.from(document.querySelectorAll(s)); };
  const { soles, num, fecha, esc, tabla, avisar, confirmar, descargar, exportarExcel, ICONOS } = window.UI;

  const TITULOS = { dashboard: "Dashboard", productos: "Productos", movimientos: "Movimientos", kardex: "Kardex" };
  const MOTIVOS = {
    ENTRADA: ["Compra", "Devolución de cliente", "Ajuste por inventario"],
    SALIDA: ["Venta", "Merma", "Consumo interno", "Ajuste por inventario"]
  };
  const estado = { vista: "dashboard", kardexId: null };

  /* =================== Arranque =================== */
  async function iniciar() {
    try {
      const r = await DB.iniciar();
      $("#cargando").remove();
      $("#app").hidden = false;
      $("#estado-guardado").textContent = r.nuevo ? "" : "Se cargaron tus cambios anteriores.";
      enlazarEventos();
      irA(leerHash());
      window.addEventListener("hashchange", function () { irA(leerHash()); });
      setTimeout(comprobarGuardado, 1500);
    } catch (e) {
      console.error(e);
      $("#cargando").innerHTML = "<p><b>No se pudo iniciar la base de datos.</b><br>Prueba con otro navegador actualizado (Chrome, Edge, Firefox o Safari).</p>";
    }
  }
  function comprobarGuardado() {
    if (!DB.esPersistente()) {
      $("#estado-guardado").textContent = "Este navegador no permite guardar datos: tus cambios se perderán al cerrar la página.";
    }
  }
  function leerHash() {
    const h = location.hash.replace("#", "");
    return TITULOS[h] ? h : "dashboard";
  }

  /* =================== Navegación =================== */
  function irA(vista) {
    document.querySelectorAll("dialog[open]").forEach(function (d) { d.close(); }); // al cambiar de vista se cierra cualquier ventana abierta
    estado.vista = vista;
    $$(".vista").forEach(function (v) { v.hidden = v.dataset.vista !== vista; });
    $$("[data-vista]").forEach(function (a) {
      if (a.tagName === "A") a.classList.toggle("activo", a.dataset.vista === vista);
      if (a.tagName === "A") a.toggleAttribute("aria-current", a.dataset.vista === vista);
    });
    $("#titulo-vista").textContent = TITULOS[vista];
    document.title = TITULOS[vista] + " · Demo de inventarios";
    ({ dashboard: pintarDashboard, productos: pintarProductos, movimientos: pintarMovimientos, kardex: pintarKardex })[vista]();
    window.scrollTo(0, 0);
  }
  function navegar(vista) {
    if (location.hash === "#" + vista) irA(vista); else location.hash = vista;
  }

  /* =================== Dashboard =================== */
  function pintarDashboard() {
    const r = DB.resumen();
    $("#kpis").innerHTML =
      kpi("Productos registrados", num(r.totalProductos), "") +
      kpi("Valor del inventario", soles(r.valorInventario), "a costo promedio") +
      kpi("Para reponer", num(r.stockBajo.length), r.stockBajo.length ? "con stock bajo" : "todo en orden", r.stockBajo.length ? "alerta" : "") +
      kpi("Ventas del mes", soles(r.ventasMes), num(r.movimientosMes) + " movimientos este mes");

    const flujo = DB.flujoSemanal(8);
    GRAFICOS.barras("graf-flujo", {
      etiquetas: flujo.etiquetas.map(function (e) { return "Sem. " + e; }), soles: true,
      series: [{ nombre: "Compras", datos: flujo.entradas, color: "celeste" }, { nombre: "Salidas (costo)", datos: flujo.salidas, color: "azul" }]
    });
    const cats = Object.keys(r.porCategoria).map(function (k) { return [k, Math.round(r.porCategoria[k] * 100) / 100]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    GRAFICOS.barras("graf-categorias", {
      etiquetas: cats.map(function (c) { return c[0]; }), horizontal: true, soles: true,
      series: [{ nombre: "Valor", datos: cats.map(function (c) { return c[1]; }), color: "celeste" }]
    });

    const alertas = r.stockBajo.slice().sort(function (a, b) { return (a.stock / (a.stock_minimo || 1)) - (b.stock / (b.stock_minimo || 1)); });
    $("#tabla-alertas").innerHTML = tabla([
      { titulo: "Producto", html: function (p) { return "<b>" + esc(p.nombre) + "</b><small class='sub'>" + esc(p.codigo) + "</small>"; } },
      { titulo: "Stock", clase: "num", html: function (p) { return chipStock(p); } },
      { titulo: "Mínimo", clase: "num", html: function (p) { return num(p.stock_minimo); } },
      { titulo: "", etiqueta: "Acción", clase: "acciones", html: function (p) { return '<button class="btn-icono" data-comprar="' + p.id + '" title="Registrar compra">' + ICONOS.comprar + "<span>Reponer</span></button>"; } }
    ], alertas, { vacio: "Ningún producto está por debajo de su stock mínimo." });

    $("#tabla-ultimos").innerHTML = tablaMovimientos(DB.ultimosMovimientos(7), true);
  }
  function kpi(nombre, valor, detalle, clase) {
    return '<div class="indicador ' + (clase ? "indicador--" + clase : "") + '"><div class="indicador__nombre">' + esc(nombre) + '</div><div class="indicador__valor">' + valor + "</div>" +
      (detalle ? '<div class="indicador__detalle">' + esc(detalle) + "</div>" : "") + "</div>";
  }
  function chipStock(p) {
    const clase = p.stock <= 0 ? "agotado" : p.stock <= p.stock_minimo ? "bajo" : "ok";
    const texto = p.stock <= 0 ? "Agotado" : num(p.stock);
    return '<span class="chip-stock chip-stock--' + clase + '">' + texto + "</span>";
  }

  /* =================== Productos =================== */
  function pintarProductos() {
    const sel = $("#filtro-categoria"), actual = sel.value;
    sel.innerHTML = '<option value="">Todas las categorías</option>' + DB.categorias().map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
    sel.value = actual;
    const productos = DB.listarProductos({ texto: $("#buscar").value.trim(), categoria: sel.value, soloBajo: $("#filtro-bajo").checked });

    $("#tabla-productos").innerHTML = tabla([
      { titulo: "Código", campo: "codigo", clase: "codigo" },
      { titulo: "Producto", html: function (p) { return "<b>" + esc(p.nombre) + "</b><small class='sub'>" + esc(p.categoria) + " · " + esc(p.unidad) + "</small>"; } },
      { titulo: "Stock", clase: "num", html: chipStock },
      { titulo: "Mínimo", clase: "num", html: function (p) { return num(p.stock_minimo); } },
      { titulo: "Costo prom.", clase: "num", html: function (p) { return soles(p.costo_promedio); } },
      { titulo: "Valor", clase: "num", html: function (p) { return soles(p.valor); } },
      { titulo: "Precio venta", clase: "num", html: function (p) { return soles(p.precio_venta); } },
      { titulo: "", etiqueta: "Acciones", clase: "acciones", html: function (p) {
        return '<button class="btn-icono" data-kardex="' + p.id + '" title="Ver kardex" aria-label="Ver kardex de ' + esc(p.nombre) + '">' + ICONOS.kardex + "</button>" +
          '<button class="btn-icono" data-editar="' + p.id + '" title="Editar" aria-label="Editar ' + esc(p.nombre) + '">' + ICONOS.editar + "</button>" +
          '<button class="btn-icono btn-icono--peligro" data-eliminar="' + p.id + '" title="Eliminar" aria-label="Eliminar ' + esc(p.nombre) + '">' + ICONOS.eliminar + "</button>";
      } }
    ], productos, { vacio: "No se encontraron productos con esos filtros.", clase: "tabla--productos" });

    const valor = productos.reduce(function (s, p) { return s + p.valor; }, 0);
    $("#resumen-productos").textContent = productos.length + " producto(s) · valor total " + soles(valor);
  }

  function abrirProducto(id) {
    const d = $("#dialogo-producto"), f = $("#form-producto");
    f.reset(); $("#p-error").textContent = "";
    $("#lista-categorias").innerHTML = DB.categorias().map(function (c) { return '<option value="' + esc(c) + '">'; }).join("");
    if (id) {
      const p = DB.obtenerProducto(id);
      $("#dp-titulo").textContent = "Editar producto";
      f.id.value = p.id; f.codigo.value = p.codigo; f.nombre.value = p.nombre; f.categoria.value = p.categoria;
      f.unidad.value = p.unidad; f.precio_venta.value = p.precio_venta; f.stock_minimo.value = p.stock_minimo;
      $("#p-nota").hidden = true;
    } else {
      $("#dp-titulo").textContent = "Nuevo producto";
      f.id.value = "";
      $("#p-nota").hidden = false;
    }
    d.showModal();
    f.codigo.focus(); // foco inmediato (un foco con retraso podía desviar lo que el usuario ya estaba escribiendo)
  }

  function guardarProducto(e) {
    e.preventDefault();
    const f = e.target;
    try {
      const esNuevo = !f.id.value;
      const id = DB.guardarProducto({
        id: f.id.value ? Number(f.id.value) : null,
        codigo: f.codigo.value, nombre: f.nombre.value, categoria: f.categoria.value, unidad: f.unidad.value,
        precio_venta: f.precio_venta.value === "" ? 0 : f.precio_venta.value,
        stock_minimo: f.stock_minimo.value === "" ? 0 : f.stock_minimo.value
      });
      $("#dialogo-producto").close();
      if (esNuevo) {
        avisar("Producto creado. Ahora registra su stock inicial.");
        estado.preseleccion = { producto: id, tipo: "ENTRADA", motivo: "Ajuste por inventario" };
        navegar("movimientos");
      } else {
        avisar("Producto actualizado.");
        pintarProductos();
      }
    } catch (err) {
      $("#p-error").textContent = err.message;
    }
  }

  async function eliminarProducto(id) {
    const p = DB.obtenerProducto(id);
    const n = DB.uno("SELECT COUNT(*) AS n FROM movimientos WHERE producto_id = ?", [id]).n;
    const ok = await confirmar("¿Eliminar " + p.nombre + "?", "También se eliminarán sus " + n + " movimientos del kardex. Esta acción no se puede deshacer.", "Eliminar");
    if (!ok) return;
    DB.eliminarProducto(id);
    avisar("Producto eliminado.");
    pintarProductos();
  }

  function exportarProductos() {
    const productos = DB.listarProductos();
    const filas = [["Código", "Producto", "Categoría", "Unidad", "Stock", "Stock mínimo", "Estado", "Costo promedio (S/)", "Valor (S/)", "Precio venta (S/)"]];
    productos.forEach(function (p) {
      filas.push([p.codigo, p.nombre, p.categoria, p.unidad, p.stock, p.stock_minimo, p.stock <= 0 ? "Agotado" : p.stock <= p.stock_minimo ? "Reponer" : "OK",
        redondear(p.costo_promedio, 4), redondear(p.valor, 2), p.precio_venta]);
    });
    filas.push([]); filas.push(["", "TOTAL", "", "", "", "", "", "", redondear(productos.reduce(function (s, p) { return s + p.valor; }, 0), 2)]);
    exportarExcel([{ nombre: "Inventario", filas: filas, anchos: [10, 32, 18, 11, 8, 12, 10, 18, 14, 16] }], "inventario_" + DB.hoy() + ".xlsx");
  }

  /* =================== Movimientos =================== */
  function pintarMovimientos() {
    const f = $("#form-movimiento");
    const productos = DB.listarProductos();
    const actual = f.producto_id.value;
    f.producto_id.innerHTML = '<option value="">Selecciona un producto</option>' + productos.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.codigo + " · " + p.nombre) + "</option>";
    }).join("");
    f.fecha.max = DB.hoy();
    if (!f.fecha.value) f.fecha.value = DB.hoy();

    const pre = estado.preseleccion; estado.preseleccion = null;
    if (pre) {
      f.querySelector('[name=tipo][value="' + pre.tipo + '"]').checked = true;
      f.producto_id.value = String(pre.producto);
      actualizarMotivos(pre.motivo);
      f.cantidad.value = ""; f.referencia.value = "";
      f.cantidad.focus();
    } else {
      f.producto_id.value = actual;
      actualizarMotivos();
    }
    actualizarAyudaStock(true);
    pintarHistorial();
  }

  function tipoActual() { return $("#form-movimiento").querySelector("[name=tipo]:checked").value; }

  function actualizarMotivos(motivo) {
    const tipo = tipoActual();
    const sel = $("#m-motivo");
    sel.innerHTML = MOTIVOS[tipo].map(function (m) { return "<option>" + m + "</option>"; }).join("");
    if (motivo) sel.value = motivo;
    $("#campo-costo").hidden = tipo !== "ENTRADA";
  }

  function actualizarAyudaStock(sugerirCosto) {
    const f = $("#form-movimiento");
    const id = Number(f.producto_id.value);
    const info = $("#m-stock-info");
    if (!id) { info.textContent = ""; return; }
    const p = DB.listarProductos().find(function (x) { return x.id === id; });
    info.innerHTML = "Stock actual: <b>" + num(p.stock) + " " + esc(p.unidad.toLowerCase()) + "</b> · costo promedio " + soles(p.costo_promedio);
    if (sugerirCosto && tipoActual() === "ENTRADA" && !f.costo_unitario.value && p.costo_promedio) {
      f.costo_unitario.value = p.costo_promedio.toFixed(2);
    }
  }

  function registrarMovimiento(e) {
    e.preventDefault();
    const f = e.target, error = $("#m-error");
    error.textContent = "";
    const tipo = tipoActual();
    if (!f.producto_id.value) { error.textContent = "Selecciona un producto."; f.producto_id.focus(); return; }
    if (!(Number(f.cantidad.value) > 0)) { error.textContent = "Ingresa una cantidad mayor que 0."; f.cantidad.focus(); return; }
    if (tipo === "ENTRADA" && (f.costo_unitario.value === "" || Number(f.costo_unitario.value) < 0)) { error.textContent = "Ingresa el costo unitario de la compra."; f.costo_unitario.focus(); return; }
    try {
      DB.registrarMovimiento({
        producto_id: Number(f.producto_id.value), tipo: tipo, motivo: f.motivo.value, fecha: f.fecha.value,
        cantidad: f.cantidad.value, costo_unitario: f.costo_unitario.value, referencia: f.referencia.value
      });
      const p = DB.obtenerProducto(Number(f.producto_id.value));
      avisar((tipo === "ENTRADA" ? "Entrada" : "Salida") + " registrada. Stock de " + p.nombre + ": " + num(p.stock));
      f.cantidad.value = ""; f.referencia.value = ""; f.costo_unitario.value = "";
      actualizarAyudaStock(true);
      pintarHistorial();
    } catch (err) {
      error.textContent = err.message;
    }
  }

  function pintarHistorial() {
    const tipo = $("#filtro-tipo").value;
    const movs = DB.ultimosMovimientos(400).filter(function (m) { return !tipo || m.tipo === tipo; }).slice(0, 60);
    $("#tabla-movimientos").innerHTML = tablaMovimientos(movs, false);
  }

  function tablaMovimientos(movs, compacta) {
    const cols = [
      { titulo: "Fecha", html: function (m) { return fecha(m.fecha); } },
      { titulo: "Producto", html: function (m) { return esc(m.nombre) + (compacta ? "" : "<small class='sub'>" + esc(m.codigo) + "</small>"); } },
      { titulo: "Tipo", html: function (m) { return '<span class="chip-tipo chip-tipo--' + m.tipo.toLowerCase() + '">' + (m.tipo === "ENTRADA" ? "Entrada" : "Salida") + "</span>" + (compacta ? "" : "<small class='sub'>" + esc(m.motivo) + "</small>"); } },
      { titulo: "Cantidad", clase: "num", html: function (m) { return (m.tipo === "ENTRADA" ? "+" : "−") + num(m.cantidad); } }
    ];
    if (!compacta) cols.push({ titulo: "Referencia", html: function (m) { return esc(m.referencia); } });
    return tabla(cols, movs, { vacio: "Todavía no hay movimientos." });
  }

  /* =================== Kardex =================== */
  function pintarKardex() {
    const sel = $("#k-producto");
    const productos = DB.listarProductos();
    if (!productos.length) {
      sel.innerHTML = ""; $("#k-resumen").innerHTML = ""; $("#tabla-kardex").innerHTML = '<p class="vacio">No hay productos registrados.</p>';
      return;
    }
    if (!estado.kardexId || !productos.some(function (p) { return p.id === estado.kardexId; })) estado.kardexId = productos[0].id;
    sel.innerHTML = productos.map(function (p) { return '<option value="' + p.id + '">' + esc(p.codigo + " · " + p.nombre) + "</option>"; }).join("");
    sel.value = String(estado.kardexId);

    const p = productos.find(function (x) { return x.id === estado.kardexId; });
    $("#k-resumen").innerHTML =
      kpi("Stock actual", num(p.stock) + " <small>" + esc(p.unidad.toLowerCase()) + "</small>", "mínimo " + num(p.stock_minimo), p.stock <= p.stock_minimo ? "alerta" : "") +
      kpi("Costo promedio", soles(p.costo_promedio), "por " + p.unidad.toLowerCase()) +
      kpi("Valor en almacén", soles(p.valor), "stock × costo promedio");

    const filas = DB.kardex(p.id).reverse(); // lo más reciente primero
    const celda = function (bloque, campo, fmt) { return bloque ? fmt(bloque[campo]) : ""; };
    $("#tabla-kardex").innerHTML = tabla([
      { titulo: "Fecha", html: function (f) { return fecha(f.fecha); } },
      { titulo: "Detalle", html: function (f) { return esc(f.motivo) + "<small class='sub'>" + esc(f.referencia) + "</small>"; } },
      { titulo: "Ent. cant.", etiqueta: "Entrada", clase: "num grupo-ent", html: function (f) { return celda(f.entrada, "cantidad", num); } },
      { titulo: "Ent. C.U.", etiqueta: "Costo entrada", clase: "num grupo-ent", html: function (f) { return celda(f.entrada, "costo", soles); } },
      { titulo: "Ent. total", etiqueta: "Total entrada", clase: "num grupo-ent", html: function (f) { return celda(f.entrada, "total", soles); } },
      { titulo: "Sal. cant.", etiqueta: "Salida", clase: "num grupo-sal", html: function (f) { return celda(f.salida, "cantidad", num); } },
      { titulo: "Sal. C.U.", etiqueta: "Costo salida", clase: "num grupo-sal", html: function (f) { return celda(f.salida, "costo", soles); } },
      { titulo: "Sal. total", etiqueta: "Total salida", clase: "num grupo-sal", html: function (f) { return celda(f.salida, "total", soles); } },
      { titulo: "Saldo", clase: "num grupo-saldo", html: function (f) { return "<b>" + num(f.saldo.cantidad) + "</b>"; } },
      { titulo: "C.U. prom.", etiqueta: "Costo promedio", clase: "num grupo-saldo", html: function (f) { return soles(f.saldo.costo); } },
      { titulo: "Valor", clase: "num grupo-saldo", html: function (f) { return soles(f.saldo.total); } }
    ], filas, { clase: "tabla--kardex tabla--ancha", vacio: "Este producto aún no tiene movimientos.", claseFila: function (f) { return f.entrada ? "fila-entrada" : "fila-salida"; } });
  }

  function exportarKardex() {
    const p = DB.listarProductos().find(function (x) { return x.id === estado.kardexId; });
    if (!p) return;
    const filas = [
      ["KARDEX VALORIZADO — MÉTODO COSTO PROMEDIO PONDERADO"],
      ["Producto:", p.codigo + " · " + p.nombre], ["Unidad:", p.unidad], ["Emitido:", fecha(DB.hoy())], [],
      ["Fecha", "Detalle", "Referencia", "Entrada cant.", "Entrada C.U.", "Entrada total", "Salida cant.", "Salida C.U.", "Salida total", "Saldo cant.", "Saldo C.U.", "Saldo valor"]
    ];
    DB.kardex(p.id).forEach(function (f) {
      const e = f.entrada || {}, s = f.salida || {};
      filas.push([fecha(f.fecha), f.motivo, f.referencia,
        e.cantidad || "", e.costo !== undefined ? redondear(e.costo, 4) : "", e.total !== undefined ? redondear(e.total, 2) : "",
        s.cantidad || "", s.costo !== undefined ? redondear(s.costo, 4) : "", s.total !== undefined ? redondear(s.total, 2) : "",
        f.saldo.cantidad, redondear(f.saldo.costo, 4), redondear(f.saldo.total, 2)]);
    });
    exportarExcel([{ nombre: "Kardex " + p.codigo, filas: filas, anchos: [11, 22, 16, 12, 12, 13, 12, 12, 13, 11, 12, 13] }], "kardex_" + p.codigo + "_" + DB.hoy() + ".xlsx");
  }

  function redondear(n, d) { const f = Math.pow(10, d); return Math.round((n || 0) * f) / f; }

  /* =================== Eventos =================== */
  function enlazarEventos() {
    // Botones dentro de tablas (delegación)
    document.addEventListener("click", function (e) {
      const b = e.target.closest("[data-editar],[data-eliminar],[data-kardex],[data-comprar],[data-cerrar]");
      if (!b) return;
      if (b.dataset.cerrar !== undefined) { b.closest("dialog").close(); return; }
      if (b.dataset.editar) abrirProducto(Number(b.dataset.editar));
      if (b.dataset.eliminar) eliminarProducto(Number(b.dataset.eliminar));
      if (b.dataset.kardex) { estado.kardexId = Number(b.dataset.kardex); navegar("kardex"); }
      if (b.dataset.comprar) {
        estado.preseleccion = { producto: Number(b.dataset.comprar), tipo: "ENTRADA", motivo: "Compra" };
        navegar("movimientos");
      }
    });

    // Productos
    let espera;
    $("#buscar").addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(pintarProductos, 180); });
    $("#filtro-categoria").addEventListener("change", pintarProductos);
    $("#filtro-bajo").addEventListener("change", pintarProductos);
    $("#btn-nuevo-producto").addEventListener("click", function () { abrirProducto(null); });
    $("#form-producto").addEventListener("submit", guardarProducto);
    $("#btn-exportar-productos").addEventListener("click", exportarProductos);

    // Movimientos
    const fm = $("#form-movimiento");
    fm.addEventListener("submit", registrarMovimiento);
    fm.querySelectorAll("[name=tipo]").forEach(function (r) {
      r.addEventListener("change", function () { actualizarMotivos(); $("#m-error").textContent = ""; actualizarAyudaStock(true); });
    });
    fm.producto_id.addEventListener("change", function () { fm.costo_unitario.value = ""; $("#m-error").textContent = ""; actualizarAyudaStock(true); });
    $("#filtro-tipo").addEventListener("change", pintarHistorial);

    // Kardex
    $("#k-producto").addEventListener("change", function (e) { estado.kardexId = Number(e.target.value); pintarKardex(); });
    $("#btn-exportar-kardex").addEventListener("click", exportarKardex);

    // Barra superior
    $("#btn-descargar-db").addEventListener("click", function () {
      descargar(DB.exportarArchivo(), "inventario_demo_" + DB.hoy() + ".sqlite", "application/vnd.sqlite3");
    });
    $("#btn-reiniciar").addEventListener("click", async function () {
      const ok = await confirmar("¿Restablecer la demo?", "Se borrarán tus cambios y se cargarán de nuevo los datos de ejemplo.", "Restablecer");
      if (!ok) return;
      await DB.reiniciar();
      estado.kardexId = null;
      $("#estado-guardado").textContent = "";
      avisar("Demo restablecida con los datos de ejemplo.");
      irA(estado.vista);
    });
  }

  iniciar();
})();
