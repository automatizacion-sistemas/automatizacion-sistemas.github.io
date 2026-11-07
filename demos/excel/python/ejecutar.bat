@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul || (
  echo No se encontro Python. Instalalo desde https://www.python.org/downloads/ y marca "Add python.exe to PATH".
  pause
  exit /b 1
)
python -c "import openpyxl" 2>nul || (
  echo Instalando openpyxl por unica vez...
  python -m pip install -r requirements.txt
)
python consolidar.py entrada
if errorlevel 1 (
  echo.
  echo Revisa el mensaje de arriba.
) else (
  start "" salida
)
pause
