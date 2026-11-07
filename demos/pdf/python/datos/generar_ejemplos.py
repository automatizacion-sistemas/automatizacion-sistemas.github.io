"""
generar_ejemplos.py — Crea los dos Excel de ejemplo (datos ficticios) junto a este archivo.

  trabajadores.xlsx   12 trabajadores para las constancias de trabajo. Incluye a propósito:
                      un DNI de 7 dígitos, un cargo vacío, una fecha de cese anterior al ingreso,
                      fechas escritas como texto y apellidos con tildes y ñ.
  deudas.xlsx         8 facturas vencidas para las cartas de cobranza. Incluye a propósito:
                      un saldo en cero y un RUC incompleto.

Uso:  python datos/generar_ejemplos.py [carpeta]      (por defecto: la carpeta datos)
"""
import sys
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

TRABAJADORES = [
    ("45871236", "Quispe", "Huamán", "Rosa Elena", "Asistente contable", "Contabilidad", datetime(2019, 3, 15), None),
    ("70214589", "Núñez", "Paredes", "Luis Alberto", "Supervisor de almacén", "Logística", datetime(2017, 8, 1), None),
    ("41236987", "Castillo", "Rojas", "María Fernanda", "Ejecutiva de ventas", "Comercial", datetime(2021, 1, 4), datetime(2026, 6, 30)),
    ("46985213", "Torres", "Villanueva", "Carlos Andrés", "Analista de sistemas", "Tecnología", "02/05/2022", None),
    ("4587123", "Mendoza", "Salas", "Jorge", "Chofer repartidor", "Logística", datetime(2020, 11, 9), None),
    ("72569841", "Gutiérrez", "Peña", "Ana Lucía", "Jefa de tienda", "Comercial", datetime(2016, 5, 23), None),
    ("43698712", "Espinoza", "Cárdenas", "Raúl", "", "Contabilidad", datetime(2023, 2, 1), None),
    ("47852369", "Córdova", "Medina", "Milagros", "Asistente de recursos humanos", "Recursos Humanos", "10/07/2018", "31/10/2026"),
    ("40125896", "Vargas", "Aguilar", "Hugo", "Técnico de mantenimiento", "Operaciones", datetime(2024, 4, 15), datetime(2023, 12, 31)),
    ("73654128", "Palacios", "Chávez", "Daniela", "Practicante de marketing", "Marketing", datetime(2025, 9, 1), None),
    ("44521789", "Ramírez", "Flores", "Óscar Iván", "Contador general", "Contabilidad", datetime(2015, 2, 2), None),
    ("71259634", "Salazar", "Ñique", "Teresa", "Recepcionista", "Administración", datetime(2022, 10, 17), datetime(2025, 3, 31)),
]
DEUDAS = [
    ("Minimarket El Sol S.A.C.", "20512345678", "Sr. Ricardo Paredes", "F001-00004512", datetime(2026, 8, 18), datetime(2026, 9, 17), 3450.00),
    ("Bodega Don Lucho", "", "Sr. Luis Huamán", "F001-00004588", datetime(2026, 9, 2), datetime(2026, 10, 2), 1280.50),
    ("Distribuciones Quispe S.R.L.", "20498765432", "Sra. Carmen Quispe", "F001-00004601", datetime(2026, 9, 5), datetime(2026, 10, 5), 12750.00),
    ("Comercial Huamán E.I.R.L.", "2045678901", "Sr. Pedro Huamán", "F001-00004620", datetime(2026, 9, 10), datetime(2026, 10, 10), 890.00),
    ("Market San Martín S.A.C.", "20587412369", "Srta. Lucía Torres", "F001-00004633", datetime(2026, 9, 12), datetime(2026, 10, 12), 0),
    ("Abarrotes La Económica", "10458712365", "Sr. Víctor Salas", "F001-00004650", datetime(2026, 9, 20), datetime(2026, 10, 20), 2301.75),
    ("Bodega Los Andes", "", "Sra. Elena Rojas", "F001-00004671", datetime(2026, 9, 25), datetime(2026, 10, 25), 640.00),
    ("Hotel Plaza Norte S.A.C.", "20569874123", "Sr. Fernando Castillo", "F001-00004690", datetime(2026, 9, 28), datetime(2026, 10, 28), 21600.00),
]


def hoja(libro, titulo, encabezados, filas, anchos):
    h = libro.active
    h.title = titulo
    h.append(encabezados)
    for c in h[1]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="0A1F44")
    for f in filas:
        h.append(list(f))
    for fila in h.iter_rows(min_row=2):
        for c in fila:
            if isinstance(c.value, datetime):
                c.number_format = "dd/mm/yyyy"
    for i, a in enumerate(anchos):
        h.column_dimensions[chr(65 + i)].width = a
    h.freeze_panes = "A2"


def crear(carpeta: Path):
    carpeta.mkdir(parents=True, exist_ok=True)
    libro = Workbook()
    hoja(libro, "Trabajadores", ["DNI", "ApellidoPaterno", "ApellidoMaterno", "Nombres", "Cargo", "Area", "FechaIngreso", "FechaCese"], TRABAJADORES, [11, 17, 17, 18, 30, 18, 14, 14])
    libro.save(carpeta / "trabajadores.xlsx")
    libro = Workbook()
    hoja(libro, "Facturas vencidas", ["Cliente", "RUC", "Contacto", "Comprobante", "Emision", "Vencimiento", "Saldo"], DEUDAS, [32, 14, 24, 16, 12, 13, 12])
    for c in libro.active["G"][1:]:
        c.number_format = '"S/" #,##0.00'
    libro.save(carpeta / "deudas.xlsx")
    return sorted(p.name for p in carpeta.glob("*.xlsx"))


if __name__ == "__main__":
    destino = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
    for nombre in crear(destino):
        print("  creado:", destino / nombre)
