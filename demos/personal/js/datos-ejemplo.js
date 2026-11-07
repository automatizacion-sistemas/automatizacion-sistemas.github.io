/* ==========================================================================
   datos-ejemplo.js — Datos de demostración: "Comercial Los Andes SAC" (ficticia)
   22 trabajadores con historiales de contratos, vacaciones y legajos.
   Todas las fechas son relativas a hoy, para que siempre haya casos que
   disparen cada tipo de alerta. Nombres y DNI inventados.
   ========================================================================== */
window.DATOS_EJEMPLO = (function () {
  "use strict";

  // Patrón de contratos:
  //   ["indef"]                         → plazo indeterminado desde el ingreso
  //   ["fijo", meses, finRelativo]      → renovaciones de N meses; el último vence en finRelativo días (negativo = ya venció)
  //   ["fijo>indef", meses, añosFijo]   → plazo fijo durante N años y luego indeterminado
  //   ["formativa", meses, finRelativo] → convenio de modalidad formativa
  // Vacaciones: "al_dia" | "debe_1" (un periodo por vencer) | "vencidas" | "nuevo"
  // [dni, nombres, apellidos, nacimiento (años, mes relativo), area, cargo, pensión, ingreso (días atrás), patrón, sueldo base, vacaciones, documentos faltantes, cese]
  const P = [
    ["71000201", "Ana Lucía", "Paredes Vega", [44, 3], "Gerencia", "Gerente general", "AFP", 3900, ["indef"], 9500, "al_dia", []],
    ["71000202", "Roberto", "Salazar Núñez", [38, 0], "Administración y Finanzas", "Contador general", "AFP", 2650, ["indef"], 6200, "debe_1", []],
    ["71000203", "Diana", "Castillo Ramos", [31, 5], "Recursos Humanos", "Analista de RR. HH.", "AFP", 1460, ["fijo>indef", 12, 2], 3800, "al_dia", []],
    ["71000204", "Fernando", "Gutiérrez Lazo", [46, 7], "Administración y Finanzas", "Tesorero", "ONP", 3300, ["indef"], 4800, "vencidas", []],
    ["71000205", "Luis Alberto", "Quispe Mamani", [41, 2], "Logística", "Jefe de almacén", "AFP", 2100, ["indef"], 4200, "al_dia", []],
    ["71000206", "Kevin", "Huamán Torres", [27, 0], "Logística", "Almacenero", "AFP", 1720, ["fijo", 6, 12], 1600, "debe_1", []],
    ["71000207", "José Carlos", "Ríos Cárdenas", [33, 9], "Logística", "Almacenero", "ONP", 1700, ["fijo", 12, -6], 1650, "al_dia", []],
    ["71000208", "Miguel Ángel", "Flores Soto", [36, 4], "Logística", "Chofer repartidor", "AFP", 1150, ["fijo", 12, 140], 1130, "al_dia", ["Antecedentes policiales"]],
    ["71000209", "Brayan", "Chávez Poma", [22, 6], "Logística", "Auxiliar de almacén", "AFP", 80, ["fijo", 6, 102], 1300, "nuevo", ["Alta en T-Registro", "Elección de sistema de pensiones"]],
    ["71000210", "Rosa Elena", "Medina Cruz", [39, 0], "Ventas", "Jefa de ventas", "AFP", 1820, ["fijo", 12, 25], 5200, "al_dia", []],
    ["71000211", "Karina", "Vásquez Ortiz", [29, 8], "Ventas", "Ejecutiva comercial", "AFP", 760, ["fijo", 12, 335], 2400, "debe_1", []],
    ["71000212", "Pamela", "Ruiz Delgado", [26, 1], "Ventas", "Ejecutiva comercial", "AFP", 520, ["fijo", 6, 20], 2300, "nuevo", ["Declaración jurada de domicilio"]],
    ["71000213", "Jhon", "Espinoza Rojas", [30, 10], "Ventas", "Ejecutivo comercial", "ONP", 1020, ["fijo", 12, 75], 2350, "al_dia", []],
    ["71000214", "Milagros", "Ccori Huanca", [24, 3], "Atención al cliente", "Asistente de atención", "AFP", 400, ["fijo", 6, 9], 1130, "nuevo", []],
    ["71000215", "César Augusto", "Mendoza Gil", [35, 0], "Atención al cliente", "Supervisor", "AFP", 1180, ["fijo>indef", 12, 1], 3100, "al_dia", []],
    ["71000216", "Daniela", "Pinto Salas", [28, 11], "Atención al cliente", "Asistente de atención", "AFP", 620, ["fijo", 6, 50], 1450, "debe_1", []],
    ["71000217", "Renzo", "Aguilar Campos", [21, 2], "Ventas", "Practicante de ventas", "AFP", 160, ["formativa", 6, 23], 1230, "nuevo", ["Antecedentes policiales"]],
    ["71000218", "Gabriela", "Torres Benites", [20, 4], "Administración y Finanzas", "Practicante contable", "AFP", 70, ["formativa", 6, 112], 1230, "nuevo", []],
    ["71000219", "Andrés", "Salinas Pérez", [34, 5], "Sistemas", "Analista de sistemas", "AFP", 1790, ["fijo", 12, 0], 4300, "vencidas", []],
    ["71000220", "Lucía", "Benavides Rojas", [37, 6], "Recursos Humanos", "Jefa de RR. HH.", "AFP", 1640, ["fijo", 12, 85], 5600, "al_dia", []],
    ["71000221", "Víctor", "Paucar León", [43, 1], "Logística", "Almacenero", "ONP", 900, ["fijo", 12, -40], 1500, "al_dia", [], [-40, "Término de contrato"]],
    ["71000222", "Sofía", "Cáceres Muñoz", [29, 9], "Ventas", "Ejecutiva comercial", "AFP", 700, ["fijo", 6, -120], 2200, "al_dia", [], [-150, "Renuncia voluntaria"]]
  ];

  function cargar(DB) {
    const hoy = DB.hoy();
    const d0 = new Date(hoy + "T00:00:00");

    P.forEach(function (p) {
      const ingreso = DB.sumarDias(hoy, -p[7]);
      const nac = new Date(d0.getFullYear() - p[3][0], d0.getMonth() + p[3][1], 3 + (Number(p[0].slice(-2)) * 7) % 25);
      const nacimiento = SQLiteDemo.iso(nac);
      const patron = p[8], base = p[9];
      const contratos = [];

      if (patron[0] === "indef") {
        contratos.push({ tipo: "Plazo indeterminado", inicio: ingreso, fin: null, sueldo: base });
      } else if (patron[0] === "fijo>indef") {
        const meses = patron[1], anios = patron[2];
        let ini = ingreso, n = 0;
        const limite = DB.sumarAnios(ingreso, anios);
        while (ini < limite) {
          const fin = DB.sumarDias(DB.sumarMeses(ini, meses), -1);
          contratos.push({ tipo: "Plazo fijo", inicio: ini, fin: fin, sueldo: Math.round(base * (0.85 + 0.05 * n++)) });
          ini = DB.sumarDias(fin, 1);
        }
        contratos.push({ tipo: "Plazo indeterminado", inicio: ini, fin: null, sueldo: base });
      } else {
        // Se arma hacia atrás desde el último fin, con renovaciones de N meses, hasta el ingreso
        const meses = patron[1];
        const tipo = patron[0] === "formativa" ? "Modalidad formativa" : "Plazo fijo";
        let fin = DB.sumarDias(hoy, patron[2]);
        const tramos = [];
        while (true) {
          let ini = DB.sumarDias(DB.sumarMeses(DB.sumarDias(fin, 1), -meses), 0);
          if (ini <= ingreso) { tramos.unshift({ inicio: ingreso, fin: fin }); break; }
          tramos.unshift({ inicio: ini, fin: fin });
          fin = DB.sumarDias(ini, -1);
        }
        tramos.forEach(function (t, i) {
          // Sueldos que suben con cada renovación; los que están en la RMV antigua se quedan igual (para la alerta)
          const sueldo = base === 1130 ? 1130 : Math.round(base * (1 - 0.04 * (tramos.length - 1 - i)));
          contratos.push({ tipo: tipo, inicio: t.inicio, fin: t.fin, sueldo: sueldo });
        });
      }

      const faltan = p[11];
      const id = DB.guardarTrabajador({
        dni: p[0], nombres: p[1], apellidos: p[2], nacimiento: nacimiento, telefono: "98" + p[0].slice(1), correo: p[1].split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "." + p[2].split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@losandes.example",
        area: p[4], cargo: p[5], pension: p[6], ingreso: ingreso,
        contrato: contratos[0], documentos: DB.DOCUMENTOS.filter(function (d) { return faltan.indexOf(d) === -1; })
      }, { sinGuardar: true, sinValidarRmv: true });
      contratos.slice(1).forEach(function (c) {
        DB.registrarContrato(Object.assign({ trabajador_id: id }, c), { sinGuardar: true, sinValidar: true, sinValidarRmv: true });
      });

      // Vacaciones gozadas según el caso
      const t = { id: id, ingreso: ingreso, cese_fecha: null };
      const per = DB.vacacionesDe(t).periodos;
      per.forEach(function (pp, i) {
        const ultimo = i === per.length - 1;
        let tomar = 30;
        if (p[10] === "debe_1" && ultimo) tomar = 15;                       // le quedan 15 días del último periodo
        if (p[10] === "vencidas" && i >= per.length - 2) tomar = i === per.length - 2 ? 10 : 0; // un periodo ya venció con saldo
        if (p[10] === "al_dia" && ultimo) tomar = DB.diasEntre(pp.ganado, hoy) > 200 ? 30 : 0;
        // Se gozan en dos bloques de 15 días dentro del año siguiente al periodo
        [[60, 15], [200, 15]].forEach(function (b, k) {
          const dias = Math.min(b[1], tomar - k * 15);
          if (dias <= 0) return;
          const desde = DB.sumarDias(pp.ganado, b[0]);
          const hasta = DB.sumarDias(desde, dias - 1);
          if (hasta >= hoy) return;
          DB.ejecutar("INSERT INTO vacaciones (trabajador_id, desde, hasta, dias, observacion) VALUES (?,?,?,?,?)", [id, desde, hasta, dias, "Vacaciones programadas"]);
        });
      });

      if (p[12]) {
        const fecha = DB.sumarDias(hoy, p[12][0]);
        DB.ejecutar("UPDATE trabajadores SET cese_fecha = ?, cese_motivo = ? WHERE id = ?", [fecha, p[12][1], id]);
        DB.ejecutar("UPDATE contratos SET fin = ? WHERE trabajador_id = ? AND inicio <= ? AND (fin IS NULL OR fin > ?)", [fecha, id, fecha, fecha]);
        DB.ejecutar("DELETE FROM contratos WHERE trabajador_id = ? AND inicio > ?", [id, fecha]);
      }
    });
  }

  return { cargar: cargar };
})();
