"""
consolidar.py — Consolida en un solo Excel los reportes de ventas de varias sucursales.

Qué hace
  1. Lee todos los .xlsx de una carpeta (uno por sucursal).
  2. En cada archivo busca la tabla de ventas aunque esté en otra hoja, empiece
     más abajo o tenga los encabezados escritos de otra forma
     ("Cant.", "P. Unit. (S/)", "Nro. Doc", "Descripción"...).
  3. Limpia y valida cada fila: fechas en texto, montos como "S/ 1,250.00",
     comprobantes mal escritos, filas de TOTAL, filas vacías, cantidades
     negativas, precios en texto, líneas duplicadas y fechas fuera del mes.
  4. Unifica los nombres de producto escritos distinto ("ARROZ EXTRA 5KG" y
     "Arroz extra 5 kg" son el mismo producto).
  5. Genera un Excel con formato: Resumen (indicadores, tablas y gráfico),
     Detalle (tabla filtrable), Observaciones (qué se corrigió o excluyó y por
     qué) y Archivos (cómo se leyó cada archivo).

Uso
  python consolidar.py                      # lee ./entrada y escribe en ./salida
  python consolidar.py mis_reportes -o consolidado.xlsx
  python consolidar.py --periodo 2026-10    # fuerza el mes a consolidar

Requisitos: Python 3.9 o superior y openpyxl (pip install -r requirements.txt).
Autor: Automatización & Sistemas.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

# --------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------
# Formas en que suelen escribirse los encabezados (se comparan sin tildes,
# sin mayúsculas y sin signos de puntuación).
SINONIMOS = {
    "fecha": ["fecha", "fecha de venta", "fecha venta", "fec emision", "fecha emision", "fecha de emision", "dia"],
    "comprobante": ["comprobante", "n comprobante", "no comprobante", "nro comprobante", "numero de comprobante",
                    "nro doc", "n doc", "documento", "boleta factura", "serie numero", "nro de comprobante"],
    "cliente": ["cliente", "razon social cliente", "razon social", "nombre del cliente", "cliente razon social"],
    "producto": ["producto", "descripcion", "articulo", "item", "detalle", "descripcion del producto"],
    "cantidad": ["cantidad", "cant", "unidades", "und", "cant vendida"],
    "precio": ["precio unitario", "p unit", "p unit s", "precio", "precio unit", "pu", "valor unitario", "precio unitario s"],
    "total": ["total", "importe", "importe total", "total s", "venta total", "subtotal"],
    "sucursal": ["sucursal", "tienda", "local", "sede"],
}
OBLIGATORIAS = ("fecha", "comprobante", "producto", "cantidad", "precio")
FILAS_A_REVISAR = 15            # en cuántas filas se busca el encabezado
TOLERANCIA_TOTAL = 0.05         # diferencia aceptada entre el total y cantidad × precio
PALABRAS_NO_SUCURSAL = {"ventas", "venta", "reporte", "report", "consolidado", "mes", "del", "de", "xlsx"}
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"]
MESES_CORTOS = {m[:3] for m in MESES} | {"sep", "set", "sept"}

AZUL, CELESTE, GRIS = "0A1F44", "00B4FF", "F3F6FA"
FUENTE = "Calibri"


# --------------------------------------------------------------------------
# Estructuras
# --------------------------------------------------------------------------
@dataclass
class Linea:
    sucursal: str
    fecha: date
    comprobante: str
    cliente: str
    producto: str
    cantidad: float
    precio: float
    archivo: str
    fila: int

    @property
    def total(self) -> float:
        return round(self.cantidad * self.precio, 2)


@dataclass
class Observacion:
    archivo: str
    hoja: str
    fila: int | None
    tipo: str          # Excluida | Corregida | Omitida | Unificada
    detalle: str
    valor: str = ""


@dataclass
class InfoArchivo:
    archivo: str
    sucursal: str = ""
    hoja: str = ""
    fila_encabezado: int | None = None
    leidas: int = 0
    validas: int = 0
    excluidas: int = 0
    estado: str = "Procesado"
    columnas: dict = field(default_factory=dict)


# --------------------------------------------------------------------------
# Limpieza de valores
# --------------------------------------------------------------------------
def normalizar(texto) -> str:
    """'P. Unit. (S/)' -> 'p unit s'  ·  'Razón social / Cliente' -> 'razon social cliente'"""
    t = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode().lower()
    t = t.replace("n°", "n ").replace("nº", "n ")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


SINONIMOS_NORM = {campo: {normalizar(s) for s in lista} for campo, lista in SINONIMOS.items()}


def leer_fecha(valor) -> date | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, (int, float)) and 20000 < valor < 80000:      # número de serie de Excel
        return date(1899, 12, 30) + timedelta(days=int(valor))
    texto = str(valor).strip()
    for patron, orden in ((r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$", "dma"), (r"(\d{4})-(\d{1,2})-(\d{1,2})", "amd"),
                          (r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$", "dma2")):
        m = re.match(patron, texto)
        if m:
            a, b, c = (int(x) for x in m.groups())
            try:
                if orden == "amd":
                    return date(a, b, c)
                return date(c + 2000 if orden == "dma2" else c, b, a)
            except ValueError:
                return None
    return None


def leer_monto(valor) -> float | None:
    """Acepta 1250.5 · '1,250.50' · '1.250,50' · 'S/ 1 250' · '(120.00)' (negativo)."""
    if valor is None or valor == "":
        return None
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    texto = str(valor).strip().upper().replace("S/.", "").replace("S/", "").replace("PEN", "").replace(" ", "").replace(" ", "")
    negativo = texto.startswith("(") and texto.endswith(")")
    texto = texto.strip("()")
    if not re.fullmatch(r"-?[\d.,]+", texto or "x"):
        return None
    if "," in texto and "." in texto:
        decimal = "," if texto.rfind(",") > texto.rfind(".") else "."
        miles = "." if decimal == "," else ","
        texto = texto.replace(miles, "").replace(decimal, ".")
    elif "," in texto:
        texto = texto.replace(",", "") if re.fullmatch(r"-?\d{1,3}(,\d{3})+", texto) else texto.replace(",", ".")
    elif re.fullmatch(r"-?\d{1,3}(\.\d{3}){2,}", texto):
        texto = texto.replace(".", "")
    try:
        n = float(texto)
    except ValueError:
        return None
    return -n if negativo else n


def normalizar_comprobante(valor) -> tuple[str, bool]:
    """'b003-45' -> ('B003-00000045', True). Devuelve (texto, si tiene el formato serie-número)."""
    texto = str(valor or "").strip().upper().replace(" ", "")
    m = re.fullmatch(r"([BFE][A-Z0-9]{3})-?0*(\d{1,8})", texto)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):08d}", True
    return texto, False


def limpiar_texto(valor) -> str:
    return re.sub(r"\s+", " ", str(valor or "")).strip()


def sucursal_desde_nombre(nombre: str) -> str:
    partes = [p for p in re.split(r"[_\-\s.]+", Path(nombre).stem.lower()) if p]
    utiles = [p for p in partes if p not in PALABRAS_NO_SUCURSAL and p not in MESES and p not in MESES_CORTOS and not p.isdigit()]
    return " ".join(utiles).title() or Path(nombre).stem


# --------------------------------------------------------------------------
# Lectura de cada archivo
# --------------------------------------------------------------------------
def encontrar_tabla(libro):
    """Recorre las hojas y devuelve (hoja, fila_encabezado, {campo: columna}) o None."""
    mejor = None
    for hoja in libro.worksheets:
        for n_fila, fila in enumerate(hoja.iter_rows(min_row=1, max_row=FILAS_A_REVISAR, values_only=True), start=1):
            columnas = {}
            for n_col, valor in enumerate(fila, start=1):
                clave = normalizar(valor)
                for campo, opciones in SINONIMOS_NORM.items():
                    if clave in opciones and campo not in columnas:
                        columnas[campo] = n_col
            faltan = [c for c in OBLIGATORIAS if c not in columnas]
            if not faltan:
                return hoja, n_fila, columnas, []
            if mejor is None or len(faltan) < len(mejor[3]):
                mejor = (hoja, n_fila, columnas, faltan)
    return None if mejor is None else (None, None, None, mejor[3])


def leer_archivo(ruta: Path, observaciones: list[Observacion], hoy: date) -> tuple[list[Linea], InfoArchivo, Counter]:
    info = InfoArchivo(archivo=ruta.name)
    variantes: Counter = Counter()
    try:
        libro = load_workbook(ruta, data_only=True)
    except Exception as error:          # archivo dañado o que no es Excel
        info.estado = "No se pudo abrir"
        observaciones.append(Observacion(ruta.name, "", None, "Omitida", f"El archivo no se pudo abrir como Excel ({type(error).__name__})."))
        return [], info, variantes

    hoja, fila_enc, columnas, faltan = encontrar_tabla(libro)
    if hoja is None:
        info.estado = "Sin tabla de ventas"
        observaciones.append(Observacion(ruta.name, "", None, "Omitida",
                                         "No se encontró una tabla de ventas. Faltan las columnas: " + ", ".join(faltan) + "."))
        return [], info, variantes

    info.hoja, info.fila_encabezado, info.columnas = hoja.title, fila_enc, columnas
    info.sucursal = sucursal_desde_nombre(ruta.name)
    lineas: list[Linea] = []

    def obs(fila, tipo, detalle, valor=""):
        observaciones.append(Observacion(ruta.name, hoja.title, fila, tipo, detalle, "" if valor is None else str(valor)))

    for n_fila, fila in enumerate(hoja.iter_rows(min_row=fila_enc + 1, values_only=True), start=fila_enc + 1):
        celda = lambda campo: fila[columnas[campo] - 1] if campo in columnas and columnas[campo] - 1 < len(fila) else None
        valores = [v for v in fila if v not in (None, "")]
        if not valores:
            continue                                            # fila vacía
        texto_fila = " ".join(normalizar(v) for v in valores if isinstance(v, str))
        if re.match(r"^(total|totales|sub ?total)\b", texto_fila) and not leer_fecha(celda("fecha")):
            obs(n_fila, "Omitida", "Fila de totales del reporte (no es una venta).")
            continue
        info.leidas += 1
        errores = []
        fecha = leer_fecha(celda("fecha"))
        if fecha is None:
            errores.append("fecha vacía o no válida")
        elif fecha > hoy:
            errores.append("fecha futura")
        comprobante, formato_ok = normalizar_comprobante(celda("comprobante"))
        if not comprobante:
            errores.append("sin número de comprobante")
        producto_original = limpiar_texto(celda("producto"))
        if not producto_original:
            errores.append("sin producto")
        cantidad = leer_monto(celda("cantidad"))
        if cantidad is None:
            errores.append("cantidad no numérica")
        elif cantidad <= 0:
            errores.append("cantidad menor o igual a cero (¿devolución?)")
        precio = leer_monto(celda("precio"))
        if precio is None:
            errores.append("precio no numérico")
        elif precio <= 0:
            errores.append("precio menor o igual a cero")
        if errores:
            info.excluidas += 1
            valor = " | ".join(str(v) for v in fila if v not in (None, ""))
            obs(n_fila, "Excluida", "Fila excluida: " + "; ".join(errores) + ".", valor[:120])
            continue
        if not formato_ok:
            obs(n_fila, "Corregida", "El comprobante no tiene el formato serie-número (ej. B001-00000123); se mantuvo tal cual.", comprobante)
        total = leer_monto(celda("total"))
        if total is not None and abs(total - cantidad * precio) > TOLERANCIA_TOTAL:
            obs(n_fila, "Corregida", f"El total del archivo ({total:,.2f}) no coincide con cantidad × precio ({cantidad * precio:,.2f}); se usó cantidad × precio.", total)
        sucursal = limpiar_texto(celda("sucursal")).title() or info.sucursal
        variantes[producto_original] += 1
        lineas.append(Linea(sucursal, fecha, comprobante, limpiar_texto(celda("cliente")) or "Clientes varios",
                            producto_original, cantidad, round(precio, 4), ruta.name, n_fila))
    info.validas = len(lineas)
    return lineas, info, variantes


# --------------------------------------------------------------------------
# Consolidación
# --------------------------------------------------------------------------
def unificar_productos(lineas: list[Linea], variantes: Counter, observaciones: list[Observacion]) -> int:
    """Agrupa nombres que solo difieren en mayúsculas, tildes o espacios y usa el más frecuente."""
    grupos: dict[str, Counter] = defaultdict(Counter)
    for nombre, n in variantes.items():
        grupos[normalizar(nombre).replace(" ", "")][nombre] += n
    canonico = {}
    unificados = 0
    for clave, conteo in grupos.items():
        nombre_final = conteo.most_common(1)[0][0]
        for nombre, n in conteo.items():
            canonico[nombre] = nombre_final
            if nombre != nombre_final:
                unificados += 1
                observaciones.append(Observacion("(varios)", "", None, "Unificada", f"Nombre de producto unificado en {n} fila(s): «{nombre}» → «{nombre_final}».", nombre))
    for linea in lineas:
        linea.producto = canonico.get(linea.producto, linea.producto)
    return unificados


def quitar_duplicados(lineas: list[Linea], observaciones: list[Observacion], infos: dict) -> list[Linea]:
    vistas, unicas = {}, []
    for linea in lineas:
        clave = (linea.sucursal, linea.comprobante, normalizar(linea.producto), linea.cantidad, linea.precio)
        if clave in vistas:
            original = vistas[clave]
            observaciones.append(Observacion(linea.archivo, infos[linea.archivo].hoja, linea.fila, "Excluida",
                                             f"Línea duplicada: es igual a la fila {original.fila} de {original.archivo} (mismo comprobante, producto, cantidad y precio).", linea.comprobante))
            infos[linea.archivo].validas -= 1
            infos[linea.archivo].excluidas += 1
            continue
        vistas[clave] = linea
        unicas.append(linea)
    return unicas


def filtrar_periodo(lineas: list[Linea], periodo: str | None, observaciones: list[Observacion], infos: dict) -> tuple[list[Linea], str]:
    if not lineas:
        return lineas, periodo or ""
    if not periodo:                                   # el mes con más ventas
        periodo = Counter(l.fecha.strftime("%Y-%m") for l in lineas).most_common(1)[0][0]
    dentro = []
    for linea in lineas:
        if linea.fecha.strftime("%Y-%m") == periodo:
            dentro.append(linea)
        else:
            observaciones.append(Observacion(linea.archivo, infos[linea.archivo].hoja, linea.fila, "Excluida",
                                             f"Fecha fuera del período: {linea.fecha:%d/%m/%Y} no pertenece a {nombre_periodo(periodo)}.", linea.fecha.strftime("%d/%m/%Y")))
            infos[linea.archivo].validas -= 1
            infos[linea.archivo].excluidas += 1
    return dentro, periodo


def nombre_periodo(periodo: str) -> str:
    anio, mes = periodo.split("-")
    return f"{MESES[int(mes) - 1]} {anio}"


def resumir(lineas: list[Linea]) -> dict:
    por_sucursal = defaultdict(lambda: {"comprobantes": set(), "unidades": 0.0, "venta": 0.0})
    por_producto = defaultdict(lambda: {"unidades": 0.0, "venta": 0.0})
    por_dia = defaultdict(float)
    for l in lineas:
        s = por_sucursal[l.sucursal]
        s["comprobantes"].add(l.comprobante); s["unidades"] += l.cantidad; s["venta"] += l.total
        p = por_producto[l.producto]
        p["unidades"] += l.cantidad; p["venta"] += l.total
        por_dia[l.fecha] += l.total
    total = round(sum(l.total for l in lineas), 2)
    comprobantes = len({(l.sucursal, l.comprobante) for l in lineas})
    return {
        "venta_total": total,
        "comprobantes": comprobantes,
        "unidades": round(sum(l.cantidad for l in lineas), 2),
        "ticket_promedio": round(total / comprobantes, 2) if comprobantes else 0,
        "por_sucursal": sorted(({"sucursal": k, "comprobantes": len(v["comprobantes"]), "unidades": round(v["unidades"], 2), "venta": round(v["venta"], 2),
                                 "ticket": round(v["venta"] / len(v["comprobantes"]), 2), "participacion": round(v["venta"] / total * 100, 1) if total else 0}
                                for k, v in por_sucursal.items()), key=lambda x: -x["venta"]),
        "por_producto": sorted(({"producto": k, "unidades": round(v["unidades"], 2), "venta": round(v["venta"], 2),
                                 "participacion": round(v["venta"] / total * 100, 1) if total else 0} for k, v in por_producto.items()), key=lambda x: -x["venta"]),
        "por_dia": [{"fecha": d.isoformat(), "venta": round(v, 2)} for d, v in sorted(por_dia.items())],
    }


# --------------------------------------------------------------------------
# Excel de salida
# --------------------------------------------------------------------------
BORDE = Border(bottom=Side(style="thin", color="D9E1EC"))
ENCABEZADO = dict(font=Font(name=FUENTE, bold=True, color="FFFFFF"), fill=PatternFill("solid", fgColor=AZUL), alignment=Alignment(vertical="center", wrap_text=True))
SOLES = '"S/" #,##0.00'


def estilo_encabezado(hoja, fila, col_ini, col_fin):
    for c in range(col_ini, col_fin + 1):
        celda = hoja.cell(fila, c)
        celda.font, celda.fill, celda.alignment = ENCABEZADO["font"], ENCABEZADO["fill"], ENCABEZADO["alignment"]
    hoja.row_dimensions[fila].height = 22


def anchos(hoja, lista):
    for i, ancho in enumerate(lista, start=1):
        hoja.column_dimensions[get_column_letter(i)].width = ancho


def escribir_excel(salida: Path, lineas: list[Linea], resumen: dict, observaciones: list[Observacion], infos: list[InfoArchivo], periodo: str, generado: datetime):
    libro = Workbook()
    libro.calculation.fullCalcOnLoad = True          # Excel recalcula las fórmulas al abrir

    # ---- Detalle (se escribe primero para que el Resumen pueda referirse a él) ----
    det = libro.active
    det.title = "Detalle"
    cab = ["Sucursal", "Fecha", "Comprobante", "Cliente", "Producto", "Cantidad", "Precio unitario", "Total", "Archivo de origen", "Fila"]
    det.append(cab)
    for l in sorted(lineas, key=lambda x: (x.sucursal, x.fecha, x.comprobante)):
        det.append([l.sucursal, l.fecha, l.comprobante, l.cliente, l.producto, l.cantidad, l.precio, None, l.archivo, l.fila])
        f = det.max_row
        det.cell(f, 8, f"=F{f}*G{f}")                 # el total queda como fórmula, auditable
    ultima = max(det.max_row, 2)
    for fila in det.iter_rows(min_row=2, max_row=ultima):
        fila[1].number_format = "dd/mm/yyyy"
        fila[5].number_format = "#,##0.##"
        fila[6].number_format = SOLES
        fila[7].number_format = SOLES
    anchos(det, [16, 12, 16, 34, 30, 10, 15, 14, 30, 7])
    det.freeze_panes = "A2"
    if lineas:
        tabla = Table(displayName="Ventas", ref=f"A1:J{ultima}")
        tabla.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
        det.add_table(tabla)

    # ---- Resumen ----
    res = libro.create_sheet("Resumen", 0)
    res.sheet_view.showGridLines = False
    anchos(res, [3, 30, 16, 14, 18, 16, 16, 3, 32, 14, 18, 14])
    res["B2"] = "Consolidado de ventas"
    res["B2"].font = Font(name=FUENTE, size=20, bold=True, color=AZUL)
    res["B3"] = f"Período: {nombre_periodo(periodo).capitalize() if periodo else '—'}  ·  Generado el {generado:%d/%m/%Y %H:%M}  ·  {sum(1 for i in infos if i.estado == 'Procesado')} archivo(s) procesado(s)"
    res["B3"].font = Font(name=FUENTE, color="5B6B80")

    indicadores = [("Venta total", f"=SUM(Detalle!H2:H{ultima})", SOLES), ("Comprobantes", resumen["comprobantes"], "#,##0"),
                   ("Unidades vendidas", resumen["unidades"], "#,##0"), ("Ticket promedio", "=C6/D6" if resumen["comprobantes"] else 0, SOLES),
                   ("Filas con observaciones", sum(1 for o in observaciones if o.tipo in ("Excluida", "Corregida")), "#,##0")]
    for col, (nombre, valor, formato) in enumerate(indicadores, start=3):      # columnas C a G
        res.cell(5, col, nombre).font = Font(name=FUENTE, size=9, bold=True, color="5B6B80")
        celda = res.cell(6, col, valor)
        celda.font, celda.number_format = Font(name=FUENTE, size=14, bold=True, color=AZUL), formato
        for f in (5, 6):
            res.cell(f, col).fill = PatternFill("solid", fgColor=GRIS)
    res.cell(5, 2, "Indicadores").font = Font(name=FUENTE, bold=True, color=AZUL)

    # Ventas por sucursal (con fórmulas de total y participación)
    f0 = 9
    res.cell(f0 - 1, 2, "Ventas por sucursal").font = Font(name=FUENTE, size=12, bold=True, color=AZUL)
    for c, t in enumerate(["Sucursal", "Comprobantes", "Unidades", "Venta", "Ticket promedio", "Participación"], start=2):
        res.cell(f0, c, t)
    estilo_encabezado(res, f0, 2, 7)
    sucursales = resumen["por_sucursal"]
    fin = f0 + len(sucursales)
    for i, s in enumerate(sucursales, start=1):
        f = f0 + i
        res.cell(f, 2, s["sucursal"]); res.cell(f, 3, s["comprobantes"]); res.cell(f, 4, s["unidades"])
        res.cell(f, 5, f'=SUMIFS(Detalle!$H$2:$H${ultima},Detalle!$A$2:$A${ultima},B{f})').number_format = SOLES
        res.cell(f, 6, f"=E{f}/C{f}").number_format = SOLES
        res.cell(f, 7, f"=E{f}/$E${fin + 1}").number_format = "0.0%"
        for c in range(2, 8):
            res.cell(f, c).border = BORDE
    ft = fin + 1
    res.cell(ft, 2, "Total")
    for c, letra in ((3, "C"), (4, "D"), (5, "E")):
        res.cell(ft, c, f"=SUM({letra}{f0 + 1}:{letra}{fin})")
    res.cell(ft, 3).number_format = res.cell(ft, 4).number_format = "#,##0"
    res.cell(ft, 5).number_format = SOLES
    res.cell(ft, 6, f"=E{ft}/C{ft}").number_format = SOLES
    res.cell(ft, 7, f"=SUM(G{f0 + 1}:G{fin})").number_format = "0.0%"
    for c in range(2, 8):
        res.cell(ft, c).font = Font(name=FUENTE, bold=True)
        res.cell(ft, c).fill = PatternFill("solid", fgColor="E0F5FF")
    for f in range(f0 + 1, fin + 1):
        res.cell(f, 4).number_format = "#,##0"

    # Productos más vendidos
    res.cell(f0 - 1, 9, "Productos más vendidos").font = Font(name=FUENTE, size=12, bold=True, color=AZUL)
    for c, t in enumerate(["Producto", "Unidades", "Venta", "Participación"], start=9):
        res.cell(f0, c, t)
    estilo_encabezado(res, f0, 9, 12)
    for i, p in enumerate(resumen["por_producto"][:10], start=1):
        f = f0 + i
        res.cell(f, 9, p["producto"]); res.cell(f, 10, p["unidades"]).number_format = "#,##0"
        res.cell(f, 11, p["venta"]).number_format = SOLES
        res.cell(f, 12, p["participacion"] / 100).number_format = "0.0%"
        for c in range(9, 13):
            res.cell(f, c).border = BORDE

    # Gráfico de ventas por sucursal
    if sucursales:
        grafico = BarChart()
        grafico.type, grafico.style = "bar", 10
        grafico.title, grafico.y_axis.title = "Venta por sucursal (S/)", None
        grafico.add_data(Reference(res, min_col=5, min_row=f0, max_row=fin), titles_from_data=True)
        grafico.set_categories(Reference(res, min_col=2, min_row=f0 + 1, max_row=fin))
        grafico.legend = None
        grafico.series[0].graphicalProperties.solidFill = "173A7A"
        grafico.series[0].graphicalProperties.line.solidFill = "173A7A"
        grafico.height, grafico.width = 7.5, 16
        grafico.y_axis.numFmt = '"S/" #,##0'
        grafico.x_axis.scaling.orientation = "maxMin"
        res.add_chart(grafico, f"B{ft + 3}")

    # ---- Observaciones ----
    ob = libro.create_sheet("Observaciones")
    ob.append(["Tipo", "Archivo", "Hoja", "Fila", "Detalle", "Valor original"])
    estilo_encabezado(ob, 1, 1, 6)
    colores = {"Excluida": "FDECEC", "Corregida": "FEF3E2", "Omitida": "F3F6FA", "Unificada": "E0F5FF"}
    orden = {"Excluida": 0, "Corregida": 1, "Unificada": 2, "Omitida": 3}
    for o in sorted(observaciones, key=lambda x: (orden[x.tipo], x.archivo, x.fila or 0)):
        ob.append([o.tipo, o.archivo, o.hoja, o.fila, o.detalle, o.valor])
        ob.cell(ob.max_row, 1).fill = PatternFill("solid", fgColor=colores[o.tipo])
    for fila in ob.iter_rows(min_row=2):
        fila[4].alignment = Alignment(wrap_text=True, vertical="top")
    anchos(ob, [12, 30, 16, 7, 80, 40])
    ob.freeze_panes = "A2"
    ob.auto_filter.ref = f"A1:F{max(ob.max_row, 2)}"

    # ---- Archivos ----
    ar = libro.create_sheet("Archivos")
    ar.append(["Archivo", "Sucursal", "Estado", "Hoja leída", "Fila de encabezados", "Filas leídas", "Filas válidas", "Filas excluidas", "Columnas reconocidas"])
    estilo_encabezado(ar, 1, 1, 9)
    for i in infos:
        ar.append([i.archivo, i.sucursal, i.estado, i.hoja, i.fila_encabezado, i.leidas, i.validas, i.excluidas,
                   ", ".join(f"{k} → col. {get_column_letter(v)}" for k, v in i.columnas.items())])
        if i.estado != "Procesado":
            ar.cell(ar.max_row, 3).fill = PatternFill("solid", fgColor="FDECEC")
    anchos(ar, [32, 16, 20, 16, 12, 11, 11, 12, 90])
    ar.freeze_panes = "A2"

    salida.parent.mkdir(parents=True, exist_ok=True)
    libro.save(salida)


# --------------------------------------------------------------------------
# Proceso principal
# --------------------------------------------------------------------------
def consolidar(archivos: list[Path], salida: Path | None = None, periodo: str | None = None, hoy: date | None = None, log=print) -> dict:
    """Consolida los archivos y escribe el Excel. Devuelve un resumen (también lo usa la demo web)."""
    inicio = time.perf_counter()
    hoy = hoy or date.today()
    if periodo and not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", periodo):
        raise ValueError("El período debe tener el formato AAAA-MM, por ejemplo 2026-10.")
    observaciones: list[Observacion] = []
    todas: list[Linea] = []
    variantes: Counter = Counter()
    infos: dict[str, InfoArchivo] = {}
    archivos = sorted(archivos, key=lambda p: p.name.lower())
    if not archivos:
        raise ValueError("No se encontraron archivos .xlsx para consolidar.")

    for ruta in archivos:
        lineas, info, var = leer_archivo(ruta, observaciones, hoy)
        infos[ruta.name] = info
        todas.extend(lineas)
        variantes.update(var)

    n_unificados = unificar_productos(todas, variantes, observaciones)
    todas = quitar_duplicados(todas, observaciones, infos)
    todas, periodo = filtrar_periodo(todas, periodo, observaciones, infos)
    for info in infos.values():
        if info.estado == "Procesado":
            log(f"  ✓ {info.archivo}: hoja «{info.hoja}», encabezados en la fila {info.fila_encabezado}, {info.validas} filas válidas" + (f", {info.excluidas} excluidas" if info.excluidas else ""))
        else:
            log(f"  ✗ {info.archivo}: {info.estado.lower()} (se omite)")
    if not todas:
        raise ValueError("Ningún archivo tenía filas de ventas válidas.")
    resumen = resumir(todas)
    generado = datetime.now()
    salida = salida or Path("salida") / f"consolidado_ventas_{periodo}.xlsx"
    escribir_excel(salida, todas, resumen, observaciones, list(infos.values()), periodo, generado)

    conteo = Counter(o.tipo for o in observaciones)
    log(f"  · Período consolidado: {nombre_periodo(periodo)}")
    if n_unificados:
        log(f"  · Se unificaron {n_unificados} nombre(s) de producto escritos distinto")
    log(f"  · Observaciones: {conteo['Excluida']} excluida(s), {conteo['Corregida']} corregida(s), {conteo['Omitida']} omitida(s)")
    segundos = round(time.perf_counter() - inicio, 2)
    log(f"Listo: {len(todas)} líneas de venta por S/ {resumen['venta_total']:,.2f} → {salida} ({segundos} s)")

    resumen.update({
        "periodo": periodo, "periodo_texto": nombre_periodo(periodo), "salida": str(salida), "segundos": segundos, "lineas": len(todas),
        "archivos": [vars(i) | {"columnas": {k: get_column_letter(v) for k, v in i.columnas.items()}} for i in infos.values()],
        "observaciones": [vars(o) for o in sorted(observaciones, key=lambda x: (["Excluida", "Corregida", "Unificada", "Omitida"].index(x.tipo), x.archivo, x.fila or 0))],
        "conteo_observaciones": dict(conteo),
    })
    return resumen


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Consolida los reportes de ventas (.xlsx) de una carpeta en un solo Excel con formato.")
    parser.add_argument("entrada", nargs="?", default="entrada", help="carpeta con los archivos .xlsx (por defecto: entrada)")
    parser.add_argument("-o", "--salida", help="ruta del Excel a generar (por defecto: salida/consolidado_ventas_AAAA-MM.xlsx)")
    parser.add_argument("-p", "--periodo", help="mes a consolidar, AAAA-MM (por defecto: el mes con más ventas)")
    args = parser.parse_args(argv)

    carpeta = Path(args.entrada)
    if not carpeta.is_dir():
        print(f"No existe la carpeta «{carpeta}». Crea la carpeta y coloca allí los Excel de cada sucursal.")
        return 1
    archivos = [p for p in carpeta.glob("*.xlsx") if not p.name.startswith("~$")]   # ~$ = archivos temporales de Excel abiertos
    print(f"Consolidando {len(archivos)} archivo(s) de «{carpeta}»…")
    try:
        consolidar(archivos, Path(args.salida) if args.salida else None, args.periodo)
    except ValueError as error:
        print(f"No se pudo consolidar: {error}")
        return 1
    except PermissionError:
        print("No se pudo guardar el resultado: cierra el Excel de salida si lo tienes abierto y vuelve a intentarlo.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
