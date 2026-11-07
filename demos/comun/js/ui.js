/* ==========================================================================
   ui.js — Utilidades de interfaz compartidas por las demos:
   formatos (S/, números, fechas), tablas, avisos, diálogos, descargas y Excel
   ========================================================================== */
window.UI = (function () {
  "use strict";

  // Carpeta de librerías compartidas (demos/comun/lib/)
  const LIB = new URL("../lib/", document.currentScript.src).href;

  const ICONOS = {
    editar: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /> <path d="m15 5 4 4" /> </svg>',
    eliminar: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /> </svg>',
    kardex: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M15 12h-5" /> <path d="M15 8h-5" /> <path d="M19 17V5a2 2 0 0 0-2-2H4" /> <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /> </svg>',
    comprar: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18" /> <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25" /> <circle cx="18" cy="20" r="2" /> <circle cx="8" cy="20" r="2" /> </svg>',
    ok: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M20 6 9 17l-5-5" /> </svg>',
    error: '<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" /> </svg>'
  };

  /* ---------- Formatos (Perú) ---------- */
  const fmtSoles = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });
  const fmtNum = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
  function soles(n) { return fmtSoles.format(n || 0); }
  function num(n) { return fmtNum.format(n || 0); }
  function fecha(iso) { return iso ? iso.split("-").reverse().join("/") : ""; }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /**
   * Genera una tabla. columnas: [{titulo, campo | html(fila), clase}]
   * Cada celda lleva data-label para mostrarse como tarjeta en celulares.
   */
  function tabla(columnas, filas, opciones) {
    opciones = opciones || {};
    if (!filas.length) return '<p class="vacio">' + esc(opciones.vacio || "No hay registros.") + "</p>";
    // Las tablas anchas se desplazan: se pueden enfocar con el teclado para recorrerlas
    const ancha = /tabla--ancha/.test(opciones.clase || "");
    let h = '<div class="tabla-envoltura"' + (ancha ? ' tabindex="0" role="region" aria-label="Tabla (se desplaza horizontalmente)"' : "") + '><table class="tabla ' + (opciones.clase || "") + '"><thead><tr>';
    columnas.forEach(function (c) {
      // Las columnas sin título visible (acciones) llevan un texto solo para lectores de pantalla
      const titulo = c.titulo || '<span class="visualmente-oculto">' + esc(c.etiqueta || "Acciones") + "</span>";
      h += '<th class="' + (c.clase || "") + '" scope="col">' + titulo + "</th>";
    });
    h += "</tr></thead><tbody>";
    filas.forEach(function (f) {
      h += "<tr" + (opciones.claseFila ? ' class="' + opciones.claseFila(f) + '"' : "") + ">";
      columnas.forEach(function (c) {
        const valor = c.html ? c.html(f) : esc(f[c.campo]);
        // El contenido va envuelto en .celda para que en celulares se apile bien junto a su etiqueta
        h += '<td class="' + (c.clase || "") + '" data-label="' + esc(c.etiqueta || c.titulo) + '"><span class="celda">' + valor + "</span></td>";
      });
      h += "</tr>";
    });
    return h + "</tbody></table></div>";
  }

  /* ---------- Notificaciones ---------- */
  function avisar(texto, tipo) {
    const cont = document.getElementById("notificaciones");
    const n = document.createElement("div");
    n.className = "notificacion notificacion--" + (tipo || "ok");
    n.innerHTML = (tipo === "error" ? ICONOS.error : ICONOS.ok) + "<span>" + esc(texto) + "</span>";
    cont.appendChild(n);
    requestAnimationFrame(function () { n.classList.add("visible"); });
    setTimeout(function () { n.classList.remove("visible"); setTimeout(function () { n.remove(); }, 300); }, 3800);
  }

  /* ---------- Confirmación (sustituye a window.confirm) ---------- */
  function confirmar(titulo, texto, textoBoton) {
    const d = document.getElementById("dialogo-confirmar");
    d.querySelector("#dc-titulo").textContent = titulo;
    d.querySelector("#dc-texto").textContent = texto;
    d.querySelector("#dc-si").textContent = textoBoton || "Confirmar";
    d.returnValue = "";
    d.showModal();
    return new Promise(function (ok) {
      d.addEventListener("close", function alCerrar() { d.removeEventListener("close", alCerrar); ok(d.returnValue === "si"); });
    });
  }

  /* ---------- Descargas ---------- */
  function descargar(datos, nombre, tipo) {
    try {
      const blob = datos instanceof Blob ? datos : new Blob([datos], { type: tipo || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      avisar("Descarga iniciada: " + nombre);
    } catch (e) {
      avisar("Este navegador no permitió la descarga.", "error");
    }
  }

  /* ---------- Exportar a Excel (la librería se carga solo cuando se usa) ---------- */
  let cargaXLSX = null;
  function cargarXLSX() {
    if (window.XLSX) return Promise.resolve();
    if (!cargaXLSX) {
      cargaXLSX = new Promise(function (ok, error) {
        const s = document.createElement("script");
        s.src = LIB + "xlsx.mini.min.js"; s.onload = ok; s.onerror = error;
        document.head.appendChild(s);
      });
    }
    return cargaXLSX;
  }
  /** hojas: [{nombre, filas: [[...encabezados], [...valores]], anchos: [n,...]}] */
  async function exportarExcel(hojas, nombreArchivo) {
    try {
      await cargarXLSX();
      const libro = XLSX.utils.book_new();
      hojas.forEach(function (h) {
        const hoja = XLSX.utils.aoa_to_sheet(h.filas);
        if (h.anchos) hoja["!cols"] = h.anchos.map(function (w) { return { wch: w }; });
        XLSX.utils.book_append_sheet(libro, hoja, h.nombre);
      });
      const bytes = XLSX.write(libro, { bookType: "xlsx", type: "array" });
      descargar(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombreArchivo);
    } catch (e) {
      console.error(e);
      avisar("No se pudo generar el archivo de Excel.", "error");
    }
  }

  return { ICONOS: ICONOS, soles: soles, num: num, fecha: fecha, esc: esc, tabla: tabla, avisar: avisar, confirmar: confirmar, descargar: descargar, exportarExcel: exportarExcel };
})();
