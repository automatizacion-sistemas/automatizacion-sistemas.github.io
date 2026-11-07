/* ==========================================================================
   datos-ejemplo.js — Datos de demostración: "Distribuidora Andina" (ficticia)
   Proveedor de útiles de oficina y limpieza con 16 clientes ficticios.
   Genera 6 meses de ventas y cobros con fechas relativas a hoy. Cada cliente
   tiene un hábito de pago distinto (puntual, tardío o moroso), para que el
   reporte de antigüedad de saldos muestre casos reales de cobranza.
   Todos los nombres, documentos y teléfonos son inventados.
   ========================================================================== */
window.DATOS_EJEMPLO = (function () {
  "use strict";

  // [documento, nombre, celular, días de crédito, línea de crédito, ventas al mes, ticket mín., ticket máx., hábito, % crédito]
  const CLIENTES = [
    ["20999000011", "Constructora Horizonte EIRL", "987100201", 30, 15000, 4, 600, 2400, "puntual", 0.9],
    ["20999000029", "Estudio Contable Ramírez & Asociados SAC", "987100202", 30, 6000, 3, 250, 900, "puntual", 0.85],
    ["20999000037", "Clínica Dental Sonrisa Feliz SAC", "987100203", 30, 5000, 2, 300, 1100, "tarde", 0.9],
    ["20999000045", "Colegio Particular Nuevo Amanecer SRL", "987100204", 45, 20000, 3, 900, 3800, "tarde", 1],
    ["20999000053", "Restaurante El Buen Sabor SAC", "987100205", 15, 3000, 4, 150, 600, "puntual", 0.6],
    ["20999000061", "Transportes Rápido Sur SAC", "987100206", 30, 8000, 2, 400, 1600, "moroso", 0.95],
    ["20999000070", "Inmobiliaria Los Cedros SAC", "987100207", 60, 12000, 1, 1500, 4500, "tarde", 1],
    ["20999000088", "Ferretería Los Pinos EIRL", "987100208", 30, 4000, 3, 200, 900, "moroso", 0.8],
    ["20999000096", "Agencia de Viajes Mundo Andino SAC", "987100209", 30, 3500, 2, 180, 700, "puntual", 0.7],
    ["20999000100", "Laboratorio Clínico Vida Sana SAC", "987100210", 30, 9000, 3, 500, 1900, "puntual", 0.9],
    ["10999000117", "Patricia Huamán Soto (consultora)", "987100211", 15, 1500, 2, 120, 450, "tarde", 0.5],
    ["10999000125", "Miguel Torres Paredes (taller)", "987100212", 15, 1200, 2, 90, 380, "moroso", 0.6],
    ["45000112", "María Quispe Flores", "987100213", 0, 0, 2, 40, 180, "puntual", 0],
    ["45000121", "Carlos Rojas Medina", "987100214", 0, 0, 1, 60, 220, "puntual", 0],
    ["45000130", "Lucía Fernández Chávez", "987100215", 0, 0, 2, 35, 160, "puntual", 0],
    ["45000149", "Jorge Mendoza Ríos", "987100216", 0, 0, 1, 50, 250, "puntual", 0]
  ];

  const DESCRIPCIONES = [
    "Útiles de oficina — pedido mensual", "Papel bond A4 75 g (cajas)", "Productos de limpieza e higiene",
    "Tóner y suministros de impresión", "Archivadores y material de archivo", "Artículos de cafetería",
    "Útiles escolares y material didáctico", "Bolsas, guantes y descartables", "Cuadernos y block corporativos"
  ];
  const MEDIOS = ["Transferencia", "Transferencia", "Yape/Plin", "Depósito", "Efectivo"];

  function cargar(DB) {
    const azar = SQLiteDemo.semilla(20261107);
    const hoy = DB.hoy();
    const DIAS = 180;
    const ventas = [];

    // 1. Clientes
    const ids = CLIENTES.map(function (c) {
      return DB.guardarCliente({ documento: c[0], nombre: c[1], telefono: c[2], dias_credito: c[3], limite_credito: c[4] });
    });

    // 2. Ventas día por día (los domingos no hay ventas)
    for (let d = DIAS; d >= 0; d--) {
      const fecha = SQLiteDemo.sumarDias(hoy, -d);
      if (new Date(fecha + "T00:00:00").getDay() === 0) continue;
      CLIENTES.forEach(function (c, i) {
        if (azar() > c[5] / 26) return; // probabilidad diaria según ventas al mes
        const total = Math.round((c[6] + azar() * (c[7] - c[6])) * 10) / 10;
        const tieneRuc = c[0].length === 11;
        const credito = c[3] > 0 && azar() < c[9];
        ventas.push({
          cliente_id: ids[i], habito: c[8], dias_credito: c[3], fecha: fecha,
          comprobante: tieneRuc ? "FACTURA" : "BOLETA",
          condicion: credito ? "CREDITO" : "CONTADO",
          medio: MEDIOS[Math.floor(azar() * MEDIOS.length)],
          descripcion: DESCRIPCIONES[Math.floor(azar() * DESCRIPCIONES.length)],
          total: total
        });
      });
    }

    // 3. Registro de ventas y, según el hábito de cada cliente, de sus cobros
    const cobros = [];
    ventas.forEach(function (v) {
      const r = DB.registrarVenta(v, { sinValidar: true, sinGuardar: true });
      if (v.condicion !== "CREDITO") return;
      const vence = SQLiteDemo.sumarDias(v.fecha, v.dias_credito);
      let atraso;
      if (v.habito === "puntual") atraso = Math.round(-5 + azar() * 8);         // entre 5 días antes y 3 después
      else if (v.habito === "tarde") atraso = Math.round(8 + azar() * 35);       // entre 8 y 43 días tarde
      else atraso = azar() < 0.45 ? null : Math.round(20 + azar() * 70);        // moroso: a veces no paga
      if (atraso === null) return;
      const fechaPago = SQLiteDemo.sumarDias(vence, atraso);
      const medio = MEDIOS[Math.floor(azar() * 4)];
      // Algunos clientes pagan en dos partes
      if (azar() < 0.25) {
        const parcial = Math.round(v.total * (0.4 + azar() * 0.2) * 10) / 10;
        const fechaParcial = SQLiteDemo.sumarDias(fechaPago, -Math.round(5 + azar() * 10));
        cobros.push({ venta_id: r.id, fecha: fechaParcial < v.fecha ? v.fecha : fechaParcial, monto: parcial, medio: medio, operacion: String(100000 + Math.floor(azar() * 899999)) });
        cobros.push({ venta_id: r.id, fecha: fechaPago, monto: Math.round((v.total - parcial) * 100) / 100, medio: medio, operacion: String(100000 + Math.floor(azar() * 899999)), resto: true });
      } else {
        cobros.push({ venta_id: r.id, fecha: fechaPago, monto: v.total, medio: medio, operacion: medio === "Efectivo" ? "" : String(100000 + Math.floor(azar() * 899999)) });
      }
    });

    // 4. Solo se registran los cobros cuya fecha ya pasó
    cobros.sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).forEach(function (c) {
      if (c.fecha <= hoy) DB.registrarCobro(c, { sinValidar: true, sinGuardar: true });
    });
  }

  return { cargar: cargar };
})();
