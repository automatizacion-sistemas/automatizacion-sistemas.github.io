/* ==========================================================================
   graficos.js — Gráficos del dashboard con Chart.js
   Colores de la marca: azul oscuro y celeste eléctrico.
   ========================================================================== */
window.GRAFICOS = (function () {
  "use strict";

  const AZUL = "#173a7a", CELESTE = "#00b4ff", GRIS = "#5b6b80", REJILLA = "#eef2f7";
  const instancias = {};

  function base() {
    if (!window.Chart) return false;
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = GRIS;
    return true;
  }
  const solesCortos = function (v) { return "S/ " + Number(v).toLocaleString("es-PE", { maximumFractionDigits: 0 }); };
  const solesTooltip = function (ctx) {
    const v = ctx.parsed.y !== undefined && ctx.chart.options.indexAxis !== "y" ? ctx.parsed.y : ctx.parsed.x;
    return " " + ctx.dataset.label + ": S/ " + Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Chart.js se carga después de mostrar los datos, para que la pantalla aparezca antes
  let carga = null;
  function cargarChart() {
    if (window.Chart) return Promise.resolve();
    if (!carga) {
      carga = new Promise(function (ok, error) {
        const s = document.createElement("script");
        s.src = "lib/chart.umd.min.js"; s.onload = ok; s.onerror = error;
        document.head.appendChild(s);
      });
    }
    return carga;
  }

  function dibujar(id, crearConfig) {
    cargarChart().then(function () {
      if (!base()) return;
      if (instancias[id]) instancias[id].destroy();
      const lienzo = document.getElementById(id);
      if (!lienzo || lienzo.closest("[hidden]")) return;
      instancias[id] = new Chart(lienzo, crearConfig());
    }).catch(function () {
      const lienzo = document.getElementById(id);
      if (lienzo) lienzo.parentNode.innerHTML = '<p class="vacio">No se pudo cargar el gráfico.</p>';
    });
  }

  function flujo(datos) {
    dibujar("graf-flujo", function () { return {
      type: "bar",
      data: {
        labels: datos.etiquetas.map(function (e) { return "Sem. " + e; }),
        datasets: [
          { label: "Compras", data: datos.entradas, backgroundColor: CELESTE, borderRadius: 4, maxBarThickness: 22 },
          { label: "Salidas (costo)", data: datos.salidas, backgroundColor: AZUL, borderRadius: 4, maxBarThickness: 22 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 } }, tooltip: { callbacks: { label: solesTooltip } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { color: REJILLA }, border: { display: false }, ticks: { callback: solesCortos, maxTicksLimit: 5 } }
        }
      }
    }; });
  }

  function categorias(porCategoria) {
    const pares = Object.keys(porCategoria).map(function (k) { return [k, Math.round(porCategoria[k] * 100) / 100]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    dibujar("graf-categorias", function () { return {
      type: "bar",
      data: {
        labels: pares.map(function (p) { return p[0]; }),
        datasets: [{ label: "Valor", data: pares.map(function (p) { return p[1]; }), backgroundColor: CELESTE, hoverBackgroundColor: AZUL, borderRadius: 4, maxBarThickness: 26 }]
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: solesTooltip } } },
        scales: {
          x: { beginAtZero: true, grid: { color: REJILLA }, border: { display: false }, ticks: { callback: solesCortos, maxTicksLimit: 5 } },
          y: { grid: { display: false } }
        }
      }
    }; });
  }

  return { flujo: flujo, categorias: categorias };
})();
