/* ==========================================================================
   datos-ejemplo.js — Datos de demostración: "Servicios Integrales del Sur SAC"
   Empresa ficticia con 18 trabajadores, 4 áreas y 3 horarios.
   Genera marcaciones desde el inicio del antepenúltimo mes hasta hoy, con
   fechas relativas a la fecha actual. Las marcaciones de hoy se generan solo
   hasta la hora actual. Cada trabajador tiene un hábito distinto (puntual,
   normal, tardón o faltón). Todos los nombres y DNI son inventados.
   ========================================================================== */
window.DATOS_EJEMPLO = (function () {
  "use strict";

  const HORARIOS = [
    ["Administrativo", "09:00", "18:00", 60, 10, "1,2,3,4,5"],
    ["Turno mañana", "07:00", "16:00", 60, 10, "1,2,3,4,5,6"],
    ["Turno tarde", "13:00", "22:00", 60, 10, "1,2,3,4,5,6"]
  ];

  // [dni, nombre, área, cargo, horario (1-3), sueldo, hábito, días desde el ingreso (null = antiguo)]
  const PERSONAL = [
    ["70000101", "Ana Lucía Paredes Vega", "Administración", "Jefa de administración", 1, 4500, "puntual", null],
    ["70000102", "Roberto Salazar Núñez", "Administración", "Asistente contable", 1, 2200, "normal", null],
    ["70000103", "Diana Castillo Ramos", "Administración", "Asistente de RR. HH.", 1, 2100, "puntual", null],
    ["70000104", "Fernando Gutiérrez Lazo", "Administración", "Tesorero", 1, 3200, "tardon", null],
    ["70000105", "Luis Alberto Quispe Mamani", "Almacén", "Jefe de almacén", 2, 3000, "puntual", null],
    ["70000106", "Kevin Huamán Torres", "Almacén", "Almacenero", 2, 1500, "tardon", null],
    ["70000107", "José Carlos Ríos Cárdenas", "Almacén", "Almacenero", 2, 1500, "normal", null],
    ["70000108", "Miguel Ángel Flores Soto", "Almacén", "Montacarguista", 2, 1800, "faltón", null],
    ["70000109", "Brayan Chávez Poma", "Almacén", "Auxiliar de almacén", 2, 1300, "normal", 20],
    ["70000110", "Rosa Elena Medina Cruz", "Atención al cliente", "Supervisora", 2, 2600, "puntual", null],
    ["70000111", "Karina Vásquez Ortiz", "Atención al cliente", "Ejecutiva de atención", 2, 1700, "normal", null],
    ["70000112", "Pamela Ruiz Delgado", "Atención al cliente", "Ejecutiva de atención", 3, 1700, "tardon", null],
    ["70000113", "Jhon Espinoza Rojas", "Atención al cliente", "Ejecutivo de atención", 3, 1700, "normal", null],
    ["70000114", "Milagros Ccori Huanca", "Atención al cliente", "Ejecutiva de atención", 3, 1700, "puntual", null],
    ["70000115", "César Augusto Mendoza Gil", "Ventas", "Jefe de ventas", 1, 4000, "normal", null],
    ["70000116", "Daniela Pinto Salas", "Ventas", "Vendedora", 3, 1800, "puntual", null],
    ["70000117", "Renzo Aguilar Campos", "Ventas", "Vendedor", 3, 1800, "faltón", null],
    ["70000118", "Gabriela Torres Benites", "Ventas", "Vendedora", 1, 1900, "normal", null]
  ];

  function cargar(DB) {
    const azar = SQLiteDemo.semilla(20261107);
    const hoy = DB.hoy();
    const ahora = DB.ahoraMin();
    const d0 = new Date(hoy + "T00:00:00");
    const inicio = DB.iso(new Date(d0.getFullYear(), d0.getMonth() - 2, 1));
    const antiguo = DB.sumarDias(inicio, -400);

    HORARIOS.forEach(function (h) {
      DB.ejecutar("INSERT INTO horarios (nombre, entrada, salida, refrigerio_min, tolerancia_min, dias) VALUES (?,?,?,?,?,?)", h);
    });
    const ids = PERSONAL.map(function (p) {
      return DB.guardarTrabajador({ dni: p[0], nombre: p[1], area: p[2], cargo: p[3], horario_id: p[4], sueldo: p[5], ingreso: p[7] ? DB.sumarDias(hoy, -p[7]) : antiguo });
    });

    // Permisos: vacaciones en curso, un descanso médico, un permiso y una licencia sin goce
    const permisos = [
      [2, "Vacaciones", -6, 8, "Vacaciones programadas"],
      [12, "Descanso médico", -38, -36, "Certificado médico presentado"],
      [6, "Permiso con goce", -17, -17, "Trámite personal"],
      [16, "Licencia sin goce", -25, -24, "Solicitud del trabajador"],
      [9, "Vacaciones", -55, -49, "Vacaciones"]
    ];
    permisos.forEach(function (p) {
      DB.registrarPermiso({ trabajador_id: ids[p[0]], tipo: p[1], desde: DB.sumarDias(hoy, p[2]), hasta: DB.sumarDias(hoy, p[3]), observacion: p[4], sinGuardar: true });
    });
    const enPermiso = function (i, f) {
      return permisos.some(function (p) { return p[0] === i && DB.sumarDias(hoy, p[2]) <= f && f <= DB.sumarDias(hoy, p[3]); });
    };

    const marcas = [];
    for (let f = inicio; f <= hoy; f = DB.sumarDias(f, 1)) {
      const dia = DB.diaSemana(f);
      PERSONAL.forEach(function (p, i) {
        const h = HORARIOS[p[4] - 1];
        const ingreso = p[7] ? DB.sumarDias(hoy, -p[7]) : antiguo;
        if (f < ingreso || h[5].split(",").indexOf(String(dia)) === -1 || enPermiso(i, f)) return;
        const hab = p[6];
        if (hab === "faltón" && azar() < 0.07) return;
        if (hab !== "faltón" && azar() < 0.008) return;

        // Hora de llegada según el hábito
        let llegada = DB.aMin(h[1]);
        const r = azar();
        if (hab === "puntual") llegada += Math.round(-18 + r * 24);
        else if (hab === "normal") llegada += r < 0.12 ? Math.round(11 + azar() * 16) : Math.round(-15 + r * 22);
        else if (hab === "tardon") llegada += r < 0.35 ? Math.round(11 + azar() * 38) : Math.round(-8 + r * 16);
        else llegada += r < 0.2 ? Math.round(11 + azar() * 25) : Math.round(-10 + r * 18);

        // Hora de salida: normalmente poco después del fin; a veces horas extra
        let salida = DB.aMin(h[2]) + Math.round(-1 + azar() * 20);
        if (azar() < 0.07) salida += Math.round(60 + azar() * 90);

        const esHoy = f === hoy;
        if (esHoy && llegada > ahora) return;              // todavía no llega
        const m = { trabajador_id: ids[i], fecha: f, entrada: DB.aHora(llegada), salida: DB.aHora(salida) };
        if (esHoy && salida > ahora) m.salida = null;       // sigue en jornada
        if (!esHoy && azar() < 0.01) m.salida = null;       // olvidó marcar la salida
        if (!esHoy && azar() < 0.01) { m.origen = "Corrección"; m.observacion = "Falla del marcador; validado por el jefe inmediato"; }
        marcas.push(m);
      });
    }
    DB.insertarMarcacionesEnLote(marcas);
  }

  return { cargar: cargar };
})();
