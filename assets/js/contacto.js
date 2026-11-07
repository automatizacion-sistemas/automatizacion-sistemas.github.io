/* ==========================================================================
   contacto.js — Validación y envío real del formulario de contacto
   El envío se hace con Web3Forms (https://web3forms.com), que reenvía cada
   mensaje al correo registrado. No se simula nada: el mensaje de éxito solo
   aparece si Web3Forms confirma la recepción.
   ========================================================================== */
(function () {
  "use strict";

  const form = document.getElementById("formulario");
  if (!form) return;
  const resultado = document.getElementById("formulario-resultado");
  const boton = form.querySelector(".formulario__enviar");
  const textoBoton = boton.querySelector("span");
  const cfg = window.CONFIG || {};

  /* ---------- Reglas de validación ---------- */
  const reglas = {
    nombre: function (v) { return v.trim().length >= 3; },
    correo: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    tipo: function (v) { return v !== ""; },
    mensaje: function (v) { return v.trim().length >= 20; }
  };

  function validarCampo(input) {
    const regla = reglas[input.name];
    if (!regla) return true;
    const ok = regla(input.value);
    const campo = input.closest(".campo");
    campo.classList.toggle("campo--invalido", !ok);
    input.setAttribute("aria-invalid", String(!ok));
    return ok;
  }

  // Valida al salir de cada campo, y mientras escribe si ya tenía error
  form.querySelectorAll("input, select, textarea").forEach(function (input) {
    input.addEventListener("blur", function () { if (input.value) validarCampo(input); });
    input.addEventListener("input", function () {
      if (input.closest(".campo") && input.closest(".campo").classList.contains("campo--invalido")) validarCampo(input);
    });
  });

  function mostrar(tipo, html) {
    resultado.innerHTML = '<div class="aviso aviso--' + tipo + '">' + html + "</div>";
  }

  function enlaceWsp() {
    return window.enlaceWhatsapp ? window.enlaceWhatsapp() : "https://wa.me/" + cfg.whatsapp;
  }

  /* ---------- Envío ---------- */
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    resultado.innerHTML = "";

    // 1. Validar todo
    const campos = Array.from(form.querySelectorAll("[name]")).filter(function (i) { return reglas[i.name]; });
    const invalidos = campos.filter(function (i) { return !validarCampo(i); });
    if (invalidos.length) {
      invalidos[0].focus();
      mostrar("error", "Revisa los campos marcados en rojo.");
      return;
    }

    // 2. Si no hay clave configurada, no se finge un envío
    if (!cfg.web3formsKey) {
      mostrar("info", 'El formulario aún no está conectado. Escríbeme por <a href="' + enlaceWsp() + '" target="_blank" rel="noopener">WhatsApp</a>.');
      return;
    }

    // 3. Campo trampa: si un robot lo marcó, se descarta en silencio
    if (form.botcheck.checked) return;

    const datos = {
      access_key: cfg.web3formsKey,
      subject: "Nueva solicitud desde la web: " + form.tipo.value,
      from_name: "Web Automatización & Sistemas",
      name: form.nombre.value.trim(),
      email: form.correo.value.trim(),
      empresa: form.empresa.value.trim() || "(no indicó)",
      tipo_de_solucion: form.tipo.value,
      message: form.mensaje.value.trim(),
      botcheck: false
    };

    boton.classList.add("cargando");
    textoBoton.textContent = "Enviando…";

    // Si el servidor no responde en 15 segundos, se cancela
    const control = new AbortController();
    const espera = setTimeout(function () { control.abort(); }, 15000);

    try {
      const resp = await fetch(cfg.web3formsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(datos),
        signal: control.signal
      });
      const json = await resp.json().catch(function () { return {}; });

      if (resp.ok && json.success) {
        mostrar("exito", "<b>¡Mensaje enviado!</b>&nbsp;Gracias, " + datos.name.split(" ")[0].replace(/[<>&"]/g, "") + ". Te responderé pronto a " + datos.email.replace(/[<>&"]/g, "") + ".");
        form.reset();
        form.querySelectorAll(".campo--invalido").forEach(function (c) { c.classList.remove("campo--invalido"); });
      } else {
        throw new Error(json.message || "Respuesta no válida del servidor");
      }
    } catch (err) {
      console.warn("Error al enviar el formulario:", err);
      mostrar("error", 'No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo, o escríbeme por <a href="' + enlaceWsp() + '" target="_blank" rel="noopener">WhatsApp</a>.');
    } finally {
      clearTimeout(espera);
      boton.classList.remove("cargando");
      textoBoton.textContent = "Enviar mensaje";
    }
  });
})();
