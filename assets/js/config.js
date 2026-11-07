/* ==========================================================================
   config.js — Datos de contacto e integraciones del sitio
   Es el único archivo que hay que editar para cambiar el WhatsApp o el formulario.
   ========================================================================== */
window.CONFIG = {
  // Número de WhatsApp en formato internacional, sin "+" ni espacios (51 = Perú)
  whatsapp: "51901288798",
  whatsappVisible: "+51 901 288 798",
  mensajeWhatsapp: "Hola, vi tu página de Automatización & Sistemas y me gustaría automatizar un proceso de mi empresa.",

  // Web3Forms: servicio que envía el formulario de contacto a tu correo.
  // Esta "Access Key" es pública por diseño (no es una contraseña): Web3Forms
  // solo la usa para saber a qué correo reenviar los mensajes.
  web3formsKey: "53b32adf-47d8-4a25-beb2-bdf7857f99db",
  web3formsUrl: "https://api.web3forms.com/submit"
};
