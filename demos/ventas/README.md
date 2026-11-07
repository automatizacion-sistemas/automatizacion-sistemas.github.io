# Demo · Sistema de ventas y cobranzas

Demostración funcional para una distribuidora ficticia, "Distribuidora Andina", con 16 clientes inventados. Funciona **completamente en el navegador**, con SQLite real, y los datos se guardan solo en el navegador de cada visitante.

## Qué hace

| Módulo | Funciones |
|---|---|
| **Dashboard** | Ventas y cobros del mes, total por cobrar, deuda vencida y su porcentaje; gráfico de ventas vs. cobranzas de 6 meses; gráfico de antigüedad de la deuda; listas de cobranza prioritaria y de vencimientos de los próximos 7 días |
| **Ventas** | Facturas y boletas al contado o al crédito; numeración correlativa automática (F001, B001); desglose de valor de venta e IGV; búsqueda y filtros por estado y condición; detalle con los cobros de cada comprobante; exportación del registro de ventas a Excel |
| **Cobranzas** | Cobros totales o parciales por transferencia, Yape/Plin, depósito o efectivo, con número de operación; historial; exportación a Excel |
| **Cuentas por cobrar** | Reporte de **antigüedad de saldos** por cliente (por vencer, 1–30, 31–60, 61–90 y más de 90 días); exportación a Excel con el resumen y el detalle de pendientes |
| **Clientes** | Alta con validación de RUC/DNI y celular; días y línea de crédito; deuda, monto vencido y crédito disponible; **estado de cuenta** con cargos, abonos y saldo, exportable a Excel |
| **Recordatorios** | Mensaje de cobranza listo para enviar por WhatsApp, con el comprobante, el monto y los días de atraso |

## Reglas de negocio

- Solo se emite **factura** a clientes con RUC; a los clientes con DNI les corresponde **boleta**.
- Las ventas **al contado** registran su cobro automáticamente.
- En las ventas **al crédito**, el vencimiento es la fecha de venta más los días de crédito del cliente. Si el cliente tiene una línea de crédito, no se puede superar.
- Un cobro no puede ser mayor que el saldo pendiente, ni tener una fecha anterior a la venta o posterior a hoy.
- No se puede eliminar un cliente que tiene ventas registradas.
- Los importes incluyen IGV (18 %): valor de venta = total ÷ 1,18.

## Modelo de datos

```sql
clientes (id, documento UNIQUE, nombre, telefono, correo, dias_credito, limite_credito)
ventas   (id, cliente_id → clientes, fecha, comprobante FACTURA|BOLETA, serie, numero,
          descripcion, total, condicion CONTADO|CREDITO, vencimiento, UNIQUE(serie, numero))
cobros   (id, venta_id → ventas, fecha, monto, medio, operacion)
v_ventas -- vista: cada venta con su cliente, lo cobrado y el saldo
```

## Verificación

Las pruebas automatizadas comprueban, entre otras cosas, que el total vendido menos el total cobrado sea igual al saldo por cobrar, y que ese saldo sea igual a la suma de los tramos de antigüedad. También comprueban que no haya saldos negativos, cobros anteriores a su venta, facturas emitidas a clientes con DNI ni saltos en la numeración.

## Archivos

```
ventas/
├── index.html            Pantallas y diálogos
├── css/ventas.css        Estilos propios (los generales están en ../comun/css/demo.css)
├── js/db.js              Tablas, reglas de negocio, antigüedad de saldos y estado de cuenta
├── js/datos-ejemplo.js   Datos ficticios (6 meses, con clientes puntuales, tardíos y morosos)
└── js/app.js             Lógica de cada pantalla
```

Para ejecutarla en tu computadora, sirve la carpeta del proyecto con `python -m http.server 8000` y abre `http://localhost:8000/demos/ventas/`.
