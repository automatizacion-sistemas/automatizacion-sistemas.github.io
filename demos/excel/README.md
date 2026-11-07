# Demo · Automatización de Excel con Python

Demostración funcional de un programa en **Python** que consolida los Excel de ventas de 6 sucursales de una distribuidora ficticia, "Distribuidora Andina".

La demo web **ejecuta el mismo archivo `python/consolidar.py`** que se instala en la computadora de una empresa. No es una simulación: Python 3 corre en el navegador del visitante gracias a [Pyodide](https://pyodide.org) (Python compilado a WebAssembly), con la librería `openpyxl`. Los archivos no se suben a ningún servidor.

## Qué se puede hacer en la demo

1. **Elegir los archivos de entrada:** 7 Excel de ejemplo, cada uno con un problema real (encabezados en otra fila, columnas con otros nombres, fechas como texto, duplicados, ventas de otro mes, un archivo que no es de ventas…). Cada uno se puede descargar para abrirlo en Excel. También se pueden **agregar Excel propios**.
2. **Ejecutar:** el programa muestra su salida en una consola, igual que en una computadora.
3. **Ver el resultado:** indicadores, ventas por sucursal, productos más vendidos, observaciones (qué se excluyó, corrigió o unificó y por qué) y cómo se leyó cada archivo.
4. **Descargar el Excel consolidado** generado por Python: hojas Resumen (con fórmulas y gráfico), Detalle (tabla filtrable), Observaciones y Archivos.
5. **Ver el código** completo, comentado en español.
6. **Descargar el proyecto** (`descargas/consolidador-ventas-python.zip`) para usarlo en Windows con doble clic.

## Cómo funciona por dentro

```
index.html / js/app.js        Interfaz: archivos, consola y resultados
js/python-worker.mjs          Hilo aparte que carga Pyodide + openpyxl y ejecuta consolidar.py
python/                       El proyecto Python real (el mismo del .zip)
ejemplos/                     Los 7 Excel de ejemplo (creados con python/generar_ejemplos.py)
descargas/                    El proyecto empaquetado en .zip
../comun/lib/pyodide/         Pyodide 314.0.7, alojado en este sitio (licencia MPL-2.0)
../comun/lib/python/          openpyxl 3.1.5 y et_xmlfile 2.0.0 (archivos .whl de PyPI, licencia MIT)
```

- Pyodide y openpyxl se sirven desde este mismo sitio: la demo no depende de servicios externos.
- La primera ejecución descarga unos 6 MB comprimidos (Python y su biblioteca estándar); después quedan en la memoria del navegador.
- Funciona en versiones recientes de Chrome, Edge, Firefox y Safari (requiere WebAssembly y *workers* de módulo).

## Resultado esperado con los 7 ejemplos

| Concepto | Resultado |
|---|---|
| Archivos | 6 procesados, 1 omitido (`notas_reunion.xlsx`, no es un reporte de ventas) |
| Excluidas | 8 filas: 3 duplicadas (Cusco), 1 cantidad negativa, 1 fecha vacía, 1 precio en texto y 2 ventas de setiembre (Piura) |
| Corregidas | 1: importe de Arequipa digitado con un cero de más (se usa cantidad × precio) |
| Unificadas | 10 nombres de producto escritos en mayúsculas o sin espacios (Trujillo) |
| Omitidas | La fila de TOTAL de Arequipa y el archivo que no es de ventas |

## Probar el programa en tu computadora

```bash
cd python
pip install -r requirements-dev.txt
python generar_ejemplos.py          # crea ./entrada
python consolidar.py                # genera ./salida/consolidado_ventas_2026-10.xlsx
python -m pytest -q                 # 23 pruebas
```
