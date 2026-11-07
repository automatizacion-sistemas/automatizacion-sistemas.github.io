@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul || (
  echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ y marca "Add python.exe to PATH".
  pause
  exit /b 1
)
python -c "import fpdf, openpyxl" 2>nul || (
  echo Instalando fpdf2 y openpyxl por unica vez...
  python -m pip install -r requirements.txt
)
python generar_documentos.py plantillas\constancia_trabajo.txt datos\trabajadores.xlsx --zip
echo.
python generar_documentos.py plantillas\carta_cobranza.txt datos\deudas.xlsx --zip
if not errorlevel 1 start "" salida
pause
