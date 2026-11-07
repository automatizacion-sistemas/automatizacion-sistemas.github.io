/* ==========================================================================
   datos-ejemplo.js — Datos de demostración: "Frío Andino" (empresa ficticia)
   Venta, instalación y mantenimiento de aire acondicionado en Lima.
   Simula ~7 meses de trabajo comercial: cada oportunidad nace con un primer
   contacto, recibe su cotización, pasa (o no) a negociación y termina ganada o
   perdida con un motivo. Las más recientes siguen abiertas con su próximo
   seguimiento: algunas vencidas, otras para hoy y otras sin contacto hace
   semanas, como en cualquier negocio real. Nombres, celulares y RUC son
   inventados (los RUC cumplen el dígito verificador, pero no son reales).
   ========================================================================== */
window.DATOS_EJEMPLO = (function () {
  "use strict";

  const NOMBRES = ["Luis", "María", "Jorge", "Ana", "Carlos", "Rosa", "Miguel", "Lucía", "Javier", "Patricia", "Ricardo", "Elena", "Fernando", "Gabriela", "Raúl", "Sofía", "Óscar", "Verónica", "Alberto", "Claudia", "Manuel", "Teresa", "Víctor", "Daniela", "Hugo", "Milagros", "César", "Pilar"];
  const APELLIDOS = ["Quispe", "Flores", "Rojas", "Huamán", "Vargas", "Castillo", "Mendoza", "Chávez", "Ramírez", "Torres", "Salazar", "Paredes", "Gutiérrez", "Cárdenas", "Espinoza", "Villanueva", "Aguilar", "Córdova", "Medina", "Palacios"];
  const EMPRESAS = ["Clínica Dental Sonrisa Plena", "Estudio Contable Rivas & Asociados", "Minimarket Don Lucho", "Panadería La Espiga Dorada", "Consultorio Pediátrico Pasitos", "Gimnasio Fuerza Total", "Hostal Los Portales del Sur",
    "Inmobiliaria Horizonte Verde", "Laboratorio Clínico Vida", "Restaurante El Fogón Norteño", "Colegio Nuevo Amanecer", "Distribuidora Andes Pack", "Óptica Visión Clara", "Notaría Benavides Prado",
    "Farmacia San Judas", "Centro de Idiomas Global Talk", "Imprenta Gráfica Moderna", "Veterinaria Huellitas", "Agencia de Viajes Rumbo Norte", "Ferretería El Constructor"];
  const SUFIJO = ["S.A.C.", "E.I.R.L.", "S.R.L."];
  const DISTRITOS = ["Miraflores", "San Isidro", "Santiago de Surco", "La Molina", "San Borja", "Los Olivos", "San Miguel", "Jesús María", "Lince", "Chorrillos", "Magdalena", "Pueblo Libre", "Ate", "Comas", "San Juan de Lurigancho"];
  const TRABAJOS_HOGAR = [["Instalación de split de 12 000 BTU en dormitorio", 1800, 2600], ["Dos equipos split para sala y dormitorio", 3800, 5200], ["Mantenimiento preventivo de 2 equipos", 350, 480], ["Reubicación de equipo split", 450, 700], ["Split inverter de 18 000 BTU para sala", 2600, 3400]];
  const TRABAJOS_EMPRESA = [["Climatización de oficina con 4 equipos split", 9500, 14000], ["Aire acondicionado para sala de servidores", 12000, 22000], ["Contrato anual de mantenimiento de 8 equipos", 4800, 7200], ["Equipo de techo para local comercial", 7500, 11000], ["Cortina de aire para el ingreso", 2200, 3400], ["Climatización de consultorios (3 ambientes)", 6200, 8800]];
  // Probabilidad de cerrar la venta según cómo llegó el cliente (los referidos compran más)
  const AFINIDAD = { "WhatsApp": 0.32, "Facebook / Instagram": 0.22, "Referido": 0.58, "Página web": 0.36, "Llamada": 0.4 };
  const PRIMER = { "WhatsApp": ["WhatsApp", "Escribió por WhatsApp preguntando precios"], "Facebook / Instagram": ["WhatsApp", "Respondió al anuncio de Facebook; pidió información por mensaje"], "Referido": ["Llamada", "Llamó recomendado por un cliente anterior"], "Página web": ["Correo", "Llenó el formulario de la página web"], "Llamada": ["Llamada", "Llamó a la oficina para pedir una visita técnica"] };
  const SEGUIMIENTOS = [["Llamada", "Llamé para saber si revisó la cotización; pidió unos días más"], ["WhatsApp", "Le escribí por WhatsApp; respondió que lo está evaluando con su familia"], ["WhatsApp", "Consultó por facilidades de pago; le expliqué las opciones"], ["Llamada", "No contestó; le dejé un mensaje"], ["Correo", "Envié fichas técnicas de los equipos"], ["Llamada", "Preguntó por la garantía y el tiempo de instalación"]];
  const NEGOCIA = [["Visita", "Visita técnica: se midieron los ambientes y se confirmó la potencia necesaria"], ["Llamada", "Pidió un descuento por pago al contado"], ["Visita", "Reunión con el administrador para revisar la propuesta"], ["Correo", "Envié la cotización ajustada con la nueva capacidad"]];
  const ACCIONES = { PROSPECTO: ["Llamar para coordinar visita técnica", "Enviar cotización", "Confirmar medidas del ambiente"], COTIZADO: ["Llamar para saber si revisó la cotización", "Enviar recordatorio por WhatsApp", "Resolver dudas sobre el financiamiento"], NEGOCIACION: ["Confirmar fecha de instalación", "Enviar propuesta final con descuento", "Coordinar firma del contrato"] };
  const MOTIVOS_TEMPRANO = ["No volvió a responder", "Postergó la compra"];
  const MOTIVOS_TARDE = ["Precio alto", "Eligió a la competencia", "Sin presupuesto", "Precio alto", "Postergó la compra"];

  function rucConDigito(base10) {
    const f = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < 10; i++) s += Number(base10[i]) * f[i];
    let dv = 11 - (s % 11);
    if (dv === 10) dv = 0; else if (dv === 11) dv = 1;
    return base10 + dv;
  }
  const quitarTildes = function (t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, ""); };

  function cargar(DB) {
    const azar = SQLiteDemo.semilla(20261107);
    const ent = function (a, b) { return a + Math.floor(azar() * (b - a + 1)); };
    const elegir = function (lista) { return lista[Math.floor(azar() * lista.length)]; };
    const hoy = DB.hoy(), sumar = DB.sumarDias;
    const usados = { tel: {}, ruc: {} };
    let cotizacion = 410;

    function telefono() { let t; do { t = "9" + String(ent(10000000, 99999999)); } while (usados.tel[t]); usados.tel[t] = 1; return t; }

    /** Simula la vida de una oportunidad desde su creación hasta hoy */
    function simular(clienteId, origen, empresa, creada) {
      const vendedor = elegir(DB.VENDEDORES), [titulo, min, max] = elegir(empresa ? TRABAJOS_EMPRESA : TRABAJOS_HOGAR);
      const monto = Math.round(ent(min, max) / 10) * 10;
      const id = DB.crearOportunidad({ cliente_id: clienteId, titulo: titulo, monto: monto, vendedor: vendedor, seguimiento: sumar(creada, 2), accion: elegir(ACCIONES.PROSPECTO) }, { fecha: creada, historico: true, sinGuardar: true });
      const act = function (fecha, tipo, nota) { DB.registrarActividad({ oportunidad_id: id, tipo: tipo, nota: nota, fecha: fecha }, { historico: true, sinGuardar: true }); };
      const mover = function (fecha, hacia, datos) { DB.moverEtapa(id, hacia, datos, { fecha: fecha, historico: true, sinGuardar: true }); };
      const p = PRIMER[origen];
      act(creada, p[0], p[1]);

      let t = creada, etapaActual = "PROSPECTO", ultimo = creada;
      // Algunos clientes deciden lento: sus plazos se estiran (y algunas oportunidades quedan sin atender)
      const lento = azar() < 0.3 ? 3.4 : 1, plazo = function (a, b) { return Math.round(ent(a, b) * lento); };
      const quedaAbierta = function () {
        // El seguimiento queda programado unos días después del último contacto (a veces ya pasó)
        let seg = sumar(ultimo, ent(3, 9));
        if (seg < sumar(hoy, -6) || azar() < 0.25) seg = sumar(hoy, ent(-5, 6));
        DB.ejecutar("UPDATE oportunidades SET seguimiento = ?, accion = ? WHERE id = ?", [seg, elegir(ACCIONES[etapaActual]), id]);
      };

      // 1) Cotización
      t = sumar(t, plazo(1, 5));
      if (t > hoy) return quedaAbierta();
      if (azar() < 0.12) return mover(t, "PERDIDO", { motivo: elegir(MOTIVOS_TEMPRANO) });
      cotizacion++;
      mover(t, "COTIZADO", { seguimiento: sumar(t, 3), accion: elegir(ACCIONES.COTIZADO) });
      act(t, "Cotización", "Cotización COT-" + hoy.slice(0, 4) + "-" + String(cotizacion).padStart(4, "0") + " enviada por S/ " + monto.toLocaleString("es-PE"));
      etapaActual = "COTIZADO"; ultimo = t;
      for (let k = ent(0, 2); k > 0; k--) {
        const f = sumar(t, plazo(3, 6));
        if (f > hoy) return quedaAbierta();
        const s = elegir(SEGUIMIENTOS); act(f, s[0], s[1]); t = f; ultimo = f;
      }

      // 2) Negociación (o se pierde)
      t = sumar(t, plazo(3, 10));
      if (t > hoy) return quedaAbierta();
      if (azar() > 0.35 + AFINIDAD[origen] * 0.6) return mover(t, "PERDIDO", { motivo: elegir(MOTIVOS_TARDE) });
      mover(t, "NEGOCIACION", { seguimiento: sumar(t, 3), accion: elegir(ACCIONES.NEGOCIACION) });
      const n = elegir(NEGOCIA); act(t, n[0], n[1]);
      etapaActual = "NEGOCIACION"; ultimo = t;

      // 3) Cierre
      t = sumar(t, plazo(2, 9));
      if (t > hoy) return quedaAbierta();
      if (azar() < Math.min(0.85, 0.35 + AFINIDAD[origen])) {
        const final = Math.round(monto * (1 - ent(0, 8) / 100) / 10) * 10;   // descuento negociado
        mover(t, "GANADO", { monto: final });
        act(t, "Nota", "Se coordinó la instalación con " + elegir(["el cliente", "la administración", "el encargado del local"]));
        return "GANADO";
      }
      return mover(t, "PERDIDO", { motivo: elegir(MOTIVOS_TARDE) });
    }

    const empresasUsadas = {};
    for (let i = 0; i < 72; i++) {
      const esEmpresa = azar() < 0.38;
      const nombre = elegir(NOMBRES) + " " + elegir(APELLIDOS) + " " + elegir(APELLIDOS);
      let empresa = "", ruc = null;
      if (esEmpresa) {
        let e; do { e = elegir(EMPRESAS); } while (empresasUsadas[e] && Object.keys(empresasUsadas).length < EMPRESAS.length);
        empresasUsadas[e] = 1;
        empresa = e + " " + elegir(SUFIJO);
        do { ruc = rucConDigito("20" + String(ent(10000000, 99999999))); } while (usados.ruc[ruc]);
        usados.ruc[ruc] = 1;
      }
      const origen = elegir(esEmpresa ? ["Referido", "Página web", "Llamada", "Página web", "WhatsApp"] : ["WhatsApp", "Facebook / Instagram", "WhatsApp", "Referido", "Facebook / Instagram", "Llamada"]);
      // Más clientes recientes que antiguos (el negocio está creciendo)
      const creado = sumar(hoy, -Math.floor(2 + 200 * Math.pow(azar(), 1.7)));
      const partes = quitarTildes(nombre).toLowerCase().split(" ");
      const email = azar() < (esEmpresa ? 0.95 : 0.55) ? partes[0] + "." + partes[1] + (esEmpresa ? "@" + quitarTildes(empresa.split(" ")[0]).toLowerCase() + ".com.pe" : ent(1, 99) + "@correo.pe") : "";
      const id = DB.crearCliente({ nombre: nombre, empresa: empresa, ruc: ruc, telefono: telefono(), email: email, distrito: elegir(DISTRITOS), origen: origen }, { fecha: creado, sinGuardar: true });
      const r = simular(id, origen, esEmpresa, creado);
      // Algunos clientes que ya compraron vuelven (mantenimiento, otro ambiente)
      if (r === "GANADO" && azar() < 0.45) {
        const fin = DB.uno("SELECT MAX(cerrada) AS f FROM oportunidades WHERE cliente_id = ?", [id]).f;
        const nueva = sumar(fin, ent(20, 70));
        if (nueva <= hoy) simular(id, "Referido", esEmpresa, nueva);
      }
    }

    // Un embudo sano tiene oportunidades en negociación: las cotizaciones más avanzadas pasan a esa etapa
    const enNegociacion = DB.uno("SELECT COUNT(*) AS n FROM oportunidades WHERE etapa = 'NEGOCIACION'").n;
    DB.consultar("SELECT o.id, o.seguimiento, MAX(a.fecha) AS ultima FROM oportunidades o JOIN actividades a ON a.oportunidad_id = o.id WHERE o.etapa = 'COTIZADO' GROUP BY o.id ORDER BY o.creada LIMIT ?", [Math.max(0, 6 - enNegociacion)])
      .forEach(function (o) {
        DB.moverEtapa(o.id, "NEGOCIACION", { seguimiento: o.seguimiento, accion: elegir(ACCIONES.NEGOCIACION) }, { fecha: o.ultima, historico: true, sinGuardar: true });
        const n = elegir(NEGOCIA); DB.registrarActividad({ oportunidad_id: o.id, tipo: n[0], nota: n[1], fecha: o.ultima }, { historico: true, sinGuardar: true });
        DB.ejecutar("UPDATE oportunidades SET seguimiento = ? WHERE id = ?", [o.seguimiento, o.id]);
      });

    // Que haya seguimientos programados para hoy (la agenda del día no debe quedar vacía)
    DB.consultar("SELECT id FROM oportunidades WHERE etapa IN ('PROSPECTO','COTIZADO','NEGOCIACION') AND seguimiento > ? ORDER BY seguimiento LIMIT 3", [hoy])
      .forEach(function (o) { DB.ejecutar("UPDATE oportunidades SET seguimiento = ? WHERE id = ?", [hoy, o.id]); });
  }

  return { cargar: cargar };
})();
