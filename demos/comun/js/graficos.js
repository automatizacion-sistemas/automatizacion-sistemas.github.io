/* ==========================================================================
   graficos.js — Gráficos de barras compartidos por las demos (Chart.js)
   Chart.js se descarga solo cuando hace falta y después de mostrar los datos,
   para que la pantalla aparezca antes.

   GRAFICOS.barras("id-canvas", {
     etiquetas: [...],
     series: [{ nombre, datos: [...], color }],   // color: nombre, código o lista por barra
     horizontal: false,          // barras horizontales
     soles: true                 // formato S/ en ejes y tooltips
   });
   ========================================================================== */
window.GRAFICOS = (function () {
  "use strict";

  const LIB = new URL("../lib/", document.currentScript.src).href;
  const COLORES = { azul: "#173a7a", celeste: "#00b4ff", verde: "#15803d", ambar: "#b45309", rojo: "#c62828", gris: "#5b6b80" };
  const REJILLA = "#eef2f7";
  const instancias = {};
  let carga = null;

  function cargarChart() {
    if (window.Chart) return Promise.resolve();
    if (!carga) {
      carga = new Promise(function (ok, error) {
        const s = document.createElement("script");
        s.src = LIB + "chart.umd.min.js"; s.onload = ok; s.onerror = error;
        document.head.appendChild(s);
      });
    }
    return carga;
  }

  function formatoSoles(v, decimales) {
    return "S/ " + Number(v).toLocaleString("es-PE", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  }

  function barras(id, op) {
    cargarChart().then(function () {
      const lienzo = document.getElementById(id);
      if (!lienzo || lienzo.closest("[hidden]")) return;
      Chart.defaults.font.family = "Inter, system-ui, sans-serif";
      Chart.defaults.font.size = 12;
      Chart.defaults.color = COLORES.gris;
      if (instancias[id]) instancias[id].destroy();

      const ejeValor = {
        beginAtZero: true, grid: { color: REJILLA }, border: { display: false },
        ticks: { maxTicksLimit: 5, callback: op.soles ? function (v) { return formatoSoles(v, 0); } : undefined }
      };
      const ejeCategoria = { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } };
      const varias = op.series.length > 1;

      instancias[id] = new Chart(lienzo, {
        type: "bar",
        data: {
          labels: op.etiquetas,
          datasets: op.series.map(function (s, i) {
            // color puede ser un nombre, un código o una lista (un color por barra)
            const color = Array.isArray(s.color)
              ? s.color.map(function (c) { return COLORES[c] || c; })
              : (COLORES[s.color] || s.color || (i ? COLORES.azul : COLORES.celeste));
            return { label: s.nombre, data: s.datos, backgroundColor: color, borderRadius: 4, maxBarThickness: op.horizontal ? 26 : 22 };
          })
        },
        options: {
          indexAxis: op.horizontal ? "y" : "x",
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: varias ? { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 } } : { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const v = op.horizontal ? ctx.parsed.x : ctx.parsed.y;
                  return " " + ctx.dataset.label + ": " + (op.soles ? formatoSoles(v, 2) : Number(v).toLocaleString("es-PE"));
                }
              }
            }
          },
          scales: op.horizontal ? { x: ejeValor, y: ejeCategoria } : { x: ejeCategoria, y: ejeValor }
        }
      });
    }).catch(function () {
      const lienzo = document.getElementById(id);
      if (lienzo) lienzo.parentNode.innerHTML = '<p class="vacio">No se pudo cargar el gráfico.</p>';
    });
  }

  return { barras: barras, COLORES: COLORES };
})();
