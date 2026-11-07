/* ==========================================================================
   datos-ejemplo.js — Datos de demostración: una ferretería ficticia
   Genera 22 productos y ~90 días de compras y ventas con fechas relativas a
   hoy, para que el dashboard siempre muestre información reciente.
   La simulación es determinística: al restablecer la demo se obtienen
   exactamente los mismos datos.
   ========================================================================== */
window.DATOS_EJEMPLO = (function () {
  "use strict";

  // [código, nombre, categoría, unidad, costo, precio, stock mínimo, ventas diarias promedio, ¿termina con stock bajo?]
  const PRODUCTOS = [
    ["HER-001", "Martillo de uña 16 oz", "Herramientas", "Unidad", 18.5, 29.9, 6, 0.8, false],
    ["HER-002", "Destornillador plano 6\"", "Herramientas", "Unidad", 6.2, 10.5, 10, 1.4, false],
    ["HER-003", "Alicate universal 8\"", "Herramientas", "Unidad", 14.8, 24.9, 6, 0.7, true],
    ["HER-004", "Wincha 5 m", "Herramientas", "Unidad", 9.5, 16.9, 8, 1.1, false],
    ["HER-005", "Llave francesa 10\"", "Herramientas", "Unidad", 22.0, 35.9, 4, 0.4, false],
    ["ELE-001", "Cable vulcanizado 2x14 AWG", "Electricidad", "Metro", 2.1, 3.5, 100, 14, false],
    ["ELE-002", "Foco LED 9 W luz blanca", "Electricidad", "Unidad", 3.8, 6.9, 30, 4.5, true],
    ["ELE-003", "Tomacorriente doble", "Electricidad", "Unidad", 5.4, 9.5, 15, 1.8, false],
    ["ELE-004", "Interruptor simple", "Electricidad", "Unidad", 4.2, 7.5, 15, 1.6, false],
    ["ELE-005", "Cinta aislante 18 mm", "Electricidad", "Unidad", 1.6, 3.0, 25, 3.2, false],
    ["GAS-001", "Tubo PVC 1/2\" x 5 m", "Gasfitería", "Unidad", 6.5, 10.9, 12, 1.5, false],
    ["GAS-002", "Codo PVC 1/2\"", "Gasfitería", "Unidad", 0.6, 1.2, 50, 6, false],
    ["GAS-003", "Llave de paso 1/2\"", "Gasfitería", "Unidad", 11.5, 19.9, 6, 0.6, true],
    ["GAS-004", "Cinta teflón", "Gasfitería", "Unidad", 0.9, 2.0, 40, 4, false],
    ["PIN-001", "Pintura látex blanco 1 gal", "Pinturas", "Galón", 32.0, 49.9, 8, 0.9, false],
    ["PIN-002", "Brocha 3\"", "Pinturas", "Unidad", 4.5, 8.5, 12, 1.3, false],
    ["PIN-003", "Rodillo 9\"", "Pinturas", "Unidad", 9.8, 16.5, 6, 0.6, false],
    ["PIN-004", "Thinner acrílico 1 L", "Pinturas", "Litro", 7.2, 12.0, 10, 1.2, true],
    ["FER-001", "Clavos de 2\"", "Ferretería general", "Kilogramo", 5.8, 9.0, 15, 2.2, false],
    ["FER-002", "Tornillos autorroscantes x100", "Ferretería general", "Caja", 8.5, 14.9, 8, 0.9, false],
    ["FER-003", "Candado 40 mm", "Ferretería general", "Unidad", 12.5, 21.9, 5, 0.5, false],
    ["FER-004", "Silicona transparente 280 ml", "Ferretería general", "Unidad", 8.9, 14.5, 10, 1.1, false]
  ];

  // Generador de números pseudoaleatorios con semilla (mismos datos cada vez)
  function semilla(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function cargar(DB) {
    const azar = semilla(20261107);
    const DIAS = 90;
    const hoy = new Date(DB.hoy() + "T00:00:00");
    const fecha = function (haceDias) { const d = new Date(hoy); d.setDate(d.getDate() - haceDias); return DB.iso(d); };
    let boleta = 1200, factura = 340;
    const lote = []; // todos los movimientos se insertan juntos al final

    // (la carga ocurre dentro de una transacción abierta por sqlite.js)
    {
      PRODUCTOS.forEach(function (p) {
        const id = DB.guardarProducto({ codigo: p[0], nombre: p[1], categoria: p[2], unidad: p[3], precio_venta: p[5], stock_minimo: p[6] });
        const costoBase = p[4], minimo = p[6], ritmo = p[7], terminaBajo = p[8];

        // Inventario inicial
        let stock = Math.round(minimo * 3 + ritmo * 12);
        lote.push({ producto_id: id, fecha: fecha(DIAS), tipo: "ENTRADA", motivo: "Inventario inicial", cantidad: stock, costo_unitario: costoBase, referencia: "Inventario inicial" });

        let pedidoPendiente = 0; // días que faltan para que llegue la compra
        for (let d = DIAS - 1; d >= 0; d--) {
          // Llega una compra pedida días atrás (el costo varía ±6 %)
          if (pedidoPendiente > 0 && --pedidoPendiente === 0) {
            const cant = Math.round(minimo * 2.5 + ritmo * 10);
            const costo = Math.round(costoBase * (0.95 + azar() * 0.12) * 100) / 100;
            lote.push({ producto_id: id, fecha: fecha(d), tipo: "ENTRADA", motivo: "Compra", cantidad: cant, costo_unitario: costo, referencia: "F001-" + String(++factura).padStart(6, "0") });
            stock += cant;
          }
          // Ventas del día (los domingos se vende menos)
          const domingo = new Date(fecha(d) + "T00:00:00").getDay() === 0;
          let venta = Math.round(ritmo * (domingo ? 0.4 : 1) * (0.3 + azar() * 1.4));
          venta = Math.min(venta, stock);
          if (venta > 0) {
            lote.push({ producto_id: id, fecha: fecha(d), tipo: "SALIDA", motivo: "Venta", cantidad: venta, referencia: "B001-" + String(++boleta).padStart(6, "0") });
            stock -= venta;
          }
          // Mermas ocasionales
          if (azar() < 0.012 && stock > 2) {
            lote.push({ producto_id: id, fecha: fecha(d), tipo: "SALIDA", motivo: "Merma", cantidad: 1, referencia: "Producto dañado" });
            stock -= 1;
          }
          // Si el stock baja del mínimo × 1,5 se hace un pedido (llega en 2-4 días).
          // Algunos productos dejan de reponerse en las últimas 5 semanas para que aparezcan alertas.
          const reponer = !(terminaBajo && d < 34);
          if (reponer && pedidoPendiente === 0 && stock <= minimo * 1.5) pedidoPendiente = 2 + Math.floor(azar() * 3);
        }
      });
      // La simulación ya garantiza que el stock nunca sea negativo
      DB.insertarMovimientosEnLote(lote);
    }
  }

  return { cargar: cargar };
})();
