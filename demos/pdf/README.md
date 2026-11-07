# Demo · Generador automático de documentos PDF

Demostración funcional de un programa en **Python** que genera constancias de trabajo y cartas de cobranza en PDF para una empresa ficticia, "Comercializadora Los Andes".

La demo web **ejecuta el mismo archivo `python/generar_documentos.py`** que se instala en la computadora de una oficina: Python 3 corre en el navegador con [Pyodide](https://pyodide.org) y genera los PDF con `fpdf2`. Los datos no se suben a ningún servidor.

## Qué se puede hacer en la demo

1. **Elegir el tipo de documento:** constancias de trabajo (12 trabajadores) o cartas de cobranza (8 facturas vencidas).
2. **Editar la plantilla** como en el Bloc de notas, insertando columnas con un toque. El programa avisa al instante si la plantilla usa una columna que no existe o si está mal escrita.
3. **Ver los datos ya validados:** cada fila aparece como «Lista» o «Con errores» y con el motivo (DNI de 7 dígitos, cargo vacío, cese antes del ingreso, RUC incompleto, saldo en cero).
4. **Usar un Excel propio** con las columnas de la plantilla.
5. **Generar los PDF:** lista de documentos con su código de verificación, vista previa, descarga individual, PDF con todos para imprimir, registro en Excel y un .zip con todo.
6. **Ver el código** y **descargar el proyecto** para usarlo en Windows con doble clic.

## Cómo funciona por dentro

```
index.html / js/app.js        Interfaz: plantilla, datos, generación y vista previa
js/python-worker.mjs          Hilo aparte que carga Pyodide, fpdf2 y openpyxl y ejecuta el programa
python/                       El proyecto Python real (el mismo del .zip)
descargas/                    El proyecto empaquetado en .zip
../comun/lib/pyodide/         Pyodide 314.0.7, alojado en este sitio (licencia MPL-2.0)
../comun/lib/python/          fpdf2 (LGPL-3.0), fonttools (MIT), defusedxml (PSF), openpyxl y et_xmlfile (MIT)
../excel/css/excel.css        Estilos compartidos con la demo de Excel (consola, código, pasos)
```

- Todo se sirve desde el propio sitio: la demo no depende de servicios externos.
- La primera carga descarga Python y las librerías (unos 7 MB comprimidos) y tarda algunos segundos; después todo es inmediato.
- En celulares que no muestran PDF dentro de la página, el botón «Abrir» los muestra en una pestaña nueva.

## Resultado esperado con los ejemplos

| Ejemplo | Generados | Omitidos (con el motivo en el registro) |
|---|---|---|
| Constancias de trabajo | 9 | 3: DNI de 7 dígitos, cargo vacío, fecha de cese anterior al ingreso |
| Cartas de cobranza | 6 | 2: RUC de 10 dígitos, saldo en cero |

## Probar el programa en tu computadora

```bash
cd python
pip install -r requirements-dev.txt
python generar_documentos.py plantillas/constancia_trabajo.txt datos/trabajadores.xlsx --zip
python -m pytest -q                 # 19 pruebas
```
