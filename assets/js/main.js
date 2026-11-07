/* ==========================================================================
   main.js — Comportamiento general de la página
   1. Menú (fondo al hacer scroll, menú móvil, enlace activo)
   2. Animaciones de aparición al hacer scroll
   3. Enlaces de WhatsApp construidos desde config.js
   4. Botón flotante de WhatsApp
   ========================================================================== */
(function () {
  "use strict";

  const menu = document.getElementById("menu");
  const boton = document.getElementById("menu-boton");
  const enlaces = document.getElementById("menu-enlaces");

  /* ---------- 1. Menú ---------- */

  // El menú pasa de transparente a blanco cuando el usuario baja
  function actualizarMenu() {
    menu.classList.toggle("solido", window.scrollY > 40);
  }
  actualizarMenu();
  window.addEventListener("scroll", actualizarMenu, { passive: true });

  // Abrir y cerrar el menú en celulares
  function cerrarMenu() {
    menu.classList.remove("abierto");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-label", "Abrir menú");
  }
  boton.addEventListener("click", function () {
    const abierto = menu.classList.toggle("abierto");
    boton.setAttribute("aria-expanded", String(abierto));
    boton.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  });
  enlaces.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", cerrarMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarMenu(); });

  // Resalta en el menú la sección que se está viendo
  const secciones = ["servicios", "portafolio", "proceso", "sobre-mi", "contacto"]
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  if ("IntersectionObserver" in window) {
    const observadorSecciones = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        enlaces.querySelectorAll("a").forEach(function (a) {
          a.classList.toggle("activo", a.getAttribute("href") === "#" + entrada.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secciones.forEach(function (s) { observadorSecciones.observe(s); });
  }

  /* ---------- 2. Aparición al hacer scroll ---------- */
  window.activarRevelado = function () {
    const elementos = document.querySelectorAll(".revelar:not(.visible)");
    if (!("IntersectionObserver" in window)) {
      elementos.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    const observador = new IntersectionObserver(function (entradas, obs) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("visible");
          obs.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    elementos.forEach(function (el, i) {
      // Pequeño escalonado entre elementos hermanos
      el.style.transitionDelay = (i % 4) * 70 + "ms";
      observador.observe(el);
    });
  };
  window.activarRevelado();

  /* ---------- 3. Enlaces de WhatsApp ---------- */
  const cfg = window.CONFIG || {};
  window.enlaceWhatsapp = function (mensaje) {
    return "https://wa.me/" + cfg.whatsapp + "?text=" + encodeURIComponent(mensaje || cfg.mensajeWhatsapp);
  };
  document.querySelectorAll(".js-whatsapp").forEach(function (a) { a.href = window.enlaceWhatsapp(); });
  document.querySelectorAll(".js-whatsapp-visible").forEach(function (s) { s.textContent = cfg.whatsappVisible; });

  /* ---------- 4. Botón flotante de WhatsApp ---------- */
  // Aparece después del inicio y se oculta en la sección de contacto (ya hay un botón ahí)
  const flotante = document.querySelector(".whatsapp-flotante");
  const inicio = document.getElementById("inicio");
  const contacto = document.getElementById("contacto");
  function actualizarFlotante() {
    const pasoInicio = window.scrollY > inicio.offsetHeight * 0.6;
    const r = contacto.getBoundingClientRect();
    const enContacto = r.top < window.innerHeight * 0.8 && r.bottom > 0;
    flotante.classList.toggle("visible", pasoInicio && !enContacto);
  }
  actualizarFlotante();
  window.addEventListener("scroll", actualizarFlotante, { passive: true });

  /* ---------- Año actual en el pie ---------- */
  const anio = document.getElementById("anio");
  if (anio) anio.textContent = new Date().getFullYear();
})();
