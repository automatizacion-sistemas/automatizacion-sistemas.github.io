/* ==========================================================================
   proyectos.js — Datos de las tarjetas del portafolio
   Para agregar o editar un proyecto, modifica solo esta lista.

   estado:
     "disponible"  → la demo funciona: se activa "Ver demostración" (usa "demo")
     "desarrollo"  → la demo se está construyendo
     "proximamente"→ aún no se construye
   captura: imagen real en assets/img/capturas/. Si falta, se dibuja una vista ilustrativa.
   vista:   tipo de vista ilustrativa ("barras", "tabla", "calendario", "personas", "linea", "embudo", "excel", "pdf")
   ========================================================================== */
window.PROYECTOS = [
  {
    id: "inventarios",
    titulo: "Sistema de control de inventarios",
    categoria: "sistemas",
    estado: "disponible",
    demo: "demos/inventario/",
    captura: "assets/img/capturas/inventarios.webp",
    vista: "barras",
    problema: "Para negocios que controlan su stock en cuadernos o planillas sueltas y se enteran tarde de los faltantes.",
    funciones: ["Entradas y salidas con kardex automático", "Alertas de stock mínimo", "Dashboard de valor y rotación", "Exportación a Excel"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Sistemas de control administrativo"
  },
  {
    id: "ventas",
    titulo: "Sistema de ventas y cobranzas",
    categoria: "sistemas",
    estado: "disponible",
    demo: "demos/ventas/",
    captura: "assets/img/capturas/ventas.webp",
    vista: "linea",
    problema: "Para empresas que no saben con certeza cuánto les deben ni qué cobros vencen esta semana.",
    funciones: ["Facturas y boletas al contado o al crédito, con IGV", "Cuentas por cobrar por antigüedad de saldos", "Recordatorios de cobranza por WhatsApp", "Estado de cuenta por cliente y exportación a Excel"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Desarrollo de sistemas web personalizados"
  },
  {
    id: "asistencia",
    titulo: "Sistema de control de asistencia",
    categoria: "sistemas",
    estado: "disponible",
    demo: "demos/asistencia/",
    captura: "assets/img/capturas/asistencia.webp",
    vista: "calendario",
    problema: "Para negocios que registran entradas y salidas en papel y calculan tardanzas a mano a fin de mes.",
    funciones: ["Marcación con DNI y la hora real", "Tardanzas y faltas calculadas con tolerancia", "Registro mensual con correcciones, vacaciones y permisos", "Reporte para planillas con descuentos y Excel"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Sistemas de control administrativo"
  },
  {
    id: "personal",
    titulo: "Sistema de gestión de personal",
    categoria: "sistemas",
    estado: "disponible",
    demo: "demos/personal/",
    captura: "assets/img/capturas/personal.webp",
    vista: "personas",
    problema: "Para empresas con legajos dispersos, contratos que vencen sin aviso y vacaciones que se acumulan hasta generar contingencias.",
    funciones: ["Legajo digital con documentos pendientes", "Alertas de contratos por vencer y del límite de 5 años a plazo fijo", "Récord vacacional con periodos vencidos", "Control de la RMV vigente y exportación a Excel"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Sistemas de control administrativo"
  },
  {
    id: "finanzas",
    titulo: "Control de ingresos y gastos",
    categoria: "sistemas",
    estado: "disponible",
    demo: "demos/finanzas/",
    captura: "assets/img/capturas/finanzas.webp",
    vista: "barras",
    problema: "Para emprendedores que mezclan el dinero del negocio con el personal y no saben cuánto ganan realmente.",
    funciones: ["Utilidad real con los retiros personales separados", "Estado de resultados mensual y presupuesto", "Importación de extractos con categorización automática", "Saldos de caja, banco y Yape"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Dashboards e indicadores empresariales"
  },
  {
    id: "clientes",
    titulo: "Seguimiento de clientes",
    categoria: "sistemas",
    estado: "disponible",
    demo: "demos/clientes/",
    captura: "assets/img/capturas/clientes.webp",
    vista: "embudo",
    problema: "Para negocios que pierden ventas porque no recuerdan a quién cotizaron ni cuándo volver a llamar.",
    funciones: ["Embudo de ventas: arrastra cada cotización a su etapa", "Agenda diaria con seguimientos vencidos", "Historial de contactos y mensajes de WhatsApp listos", "Reportes de conversión y motivos de pérdida"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Digitalización de procesos empresariales"
  },
  {
    id: "excel",
    titulo: "Automatización de Excel con Python",
    categoria: "automatizacion",
    estado: "disponible",
    demo: "demos/excel/",
    captura: "assets/img/capturas/excel.webp",
    vista: "excel",
    problema: "Para equipos que pasan horas copiando y pegando datos entre varios Excel para armar un consolidado.",
    funciones: ["Consolida los Excel de todas las sucursales en segundos", "Entiende formatos distintos, limpia y valida los datos", "Genera el reporte con formato, fórmulas y gráfico", "Se ejecuta con doble clic (y aquí, en tu navegador)"],
    tecnologias: ["Python", "openpyxl"],
    servicio: "Automatización de Excel"
  },
  {
    id: "pdf",
    titulo: "Generador automático de documentos PDF",
    categoria: "automatizacion",
    estado: "disponible",
    demo: "demos/pdf/",
    captura: "assets/img/capturas/pdf.webp",
    vista: "pdf",
    problema: "Para oficinas que redactan uno por uno contratos, constancias o cartas que siempre tienen el mismo formato.",
    funciones: ["Plantilla editable con campos del Excel", "Valida los datos antes de generar", "Un PDF por persona con nombre automático", "Registro con código de verificación y PDF para imprimir"],
    tecnologias: ["Python", "fpdf2"],
    servicio: "Generación automática de PDF y documentos"
  }
];
