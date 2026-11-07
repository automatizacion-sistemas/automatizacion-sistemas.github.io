#!/bin/sh
# Genera los PDF de los dos ejemplos (Mac / Linux)
cd "$(dirname "$0")" || exit 1
python3 -c "import fpdf, openpyxl" 2>/dev/null || python3 -m pip install --user -r requirements.txt
python3 generar_documentos.py plantillas/constancia_trabajo.txt datos/trabajadores.xlsx --zip
echo
python3 generar_documentos.py plantillas/carta_cobranza.txt datos/deudas.xlsx --zip
