# Demo · Sistema de control de inventarios

Demostración funcional de un sistema de inventarios para un comercio (una ferretería ficticia, "El Tornillo"). Funciona **completamente en el navegador**: no necesita servidor, ni Python, ni instalación.

## Qué hace

| Módulo | Funciones |
|---|---|
| **Dashboard** | Productos registrados, valor del inventario a costo promedio, productos para reponer, ventas del mes, gráfico de compras vs. salidas de las últimas 8 semanas y valor por categoría |
| **Productos** | Crear, editar y eliminar; búsqueda por código o nombre; filtro por categoría y por stock bajo; exportar a Excel |
| **Movimientos** | Entradas (compra, devolución, ajuste) y salidas (venta, merma, consumo interno, ajuste); valida que el stock nunca quede negativo, incluso con fechas pasadas |
| **Kardex** | Kardex valorizado por producto con el método de **costo promedio ponderado**; exportar a Excel |
| **General** | Descargar la base de datos `.sqlite`; restablecer los datos de ejemplo; diseño adaptado a celulares |

## Cómo funciona por dentro

- **Base de datos:** SQLite real, mediante [sql.js](https://github.com/sql-js/sql.js) (SQLite compilado a WebAssembly). Si el navegador no admite WebAssembly, se usa automáticamente la versión JavaScript (`lib/sql-asm.js`).
- **Guardado:** la base se guarda en el IndexedDB del navegador de cada visitante. Cada persona ve solo sus propios datos y nada se envía a ningún servidor.
- **Datos de ejemplo:** `js/datos-ejemplo.js` genera 22 productos y unos 90 días de compras y ventas con fechas relativas a hoy. La simulación tiene una semilla fija, así que al restablecer siempre se obtienen los mismos datos.

### Modelo de datos

```sql
productos   (id, codigo UNIQUE, nombre, categoria, unidad, precio_venta, stock_minimo, creado)
movimientos (id, producto_id → productos ON DELETE CASCADE, fecha, tipo ENTRADA|SALIDA,
             motivo, cantidad > 0, costo_unitario, referencia, creado)
v_stock     -- vista: cada producto con su stock actual (Σ entradas − Σ salidas)
```

### Costo promedio ponderado

- **Entrada:** saldo valor += cantidad × costo unitario; nuevo costo promedio = saldo valor ÷ saldo cantidad.
- **Salida:** se valoriza al costo promedio vigente; el promedio no cambia.

Ejemplo verificado en las pruebas: se compran 10 a S/ 5,00, se venden 4 y se compran 10 a S/ 8,00. El nuevo costo promedio es (6 × 5 + 10 × 8) ÷ 16 = **S/ 6,875**, con un valor de S/ 110,00.

## Archivos

```
inventario/
├── index.html            Estructura de las 4 pantallas y los diálogos
├── css/inventario.css    Estilos (reutiliza los CSS del sitio principal)
├── js/db.js              Base de datos, validaciones y cálculo del kardex
├── js/datos-ejemplo.js   Datos de demostración
├── js/ui.js              Formatos, tablas, avisos, diálogos, descargas y Excel
├── js/graficos.js        Gráficos del dashboard (Chart.js)
├── js/app.js             Lógica de cada pantalla
└── lib/                  Librerías locales (ver LICENCIAS.txt)
```

## Ejecutar en tu computadora

Por seguridad, el navegador no deja cargar WebAssembly al abrir el archivo con doble clic. Hay que servir la carpeta del proyecto con un servidor local:

```bash
cd jorgeluis-portafolio
python -m http.server 8000
```

Luego abre `http://localhost:8000/demos/inventario/`.

## Notas

- La librería de Excel (SheetJS 0.18.5) **solo escribe** archivos, nunca lee archivos subidos por el usuario, así que no le afectan las vulnerabilidades conocidas de esa versión, que son de lectura.
- Para un cliente real, esta misma lógica se lleva a un servidor (por ejemplo, Python con SQLite o PostgreSQL), con usuarios, permisos y varios almacenes.
