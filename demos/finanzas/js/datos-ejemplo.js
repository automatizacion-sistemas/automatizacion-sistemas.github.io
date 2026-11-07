/* ==========================================================================
   datos-ejemplo.js — Datos de demostración: "Pastelería Dulce Hogar" (ficticia)
   Emprendimiento con caja, cuenta bancaria y Yape. Genera 12 meses completos
   más el mes en curso, con estacionalidad (Día de la Madre, Fiestas Patrias,
   Navidad), gratificaciones en julio y diciembre, depósitos de caja al banco y
   retiros personales de la dueña (el caso típico de mezclar dinero del negocio
   con el de la casa). Las salidas nunca dejan una cuenta en negativo.
   ========================================================================== */
window.DATOS_EJEMPLO = (function () {
  "use strict";

  const CATEGORIAS = [
    ["Ventas en tienda", "INGRESO", 0], ["Pedidos por encargo", "INGRESO", 0], ["Ventas por aplicativos", "INGRESO", 0], ["Otros ingresos", "INGRESO", 0],
    ["Insumos y materia prima", "GASTO", 10500], ["Alquiler del local", "GASTO", 2500], ["Planilla", "GASTO", 4900], ["Servicios (luz, agua, gas, internet)", "GASTO", 850],
    ["Empaques", "GASTO", 650], ["Publicidad", "GASTO", 450], ["Movilidad y delivery", "GASTO", 360], ["Mantenimiento", "GASTO", 300],
    ["Comisiones bancarias y de apps", "GASTO", 900], ["Impuestos", "GASTO", 700],
    ["Retiros de la dueña", "RETIRO", 0]
  ];
  const REGLAS = [
    ["APP DELIVERY", "Ventas por aplicativos"], ["PEDIDO", "Pedidos por encargo"], ["INTERNET", "Servicios (luz, agua, gas, internet)"], ["ELECTRICIDAD", "Servicios (luz, agua, gas, internet)"],
    ["AGUA POTABLE", "Servicios (luz, agua, gas, internet)"], ["GAS NATURAL", "Servicios (luz, agua, gas, internet)"], ["MAYORISTA", "Insumos y materia prima"], ["INSUMOS", "Insumos y materia prima"],
    ["COMISION", "Comisiones bancarias y de apps"], ["PUBLICIDAD", "Publicidad"], ["RETIRO CAJERO", "Retiros de la dueña"], ["EMPAQUES", "Empaques"],
    ["ALQUILER", "Alquiler del local"], ["PLANILLA", "Planilla"], ["IMPUESTO", "Impuestos"], ["MOVILIDAD", "Movilidad y delivery"]
  ];
  // Factor de ventas por mes (enero = 0): Día de la Madre, Fiestas Patrias y Navidad venden más
  const ESTACION = [0.9, 0.85, 0.95, 1, 1.25, 1, 1.12, 1, 0.95, 1, 1.05, 1.45];

  function cargar(DB) {
    const azar = SQLiteDemo.semilla(20261107);
    const hoy = DB.hoy();
    const d0 = new Date(hoy + "T00:00:00");
    const inicio = DB.iso(new Date(d0.getFullYear() - 1, d0.getMonth(), 1));
    const entre = function (a, b) { return Math.round((a + azar() * (b - a)) * 10) / 10; };

    // Cuentas
    [["Caja (efectivo)", 900], ["Banco", 14000], ["Yape", 250]].forEach(function (c) { DB.ejecutar("INSERT INTO cuentas (nombre, saldo_inicial) VALUES (?,?)", c); });
    const CAJA = 1, BANCO = 2, YAPE = 3;
    const saldo = { 1: 900, 2: 14000, 3: 250 };
    const cat = {};
    CATEGORIAS.forEach(function (c) { DB.ejecutar("INSERT INTO categorias (nombre, tipo, presupuesto) VALUES (?,?,?)", c); cat[c[0]] = DB.uno("SELECT last_insert_rowid() AS id").id; });
    REGLAS.forEach(function (r) { DB.ejecutar("INSERT INTO reglas (palabra, categoria_id) VALUES (?,?)", [r[0], cat[r[1]]]); });

    const st = DB.preparar("INSERT INTO movimientos (fecha, tipo, categoria_id, cuenta_id, cuenta_destino_id, monto, descripcion, comprobante) VALUES (?,?,?,?,?,?,?,?)");
    const mov = function (fecha, tipo, categoria, cuenta, monto, desc, comp, destino) {
      monto = Math.round(monto * 100) / 100;
      if (monto <= 0) return false;
      if (tipo !== "INGRESO" && saldo[cuenta] < monto) {
        // Si la cuenta no alcanza, se intenta pagar desde el banco; si tampoco, se omite
        if (tipo === "GASTO" && cuenta !== BANCO && saldo[BANCO] >= monto) cuenta = BANCO; else return false;
      }
      st.run([fecha, tipo, categoria ? cat[categoria] : null, cuenta, destino || null, monto, desc, comp || "Sin comprobante"]);
      if (tipo === "INGRESO") saldo[cuenta] += monto; else saldo[cuenta] -= monto;
      if (destino) saldo[destino] += monto;
      return true;
    };

    try {
      let ventasMesAnterior = 30000;
      let ventasMes = 0, mesActual = inicio.slice(0, 7);
      for (let f = inicio; f <= hoy; f = DB.sumarDias(f, 1)) {
        const d = new Date(f + "T00:00:00"), dia = d.getDate(), dow = d.getDay(), mes = d.getMonth();
        const ultimoDia = new Date(d.getFullYear(), mes + 1, 0).getDate();
        if (f.slice(0, 7) !== mesActual) { ventasMesAnterior = ventasMes; ventasMes = 0; mesActual = f.slice(0, 7); }
        const k = ESTACION[mes] * (dow === 6 ? 1.35 : dow === 0 ? 1.15 : 1);

        // --- Ingresos del día
        const efectivo = entre(330, 620) * k, yape = entre(140, 300) * k;
        mov(f, "INGRESO", "Ventas en tienda", CAJA, efectivo, "Ventas del día en efectivo", "Boleta");
        mov(f, "INGRESO", "Ventas en tienda", YAPE, yape, "Ventas del día por Yape", "Boleta");
        ventasMes += efectivo + yape;
        if (azar() < 0.28 * ESTACION[mes]) {
          const p = entre(150, 620);
          mov(f, "INGRESO", "Pedidos por encargo", azar() < 0.5 ? BANCO : YAPE, p, "PEDIDO torta personalizada", "Boleta"); ventasMes += p;
        }
        if (dow === 1) { // abono semanal de las apps de delivery y su comisión
          const bruto = entre(650, 1150) * ESTACION[mes];
          mov(f, "INGRESO", "Ventas por aplicativos", BANCO, bruto, "ABONO APP DELIVERY semanal", "Boleta");
          mov(f, "GASTO", "Comisiones bancarias y de apps", BANCO, bruto * 0.2, "COMISION app de delivery (20 %)", "Factura");
          ventasMes += bruto;
        }

        // --- Gastos
        if (dow === 1 || dow === 3 || dow === 5) mov(f, "GASTO", "Insumos y materia prima", azar() < 0.45 ? CAJA : BANCO, entre(650, 980) * ESTACION[mes], "Compra MAYORISTA insumos (harina, azúcar, mantequilla)", "Factura");
        if (dia === 3 || dia === 17) mov(f, "GASTO", "Empaques", BANCO, entre(260, 340) * ESTACION[mes], "Pago proveedor EMPAQUES y cajas", "Factura");
        if (dia === 5) mov(f, "GASTO", "Alquiler del local", BANCO, 2500, "Pago ALQUILER del local", "Factura");
        if (dia === 18) {
          mov(f, "GASTO", "Servicios (luz, agua, gas, internet)", BANCO, entre(360, 520), "Pago ELECTRICIDAD", "Boleta");
          mov(f, "GASTO", "Servicios (luz, agua, gas, internet)", BANCO, entre(110, 150), "Pago AGUA POTABLE", "Boleta");
          mov(f, "GASTO", "Servicios (luz, agua, gas, internet)", BANCO, entre(130, 170), "Pago GAS NATURAL", "Boleta");
          mov(f, "GASTO", "Servicios (luz, agua, gas, internet)", BANCO, 99.9, "Pago INTERNET fibra", "Boleta");
        }
        if (dia === 15) {
          mov(f, "GASTO", "Impuestos", BANCO, ventasMesAnterior * 0.022, "Pago IMPUESTO mensual (renta y otros)", "Sin comprobante");
          if (mes === 6 || mes === 11) mov(f, "GASTO", "Planilla", BANCO, 4650 * 1.09, "PLANILLA: gratificación " + (mes === 6 ? "de julio" : "de diciembre") + " + bonificación 9 %", "Sin comprobante");
        }
        if (dia === ultimoDia) {
          mov(f, "GASTO", "Planilla", BANCO, 4650, "PLANILLA del mes (3 trabajadores)", "Sin comprobante");
          mov(f, "GASTO", "Comisiones bancarias y de apps", BANCO, 18, "COMISION mantenimiento de cuenta", "Sin comprobante");
        }
        if (dia === 8) mov(f, "GASTO", "Publicidad", BANCO, entre(280, 480) * (mes === 4 || mes === 11 ? 1.4 : 1), "PUBLICIDAD en redes sociales", "Factura");
        if (dow === 4) mov(f, "GASTO", "Movilidad y delivery", CAJA, entre(70, 120), "MOVILIDAD para entregas", "Sin comprobante");
        if (azar() < 0.04) mov(f, "GASTO", "Mantenimiento", CAJA, entre(80, 420), "Mantenimiento de horno y equipos", "Boleta");

        // --- Retiros personales de la dueña (lo que se mezcla con la casa)
        if (azar() < 0.3) {
          const motivos = ["Gastos de la casa", "Mercado de la semana", "Compras personales", "Pago de tarjeta personal", "Salida familiar"];
          mov(f, "RETIRO", "Retiros de la dueña", azar() < 0.6 ? CAJA : YAPE, entre(120, 640), motivos[Math.floor(azar() * motivos.length)], "Sin comprobante");
        }
        if (dia === 1) mov(f, "RETIRO", "Retiros de la dueña", BANCO, 1800, "Alquiler de la casa", "Sin comprobante");
        if (dia === 10 && mes >= 2 && mes <= 11) mov(f, "RETIRO", "Retiros de la dueña", BANCO, 950, "Pensión del colegio de los hijos", "Sin comprobante");
        if (dia === 7 && mes === 2) mov(f, "RETIRO", "Retiros de la dueña", BANCO, 2600, "Útiles y uniformes escolares", "Sin comprobante");
        if (dia === 20 && mes === 11) mov(f, "RETIRO", "Retiros de la dueña", BANCO, 3200, "Regalos y cena de Navidad", "Sin comprobante");
        if (dia === 26 && mes === 6) mov(f, "RETIRO", "Retiros de la dueña", BANCO, 1900, "Viaje familiar de Fiestas Patrias", "Sin comprobante");

        // --- Depósitos: el efectivo y el Yape se pasan al banco
        if (dow === 6 && saldo[CAJA] > 1200) mov(f, "TRANSFERENCIA", null, CAJA, Math.floor((saldo[CAJA] - 800) / 100) * 100, "Depósito de caja al banco", "Sin comprobante", BANCO);
        if (saldo[YAPE] > 1800) mov(f, "TRANSFERENCIA", null, YAPE, Math.floor((saldo[YAPE] - 300) / 100) * 100, "Paso de Yape al banco", "Sin comprobante", BANCO);
      }
    } finally {
      st.free();
    }
  }

  /** Extracto bancario de ejemplo para probar la importación (CSV con punto y coma) */
  function extractoEjemplo(DB) {
    const h = DB.hoy();
    const f = function (dias) { return DB.sumarDias(h, -dias).split("-").reverse().join("/"); };
    // Dos líneas que ya están registradas: la importación debe marcarlas como duplicadas
    const ya = DB.consultar("SELECT fecha, tipo, monto, descripcion FROM movimientos WHERE cuenta_id = 2 AND tipo IN ('INGRESO','GASTO') ORDER BY fecha DESC, id DESC LIMIT 2");
    const lineas = ["Fecha;Descripción;Monto"];
    ya.forEach(function (m) { lineas.push(m.fecha.split("-").reverse().join("/") + ";" + m.descripcion + ";" + (m.tipo === "INGRESO" ? "" : "-") + m.monto.toFixed(2).replace(".", ",")); });
    lineas.push(
      f(4) + ";TRANSF RECIBIDA PEDIDO TORTA BODAS;850,00",
      f(4) + ";PAGO PROVEEDOR EMPAQUES BIODEGRADABLES;-312,40",
      f(3) + ";COMPRA MAYORISTA INSUMOS CHOCOLATE;-736,90",
      f(3) + ";RETIRO CAJERO AG. MIRAFLORES;-300,00",
      f(2) + ";COMISION INTERPLAZA;-7,50",
      f(2) + ";PAGO PUBLICIDAD REDES CAMPAÑA NAVIDAD;-420,00",
      f(1) + ";ABONO APP DELIVERY SEMANA 45;1.026,30",
      f(1) + ";CARGO SUSCRIPCION SOFTWARE DISEÑO;-59,90",
      f(1) + ";TRANSF RECIBIDA CLIENTE CORPORATIVO;1.480,00"
    );
    return lineas.join("\n");
  }

  return { cargar: cargar, extractoEjemplo: extractoEjemplo };
})();
