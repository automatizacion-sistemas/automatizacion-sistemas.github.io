/* ==========================================================================
   portafolio.js — Genera las tarjetas del portafolio desde data/proyectos.js
   - Dibuja una vista ilustrativa cuando el proyecto aún no tiene captura real
   - Filtros por categoría
   - "Solicitar un sistema similar" llena el formulario de contacto
   ========================================================================== */
(function () {
  "use strict";

  const contenedor = document.getElementById("lista-proyectos");
  const proyectos = window.PROYECTOS || [];
  if (!contenedor) return;

  // Escapa texto para insertarlo de forma segura en el HTML
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Vistas ilustrativas (SVG) ----------
     Simulan la pantalla de cada sistema mientras no exista una captura real. */
  const AZ = "#0a1f44", AZ2 = "#173a7a", CE = "#00b4ff", GR = "#dde3ec", FO = "#f5f7fa";

  function marco(contenido) {
    return '<svg viewBox="0 0 320 200" aria-hidden="true">' +
      '<rect width="320" height="200" fill="' + FO + '"/>' +
      '<rect width="62" height="200" fill="' + AZ + '"/>' +
      '<rect x="12" y="14" width="38" height="8" rx="4" fill="' + CE + '"/>' +
      '<g fill="#3a5487"><rect x="12" y="36" width="34" height="6" rx="3"/><rect x="12" y="50" width="28" height="6" rx="3"/><rect x="12" y="64" width="32" height="6" rx="3"/><rect x="12" y="78" width="24" height="6" rx="3"/></g>' +
      contenido + "</svg>";
  }
  function tarjetasKpi() {
    return '<g fill="#fff" stroke="' + GR + '"><rect x="74" y="12" width="74" height="38" rx="6"/><rect x="156" y="12" width="74" height="38" rx="6"/><rect x="238" y="12" width="72" height="38" rx="6"/></g>' +
      '<g fill="#0f172a"><rect x="82" y="32" width="30" height="9" rx="3"/><rect x="164" y="32" width="24" height="9" rx="3"/><rect x="246" y="32" width="28" height="9" rx="3"/></g>' +
      '<g fill="#c3ccd9"><rect x="82" y="20" width="40" height="5" rx="2.5"/><rect x="164" y="20" width="36" height="5" rx="2.5"/><rect x="246" y="20" width="38" height="5" rx="2.5"/></g>';
  }
  function filasTabla(x, y, w, n) {
    let s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (18 + n * 16) + '" rx="6" fill="#fff" stroke="' + GR + '"/>';
    s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="16" rx="6" fill="' + AZ2 + '"/>';
    for (let i = 0; i < n; i++) {
      const yy = y + 24 + i * 16;
      s += '<rect x="' + (x + 8) + '" y="' + yy + '" width="' + (w * 0.35) + '" height="5" rx="2.5" fill="#c3ccd9"/>';
      s += '<rect x="' + (x + w * 0.5) + '" y="' + yy + '" width="' + (w * 0.18) + '" height="5" rx="2.5" fill="#c3ccd9"/>';
      s += '<rect x="' + (x + w * 0.78) + '" y="' + (yy - 1) + '" width="' + (w * 0.14) + '" height="7" rx="3.5" fill="' + (i % 3 === 1 ? "#fde68a" : "#bbf7d0") + '"/>';
    }
    return s;
  }
  const vistas = {
    barras: function () {
      const alturas = [34, 56, 46, 74, 62, 84, 68, 90];
      let b = "";
      alturas.forEach(function (h, i) { b += '<rect x="' + (92 + i * 26) + '" y="' + (176 - h) + '" width="16" height="' + h + '" rx="2" fill="' + (i < 4 ? CE : AZ2) + '"/>'; });
      return marco(tarjetasKpi() + '<rect x="74" y="60" width="236" height="128" rx="6" fill="#fff" stroke="' + GR + '"/>' + b);
    },
    linea: function () {
      return marco(tarjetasKpi() + '<rect x="74" y="60" width="236" height="128" rx="6" fill="#fff" stroke="' + GR + '"/>' +
        '<path d="M88 160 L120 140 L152 148 L184 112 L216 120 L248 92 L296 80 L296 176 L88 176Z" fill="' + CE + '" opacity=".15"/>' +
        '<path d="M88 160 L120 140 L152 148 L184 112 L216 120 L248 92 L296 80" fill="none" stroke="' + CE + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>');
    },
    calendario: function () {
      let c = '<rect x="74" y="12" width="236" height="176" rx="6" fill="#fff" stroke="' + GR + '"/>';
      for (let f = 0; f < 5; f++) for (let k = 0; k < 7; k++) {
        const estado = (f * 7 + k) % 9 === 4 ? "#fca5a5" : (f * 7 + k) % 6 === 2 ? "#fde68a" : (k > 4 ? "#eef2f7" : "#bbf7d0");
        c += '<rect x="' + (84 + k * 31) + '" y="' + (28 + f * 31) + '" width="25" height="25" rx="4" fill="' + estado + '"/>';
      }
      return marco(c);
    },
    personas: function () {
      let p = "";
      for (let i = 0; i < 6; i++) {
        const x = 74 + (i % 3) * 80, y = 12 + Math.floor(i / 3) * 90;
        p += '<rect x="' + x + '" y="' + y + '" width="72" height="82" rx="6" fill="#fff" stroke="' + GR + '"/>' +
          '<circle cx="' + (x + 36) + '" cy="' + (y + 26) + '" r="13" fill="' + (i % 2 ? CE : AZ2) + '" opacity=".85"/>' +
          '<rect x="' + (x + 14) + '" y="' + (y + 48) + '" width="44" height="6" rx="3" fill="#0f172a"/>' +
          '<rect x="' + (x + 20) + '" y="' + (y + 60) + '" width="32" height="5" rx="2.5" fill="#c3ccd9"/>';
      }
      return marco(p);
    },
    embudo: function () {
      const anchos = [220, 176, 132, 88];
      let e = '<rect x="74" y="12" width="236" height="176" rx="6" fill="#fff" stroke="' + GR + '"/>';
      anchos.forEach(function (w, i) { e += '<rect x="' + (192 - w / 2) + '" y="' + (30 + i * 38) + '" width="' + w + '" height="28" rx="6" fill="' + [AZ, AZ2, "#2c6fc9", CE][i] + '"/>'; });
      return marco(e);
    },
    excel: function () {
      let g = '<rect x="74" y="12" width="236" height="176" rx="6" fill="#fff" stroke="' + GR + '"/><rect x="74" y="12" width="236" height="18" rx="6" fill="#15803d"/>';
      for (let f = 0; f < 8; f++) for (let k = 0; k < 5; k++)
        g += '<rect x="' + (80 + k * 46) + '" y="' + (38 + f * 18) + '" width="40" height="12" rx="2" fill="' + (f === 0 ? "#dcfce7" : (k === 4 ? "#e0f5ff" : FO)) + '"/>';
      return marco(g);
    },
    pdf: function () {
      let d = "";
      [0, 1, 2].forEach(function (i) {
        const x = 96 + i * 18, y = 20 + i * 12;
        d += '<rect x="' + x + '" y="' + y + '" width="120" height="150" rx="6" fill="#fff" stroke="' + GR + '"/>' +
          '<rect x="' + (x + 12) + '" y="' + (y + 14) + '" width="56" height="8" rx="4" fill="' + AZ2 + '"/>' +
          '<g fill="#c3ccd9"><rect x="' + (x + 12) + '" y="' + (y + 34) + '" width="96" height="5" rx="2.5"/><rect x="' + (x + 12) + '" y="' + (y + 46) + '" width="86" height="5" rx="2.5"/><rect x="' + (x + 12) + '" y="' + (y + 58) + '" width="92" height="5" rx="2.5"/></g>';
      });
      d += '<rect x="250" y="140" width="46" height="22" rx="5" fill="#c62828"/><text x="273" y="155" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="sans-serif">PDF</text>';
      return marco(d);
    },
    tabla: function () { return marco(tarjetasKpi() + filasTabla(74, 60, 236, 7)); }
  };

  /* ---------- Plantilla de cada tarjeta ---------- */
  const textoEstado = { disponible: "Demo disponible", desarrollo: "Demo en desarrollo", proximamente: "Próximamente" };
  const claseEstado = { disponible: "etiqueta--disponible", desarrollo: "etiqueta--desarrollo", proximamente: "etiqueta--proximamente" };

  function tarjeta(p) {
    const captura = p.captura
      ? '<img src="' + esc(p.captura) + '" alt="Captura del ' + esc(p.titulo) + '" loading="lazy">'
      : (vistas[p.vista] || vistas.tabla)() + '<span class="proyecto__vista">Vista ilustrativa</span>';

    const botonDemo = p.estado === "disponible"
      ? '<a class="btn btn--primario btn--chico" href="' + esc(p.demo) + '">Ver demostración</a>'
      : '<button class="btn btn--primario btn--chico" disabled title="' + esc(textoEstado[p.estado]) + '">Ver demostración</button>';

    return '<article class="tarjeta proyecto revelar" data-categoria="' + esc(p.categoria) + '">' +
      '<div class="proyecto__captura">' + captura + "</div>" +
      '<div class="proyecto__cuerpo">' +
        '<div class="proyecto__fila"><span class="etiqueta ' + claseEstado[p.estado] + '">' + textoEstado[p.estado] + "</span>" +
          p.tecnologias.map(function (t) { return '<span class="etiqueta etiqueta--tech">' + esc(t) + "</span>"; }).join("") + "</div>" +
        "<h3>" + esc(p.titulo) + "</h3>" +
        '<p class="proyecto__problema">' + esc(p.problema) + "</p>" +
        '<ul class="proyecto__lista">' + p.funciones.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
        '<div class="proyecto__acciones">' + botonDemo +
          '<a class="btn btn--secundario btn--chico js-similar" href="#contacto" data-id="' + esc(p.id) + '">Solicitar un sistema similar</a>' +
        "</div>" +
      "</div></article>";
  }

  contenedor.innerHTML = proyectos.map(tarjeta).join("");
  if (window.activarRevelado) window.activarRevelado();

  /* ---------- Filtros ---------- */
  document.querySelectorAll(".filtro").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const filtro = btn.dataset.filtro;
      document.querySelectorAll(".filtro").forEach(function (b) {
        b.classList.toggle("activo", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      contenedor.querySelectorAll(".proyecto").forEach(function (card) {
        card.classList.toggle("oculto", filtro !== "todos" && card.dataset.categoria !== filtro);
      });
    });
  });

  /* ---------- "Solicitar un sistema similar" → prellenar el formulario ---------- */
  contenedor.addEventListener("click", function (e) {
    const enlace = e.target.closest(".js-similar");
    if (!enlace) return;
    const p = proyectos.find(function (x) { return x.id === enlace.dataset.id; });
    if (!p) return;
    const tipo = document.getElementById("f-tipo");
    const mensaje = document.getElementById("f-mensaje");
    if (tipo) tipo.value = p.servicio;
    if (mensaje && !mensaje.value.trim()) {
      mensaje.value = "Me interesa un sistema similar a \"" + p.titulo + "\" para mi negocio. ";
    }
    // Lleva el foco al mensaje para que el visitante complete su caso
    setTimeout(function () { if (mensaje) mensaje.focus({ preventScroll: true }); }, 600);
  });
})();
