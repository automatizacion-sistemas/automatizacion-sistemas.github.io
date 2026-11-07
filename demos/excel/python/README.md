# Consolidador de ventas en Excel (Python)

Programa que junta en **un solo Excel** los reportes de ventas que envía cada sucursal, aunque cada uno venga con un formato distinto y con errores. Además explica cada corrección que hizo.

> Proyecto de demostración de **Automatización & Sistemas**. Los archivos de ejemplo usan datos ficticios.

## Qué resuelve

Cada mes llegan varios Excel: uno empieza en la fila 4, otro llama «Cant.» a la cantidad, otro escribe las fechas como texto, otro trae una fila de TOTAL, una devolución en negativo o líneas copiadas dos veces. Armar el consolidado a mano toma horas y es fácil equivocarse.

`consolidar.py`:

1. **Encuentra la tabla de ventas** en cualquier hoja y en cualquiera de las primeras 15 filas, aunque los encabezados estén escritos de otra forma («Nro. Doc», «P. Unit. (S/)», «Descripción», «Importe»…).
2. **Limpia los datos:** fechas en texto o como número de Excel, montos como `S/ 1,250.00` o `1.250,50`, comprobantes como `b003-45` → `B003-00000045`, filas vacías y filas de totales.
3. **Valida cada fila** y excluye las que tienen errores: fecha vacía o futura, cantidad cero o negativa, precio en texto, líneas duplicadas y ventas de otro mes.
4. **Unifica los productos** escritos distinto (`ARROZ EXTRA 5KG` = `Arroz extra 5 kg`).
5. **Genera un Excel con formato** en `salida/consolidado_ventas_AAAA-MM.xlsx`:
   - **Resumen:** indicadores, ventas por sucursal con fórmulas (SUMIFS, totales y participación), productos más vendidos y un gráfico.
   - **Detalle:** todas las líneas válidas como tabla de Excel filtrable, con el archivo y la fila de origen.
   - **Observaciones:** cada fila excluida o corregida, con el motivo.
   - **Archivos:** qué hoja y qué fila de encabezados se usó en cada archivo.

## Cómo usarlo

### Windows (con un clic)

1. Instala Python 3 desde [python.org](https://www.python.org/downloads/) y marca **«Add python.exe to PATH»**.
2. Copia los Excel de las sucursales en la carpeta `entrada` (ya trae 7 archivos de ejemplo).
3. Haz doble clic en **`ejecutar.bat`**. La primera vez instala `openpyxl`; luego genera el consolidado y abre la carpeta `salida`.

### Mac / Linux / línea de comandos

```bash
pip install -r requirements.txt
python consolidar.py                       # lee ./entrada y escribe en ./salida
python consolidar.py mis_reportes -o consolidado.xlsx
python consolidar.py --periodo 2026-10     # fuerza el mes a consolidar
```

Si la carpeta `entrada` no existe, créala o genera los ejemplos con `python generar_ejemplos.py`.

## Formato esperado de los archivos

Cada Excel debe tener, en alguna hoja, una tabla con estas columnas (en cualquier orden y con cualquiera de los nombres habituales):

| Obligatorias | Opcionales |
|---|---|
| Fecha, Comprobante, Producto, Cantidad, Precio unitario | Cliente, Total/Importe, Sucursal |

La sucursal se toma de la columna «Sucursal» o, si no existe, del nombre del archivo (`ventas_lima_centro_2026-10.xlsx` → «Lima Centro»).

## Cómo adaptarlo

- **Otros nombres de columna:** agrégalos en `SINONIMOS`, al inicio de `consolidar.py`.
- **Otras validaciones:** se agregan en `leer_archivo()`, junto a las existentes.
- **Ejecución automática cada mes:** con el Programador de tareas de Windows apuntando a `ejecutar.bat`.
- **Envío por correo:** requiere una cuenta de correo de la empresa (por ejemplo, Microsoft 365 o Gmail) y guardar su contraseña de aplicación de forma segura en la computadora; no está incluido en este proyecto.

## Pruebas

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

23 pruebas: lectura de montos y fechas, normalización de comprobantes y encabezados, resultado exacto sobre los 7 archivos de ejemplo, estructura del Excel generado, período forzado, fecha futura y archivos inválidos.

## Archivos

```
consolidar.py          El programa
generar_ejemplos.py    Crea los 7 Excel de ejemplo en ./entrada
ejecutar.bat           Ejecución con doble clic (Windows)
ejecutar.sh            Ejecución en Mac / Linux
requirements.txt       Dependencia: openpyxl
tests/                 Pruebas automáticas (pytest)
entrada/               Excel de ejemplo de 6 sucursales + 1 archivo que no es de ventas
```

Requisitos: Python 3.9 o superior y openpyxl 3.1.
