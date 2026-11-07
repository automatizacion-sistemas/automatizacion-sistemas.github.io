# Demo · Control de ingresos y gastos

Demostración funcional para un emprendimiento ficticio, "Pastelería Dulce Hogar", con caja, cuenta bancaria y Yape. Funciona **completamente en el navegador**, con SQLite real.

El problema que resuelve es el más común en un emprendimiento: **el dinero del negocio se mezcla con el de la casa**, y entonces no se sabe cuánto gana realmente el negocio.

## Qué hace

| Módulo | Funciones |
|---|---|
| **Resumen** | Ingresos, gastos, utilidad y margen del mes; retiros personales y su peso sobre la utilidad; un mensaje en lenguaje simple que dice si la dueña sacó más de lo que ganó el negocio; gráfico de 12 meses; gastos por categoría; saldos de caja, banco y Yape |
| **Movimientos** | Ingresos, gastos, retiros personales y transferencias entre cuentas; filtros por tipo, cuenta y mes; exportación a Excel |
| **Estado de resultados** | 12 meses por categoría: total de ingresos, total de gastos, utilidad, margen, retiros y lo que queda en el negocio; exportación a Excel |
| **Presupuesto** | Gasto real frente al presupuesto por categoría, avance frente al día del mes, proyección al cierre y promedio de los últimos 3 meses; el presupuesto se edita en la misma tabla |
| **Importar extracto** | Pegas o abres el CSV de la banca por internet; el sistema reconoce fechas y montos en varios formatos, **categoriza automáticamente** con reglas de palabras clave, detecta movimientos **ya registrados** y no deja importar líneas sin categoría |

## Reglas

- **Retiro personal ≠ gasto del negocio:** lo que la dueña saca para la casa se muestra aparte, para no inflar los gastos ni esconder la pérdida de capital.
- **Transferencias:** mover dinero entre cuentas no cambia la utilidad.
- **Saldos:** ninguna salida puede dejar una cuenta en negativo, y no se puede eliminar un ingreso si eso deja la cuenta en negativo.
- **Importación:** se compara fecha + monto + descripción normalizada (sin tildes ni mayúsculas) para no duplicar. Si las líneas a importar dejan la cuenta en negativo, no se importa ninguna (todo o nada).
- **Proyección del presupuesto:** ritmo de gasto del mes, sin superar el promedio histórico en gastos que ya se pagaron completos (como el alquiler).

## Modelo de datos

```sql
cuentas     (id, nombre, saldo_inicial)
categorias  (id, nombre, tipo INGRESO|GASTO|RETIRO, presupuesto)
movimientos (id, fecha, tipo, categoria_id, cuenta_id, cuenta_destino_id, monto, descripcion, comprobante, origen)
reglas      (id, palabra, categoria_id)
```

## Formato del extracto

```
Fecha;Descripción;Monto
04/11/2026;COMPRA MAYORISTA INSUMOS CHOCOLATE;-736,90
06/11/2026;ABONO APP DELIVERY SEMANA 45;1.026,30
```

El separador puede ser punto y coma, tabulación o coma. Los montos negativos son salidas. La primera línea se ignora si es un encabezado.

## Archivos

```
finanzas/
├── index.html            Pantallas y diálogos
├── css/finanzas.css      Mensaje clave, estado de resultados, presupuesto e importación
├── js/db.js              Tablas, saldos, reportes, presupuesto e importación
├── js/datos-ejemplo.js   12 meses de datos ficticios y extracto de ejemplo
└── js/app.js             Lógica de cada pantalla
```

Para ejecutarla en tu computadora, sirve la carpeta del proyecto con `python -m http.server 8000` y abre `http://localhost:8000/demos/finanzas/`.
