#!/bin/sh
# Consolida los Excel de la carpeta "entrada" (Mac / Linux)
cd "$(dirname "$0")" || exit 1
python3 -c "import openpyxl" 2>/dev/null || python3 -m pip install --user -r requirements.txt
python3 consolidar.py entrada
