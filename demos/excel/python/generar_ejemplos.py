"""
generar_ejemplos.py — Crea los Excel de ejemplo de 6 sucursales (datos ficticios).

Cada archivo imita un problema real de los reportes que llegan de las sucursales:

  ventas_lima_centro_2026-10.xlsx   ordenado y limpio (el caso ideal)
  ventas_arequipa_octubre.xlsx      título arriba, encabezados en la fila 4, fila de TOTAL y un importe mal digitado
  Ventas Trujillo oct-2026.xlsx     otros nombres de columna, fechas y precios como texto, comprobantes
                                    mal escritos y productos en MAYÚSCULAS sin espacios
  ventas_piura_2026-10.xlsx         una devolución con cantidad negativa, una fecha vacía, un precio
                                    "consultar" y dos ventas de setiembre
  ventas_cusco_2026-10.xlsx         columnas en otro orden, columna extra, filas vacías y 3 líneas copiadas dos veces
  ventas_chiclayo_2026-10.xlsx      la primera hoja es un resumen; los datos están en la segunda y no hay columna cliente
  notas_reunion.xlsx                un archivo que no es un reporte de ventas

Uso:  python generar_ejemplos.py [carpeta]      (por defecto: entrada)
"""
import random
import sys
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font

PRODUCTOS = [("Arroz extra 5 kg", 23.90), ("Aceite vegetal 1 L", 9.50), ("Azúcar rubia 1 kg", 4.20), ("Leche evaporada x 6", 21.50),
             ("Fideos spaghetti 500 g", 3.80), ("Atún en trozos x 3", 15.90), ("Detergente 2 kg", 18.50), ("Papel higiénico x 4", 6.90),
             ("Café instantáneo 200 g", 17.80), ("Galletas de soda x 6", 5.40)]
CLIENTES = ["Bodega Rosita", "Minimarket El Sol", "Comercial Huamán E.I.R.L.", "Bodega Don Pepe", "Abarrotes La Económica", "Market San Martín S.A.C.",
            "Bodega Los Andes", "Distribuciones Quispe S.R.L.", "Bodega Mi Barrio", "Clientes varios"]


def generar(sucursal_n: int, comprobantes: int, azar: random.Random):
    """Devuelve líneas de venta de octubre de 2026 para una sucursal."""
    lineas, correlativo = [], 1200 + sucursal_n * 37
    for _ in range(comprobantes):
        correlativo += azar.randint(1, 3)
        while True:
            dia = azar.randint(1, 31)
            fecha = datetime(2026, 10, dia)
            if fecha.weekday() != 6:                       # sin domingos
                break
        cliente = azar.choice(CLIENTES)
        serie = ("F" if "S.A.C." in cliente or "E.I.R.L." in cliente or "S.R.L." in cliente else "B") + f"{sucursal_n:03d}"
        for producto, precio in azar.sample(PRODUCTOS, azar.randint(1, 3)):
            lineas.append({"fecha": fecha, "comprobante": f"{serie}-{correlativo:08d}", "cliente": cliente, "producto": producto,
                           "cantidad": azar.choice([2, 3, 4, 5, 6, 6, 10, 12, 12, 24]), "precio": round(precio * azar.choice([1, 1, 1, 0.97, 1.02]), 2)})
    return sorted(lineas, key=lambda l: (l["fecha"], l["comprobante"]))


def hoja_con_fechas(hoja, columna):
    for fila in hoja.iter_rows(min_row=1):
        celda = fila[columna - 1]
        if isinstance(celda.value, datetime):
            celda.number_format = "dd/mm/yyyy"


