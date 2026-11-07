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
    estado: "proximamente",
    vista: "calendario",
    problema: "Para negocios que registran entradas y salidas en papel y calculan tardanzas a mano a fin de mes.",
    funciones: ["Marcación de entrada y salida", "Cálculo automático de tardanzas y faltas", "Reporte mensual por trabajador", "Exportación para planillas"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Sistemas de control administrativo"
  },
  {
    id: "personal",
    titulo: "Sistema de gestión de personal",
    categoria: "sistemas",
    estado: "proximamente",
    vista: "personas",
    problema: "Para empresas con legajos dispersos, contratos que vencen sin aviso y datos del personal en varios archivos.",
    funciones: ["Ficha única por trabajador", "Alertas de vencimiento de contratos", "Control de vacaciones", "Búsqueda y filtros por área"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Sistemas de control administrativo"
  },
  {
    id: "finanzas",
    titulo: "Control de ingresos y gastos",
    categoria: "sistemas",
    estado: "proximamente",
    vista: "barras",
    problema: "Para emprendedores que mezclan el dinero del negocio con el personal y no saben cuánto ganan realmente.",
    funciones: ["Registro por categorías", "Flujo de caja mensual", "Comparativo de ingresos y gastos", "Gráficos de rentabilidad"],
    tecnologias: ["JavaScript", "Chart.js"],
    servicio: "Dashboards e indicadores empresariales"
  },
  {
    id: "clientes",
    titulo: "Seguimiento de clientes",
    categoria: "sistemas",
    estado: "proximamente",
    vista: "embudo",
    problema: "Para negocios que pierden ventas porque no recuerdan a quién cotizaron ni cuándo volver a llamar.",
    funciones: ["Cartera de clientes y prospectos", "Etapas de venta tipo embudo", "Recordatorios de seguimiento", "Historial de contactos"],
    tecnologias: ["JavaScript", "SQLite"],
    servicio: "Digitalización de procesos empresariales"
  },
  {
    id: "excel",
    titulo: "Automatización de Excel con Python",
    categoria: "automatizacion",
    estado: "proximamente",
    vista: "excel",
    problema: "Para equipos que pasan horas copiando y pegando datos entre varios Excel para armar un consolidado.",
    funciones: ["Consolida decenas de archivos en segundos", "Valida y limpia los datos", "Genera el reporte con formato", "Se ejecuta con un clic"],
    tecnologias: ["Python", "openpyxl"],
    servicio: "Automatización de Excel"
  },
  {
    id: "pdf",
    titulo: "Generador automático de documentos PDF",
    categoria: "automatizacion",
    estado: "proximamente",
    vista: "pdf",
    problema: "Para oficinas que redactan uno por uno contratos, constancias o cartas que siempre tienen el mismo formato.",
    funciones: ["Plantilla con campos variables", "Genera cientos de documentos de una vez", "Nombres de archivo automáticos", "Listos para enviar o firmar"],
    tecnologias: ["Python", "SQLite"],
    servicio: "Generación automática de PDF y documentos"
  }
];
