# Generador de documentos PDF (Python)

Programa que genera **un PDF por cada fila de un Excel** a partir de una plantilla de texto: constancias de trabajo, cartas de cobranza, certificados, cartas de presentación… Valida los datos antes de generar y deja un registro con el código de verificación de cada documento.

> Proyecto de demostración de **Automatización & Sistemas**. Los Excel de ejemplo usan datos ficticios.

## Qué resuelve

En muchas oficinas se redactan uno por uno documentos que siempre tienen el mismo formato: se copia el modelo de Word, se cambian el nombre, el DNI y las fechas, se exporta a PDF y se renombra. Con 50 personas son horas de trabajo y es fácil equivocarse en un dato.

`generar_documentos.py`:

1. **Lee una plantilla de texto** que se edita con el Bloc de notas. Lo que va entre llaves se reemplaza con la columna del Excel: `{Nombres}`, `{DNI}`, `{FechaIngreso:fecha}`.
2. **Revisa antes de generar** que todas las columnas que usa la plantilla existan en el Excel.
3. **Valida cada fila:** campos obligatorios vacíos, DNI de 8 dígitos, RUC de 11, fechas válidas, montos mayores a cero y fecha de cese posterior a la de ingreso. Las filas con errores no se generan y quedan anotadas con el motivo.
4. **Genera los PDF** con encabezado de la empresa, título, texto justificado, lugar y fecha, firma y pie con un **código de verificación** único.
5. **Nombra cada archivo** según la plantilla (`Constancia_45871236_Quispe.pdf`), sin tildes ni caracteres que Windows no acepta, y sin sobrescribir si dos nombres coinciden.
6. Crea además **`todos_los_documentos.pdf`** (para imprimir de una vez), **`registro_documentos.xlsx`** (código, archivo y destinatario de cada documento, y las filas con errores) y, con `--zip`, un .zip con todo.

## Cómo usarlo

### Windows (con un clic)

1. Instala Python 3 desde [python.org](https://www.python.org/downloads/) y marca **«Add python.exe to PATH»**.
2. Edita la plantilla de `plantillas/` con el Bloc de notas y llena el Excel de `datos/`.
3. Haz doble clic en **`ejecutar.bat`**. La primera vez instala fpdf2 y openpyxl; luego genera los documentos de los dos ejemplos en `salida/` y abre la carpeta.

### Línea de comandos

```bash
pip install -r requirements.txt
python generar_documentos.py plantillas/constancia_trabajo.txt datos/trabajadores.xlsx --zip
python generar_documentos.py plantillas/carta_cobranza.txt datos/deudas.xlsx -o salida/cobranzas
python generar_documentos.py plantillas/constancia_trabajo.txt datos/trabajadores.xlsx --solo-validar
```

## Cómo se escribe una plantilla

```text
---
titulo: CONSTANCIA DE TRABAJO
archivo: Constancia_{DNI}_{ApellidoPaterno}
prefijo: CT
empresa: Nombre de la empresa S.A.C.
ruc: 20XXXXXXXXX
direccion: Dirección de la empresa
lugar: Lima
firma_nombre: Nombre de quien firma
firma_cargo: Cargo de quien firma
obligatorios: Nombres, ApellidoPaterno, DNI, Cargo
resumen: {Nombres} {ApellidoPaterno} (DNI {DNI})
---
Texto del documento. Una línea en blanco separa los párrafos. **Negrita**.
```

| En la plantilla | Resultado |
|---|---|
| `{Nombres}` | El valor de la columna «Nombres» |
| `{Nombres:mayus}` / `{Nombres:titulo}` | MAYÚSCULAS / Tipo Título |
| `{FechaIngreso:fecha}` / `:fecha_corta` | 15 de marzo de 2019 / 15/03/2019 |
| `{Saldo:soles}` / `{Saldo:letras}` | S/ 12,750.00 / DOCE MIL SETECIENTOS CINCUENTA CON 00/100 SOLES |
| `{Vencimiento:dias}` | Días transcurridos desde esa fecha |
| `{si FechaCese}…{sino}…{fin}` | Un texto si la columna tiene valor y otro si está vacía |
| `{codigo}` / `{hoy:fecha}` | Código de verificación / fecha de emisión |

Opcional en el encabezado: `fecha_arriba: si` coloca el lugar y la fecha arriba (formato de carta).

## Límites y extensiones

- Usa las fuentes estándar del PDF; los signos tipográficos que no admiten (como «—») se reemplazan por equivalentes simples.
- **Logotipo** de la empresa: se agrega en el encabezado (SVG o, instalando Pillow, PNG/JPG).
- **Firma digital** con validez legal: requiere el certificado digital de la empresa o de la persona que firma; no está incluida.
- **Envío por correo** a cada persona: requiere una cuenta de correo de la empresa; no está incluido.
- El **código de verificación** identifica cada documento en el registro; para verificarlo en línea se necesitaría publicar ese registro en un sistema web.

## Pruebas

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

19 pruebas: montos en letras (incluye VEINTIÚN MIL, CIEN, UN MILLÓN), fechas, nombres de archivo, bloques condicionales, plantillas mal escritas, resultado exacto con los dos ejemplos (9 + 6 documentos), columnas faltantes, modo de solo validación y nombres repetidos.

## Archivos

```
generar_documentos.py        El programa
plantillas/                  constancia_trabajo.txt y carta_cobranza.txt
datos/                       trabajadores.xlsx, deudas.xlsx y generar_ejemplos.py
ejecutar.bat / ejecutar.sh   Ejecución con un clic
requirements.txt             fpdf2 y openpyxl
tests/                       Pruebas automáticas (pytest)
```

Requisitos: Python 3.9 o superior, fpdf2 2.7+ y openpyxl 3.1.