def crear(carpeta: Path):
    azar = random.Random(2026)
    carpeta.mkdir(parents=True, exist_ok=True)

    # 1. Lima Centro: limpio
    libro = Workbook(); h = libro.active; h.title = "Ventas"
    h.append(["Fecha", "N° Comprobante", "Cliente", "Producto", "Cantidad", "Precio unitario", "Total"])
    for l in generar(1, 70, azar):
        h.append([l["fecha"], l["comprobante"], l["cliente"], l["producto"], l["cantidad"], l["precio"], round(l["cantidad"] * l["precio"], 2)])
    hoja_con_fechas(h, 1); libro.save(carpeta / "ventas_lima_centro_2026-10.xlsx")

    # 2. Arequipa: título, encabezado en la fila 4, fila de TOTAL e importe mal digitado
    libro = Workbook(); h = libro.active; h.title = "Ventas octubre"
    h["A1"] = "DISTRIBUIDORA ANDINA — SUCURSAL AREQUIPA"; h["A1"].font = Font(bold=True, size=14)
    h["A2"] = "Reporte de ventas de octubre 2026"
    h.append([]); h.append(["Fecha", "Comprobante", "Cliente", "Producto", "Cantidad", "Precio Unitario", "Importe"])
    total = 0
    for i, l in enumerate(generar(2, 52, azar)):
        importe = round(l["cantidad"] * l["precio"], 2)
        if i == 17:
            importe = round(importe * 10, 2)                 # se digitó un cero de más
        total += importe
        h.append([l["fecha"], l["comprobante"], l["cliente"], l["producto"], l["cantidad"], l["precio"], importe])
    h.append(["TOTAL", None, None, None, None, None, round(total, 2)])
    hoja_con_fechas(h, 1); libro.save(carpeta / "ventas_arequipa_octubre.xlsx")

    # 3. Trujillo: otros encabezados, todo como texto, comprobantes y productos mal escritos
    libro = Workbook(); h = libro.active; h.title = "Reporte"
    h.append(["FECHA DE VENTA", "Nro. Doc", "Razón social / Cliente", "Descripción", "Cant.", "P. Unit. (S/)"])
    for l in generar(3, 44, azar):
        serie, numero = l["comprobante"].split("-")
        producto = l["producto"]
        if azar.random() < 0.5:
            producto = producto.upper().replace(" KG", "KG").replace(" L", "L").replace("Ú", "U").replace("É", "E")
        h.append([l["fecha"].strftime("%d/%m/%Y"), f"{serie.lower()}-{int(numero)}", l["cliente"].upper(), producto, str(l["cantidad"]), f"S/ {l['precio']:,.2f}"])
    libro.save(carpeta / "Ventas Trujillo oct-2026.xlsx")

    # 4. Piura: errores que deben excluirse
    libro = Workbook(); h = libro.active; h.title = "Ventas"
    h.append(["Fecha", "Comprobante", "Cliente", "Producto", "Cantidad", "Precio unitario"])
    filas = [[l["fecha"], l["comprobante"], l["cliente"], l["producto"], l["cantidad"], l["precio"]] for l in generar(4, 40, azar)]
    filas[5][4] = -2                                        # devolución registrada como venta
    filas[12][0] = None                                     # fecha vacía
    filas[20][5] = "consultar"                              # precio en texto
    filas[27][0] = datetime(2026, 9, 28)                    # venta de setiembre
    filas[33][0] = datetime(2026, 9, 30)                    # venta de setiembre
    for f in filas:
        h.append(f)
    hoja_con_fechas(h, 1); libro.save(carpeta / "ventas_piura_2026-10.xlsx")

    # 5. Cusco: columnas en otro orden, filas vacías y líneas copiadas dos veces
    libro = Workbook(); h = libro.active; h.title = "Hoja1"
    h.append(["Comprobante", "Fecha", "Producto", "Cliente", "Precio", "Cantidad", "Observaciones"])
    datos = generar(5, 34, azar)
    for i, l in enumerate(datos):
        h.append([l["comprobante"], l["fecha"], l["producto"], l["cliente"], l["precio"], l["cantidad"], "Pagó con Yape" if i % 9 == 0 else None])
        if i in (10, 25):
            h.append([])
    for l in (datos[3], datos[8], datos[15]):                # copiadas por error al final
        h.append([l["comprobante"], l["fecha"], l["producto"], l["cliente"], l["precio"], l["cantidad"], None])
    hoja_con_fechas(h, 2); libro.save(carpeta / "ventas_cusco_2026-10.xlsx")

    # 6. Chiclayo: primera hoja de resumen, datos en la segunda, sin columna cliente
    libro = Workbook(); r = libro.active; r.title = "Resumen"
    datos = generar(6, 46, azar)
    r.append(["Resumen por producto"]); r.append(["Producto", "Total"])
    for producto, _ in PRODUCTOS:
        r.append([producto, round(sum(l["cantidad"] * l["precio"] for l in datos if l["producto"] == producto), 2)])
    h = libro.create_sheet("Detalle ventas")
    h.append(["Ventas Chiclayo - octubre"]); h.append(["Fecha", "Comprobante", "Producto", "Cantidad", "Precio"])
    for l in datos:
        h.append([l["fecha"], l["comprobante"], l["producto"], l["cantidad"], l["precio"]])
    hoja_con_fechas(h, 1); libro.save(carpeta / "ventas_chiclayo_2026-10.xlsx")

    # 7. Un archivo que no es un reporte de ventas
    libro = Workbook(); h = libro.active; h.title = "Notas"
    for texto in ["Reunión de jefes de sucursal", "Acuerdos:", "1. Enviar el reporte de ventas los primeros 3 días del mes", "2. Usar la plantilla oficial"]:
        h.append([texto])
    libro.save(carpeta / "notas_reunion.xlsx")
    return sorted(p.name for p in carpeta.glob("*.xlsx"))


if __name__ == "__main__":
    destino = Path(sys.argv[1] if len(sys.argv) > 1 else "entrada")
    for nombre in crear(destino):
        print("  creado:", destino / nombre)
