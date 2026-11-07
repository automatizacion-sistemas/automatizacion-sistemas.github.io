# Demo · Seguimiento de clientes

Demostración funcional de un sistema de seguimiento de clientes (CRM) para "Frío Andino", una empresa ficticia de aire acondicionado en Lima. Funciona **completamente en el navegador**, con SQLite real.

El problema que resuelve es el más común en ventas: **se envía una cotización y nadie vuelve a llamar**. Aquí, toda oportunidad abierta tiene siempre una fecha de próximo seguimiento y una próxima acción.

## Qué hace

| Módulo | Funciones |
|---|---|
| **Agenda de hoy** | Seguimientos vencidos, de hoy y de los próximos 7 días; oportunidades sin contacto hace más de 14 días; dinero en el embudo, pronóstico ponderado, ganado en el mes, tasa de cierre y días promedio para cerrar; filtro por vendedor |
| **Embudo de ventas** | Tablero por etapa (nuevo contacto → cotización → negociación → ganado / perdido); se arrastra una tarjeta a otra columna para cambiar su etapa; búsqueda y filtro por vendedor |
| **Ficha de la oportunidad** | Datos, etapa, historial de contactos, registro de un contacto nuevo con reprogramación del seguimiento (atajos: mañana, 3 días, una semana, 15 días) y mensaje de WhatsApp con plantillas |
| **Clientes** | Búsqueda, filtros (con oportunidades abiertas, ya compraron, sin contacto hace 60 días, por origen), ficha con todas sus oportunidades e historial, edición, eliminación y exportación a Excel (clientes y oportunidades) |
| **Reportes** | Ventas cerradas por mes, embudo de conversión, resultados por origen del cliente y por vendedor, motivos de pérdida con su monto, exportación a Excel con 5 hojas |

## Reglas

- **Siempre hay un próximo paso:** una oportunidad abierta no se puede guardar sin fecha de seguimiento (hoy o después, máximo 6 meses) ni próxima acción.
- **Ganar** exige el monto final de la venta; **perder** exige el motivo (precio, competencia, sin presupuesto, no respondió, postergó). Una oportunidad cerrada no se reabre: se crea una nueva.
- Los contactos no pueden tener fecha futura ni anterior a la creación de la oportunidad.
- **Clientes sin duplicados:** se detecta el mismo celular (aunque se escriba con +51 o espacios), correo o RUC.
- **RUC** con dígito verificador (módulo 11 de SUNAT); si hay RUC, se exige la razón social.
- Celular peruano: 9 dígitos que empiezan con 9.
- Al crear un cliente con su primer pedido, se guarda todo o nada.

## WhatsApp

El botón abre WhatsApp (`wa.me`) con el mensaje ya escrito para ese cliente; **la persona decide si lo envía**. Luego el sistema deja preparado el registro del contacto. No se envían mensajes automáticos: para eso se necesitaría la API de WhatsApp Business (cuenta de Meta verificada, número dedicado y un servidor), que no forma parte de esta demo.

## Modelo de datos

```sql
clientes      (id, nombre, empresa, ruc, telefono, email, distrito, origen, creado)
oportunidades (id, cliente_id, titulo, monto, etapa, vendedor, creada, cerrada, motivo_perdida, seguimiento, accion)
actividades   (id, cliente_id, oportunidad_id, fecha, tipo, nota, automatica)
cambios_etapa (id, oportunidad_id, fecha, desde, hacia)
```

Las reglas principales también están en la base de datos (`CHECK`): una oportunidad abierta siempre tiene seguimiento, una cerrada siempre tiene fecha de cierre y una perdida siempre tiene motivo.

## Archivos

```
clientes/
├── index.html            Pantallas y diálogos
├── css/clientes.css      Agenda, tablero, fichas y línea de tiempo
├── js/db.js              Tablas, reglas, agenda, indicadores y reportes
├── js/datos-ejemplo.js   72 clientes ficticios y ~7 meses de actividad comercial
└── js/app.js             Lógica de cada pantalla
```

Para ejecutarla en tu computadora, sirve la carpeta del proyecto con `python -m http.server 8000` y abre `http://localhost:8000/demos/clientes/`.
