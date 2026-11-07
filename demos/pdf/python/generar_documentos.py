"""
generar_documentos.py — Genera documentos PDF en lote a partir de una plantilla y un Excel.

Qué hace
  1. Lee una plantilla de texto (.txt) con campos variables: {Nombres}, {DNI},
     {FechaIngreso:fecha}, {Monto:letras}… La plantilla se edita con el Bloc de notas.
  2. Lee la lista de personas o clientes de un Excel (una fila = un documento).
  3. Antes de generar, revisa que existan todas las columnas que usa la plantilla
     y valida cada fila: campos vacíos, DNI de 8 dígitos, RUC de 11, fechas y montos.
  4. Genera un PDF por fila con nombre automático (ej. Constancia_45871236_Quispe.pdf),
     un PDF con todos juntos para imprimir y un registro en Excel con el código de
     verificación de cada documento.

Uso
  python generar_documentos.py plantillas/constancia_trabajo.txt datos/trabajadores.xlsx
  python generar_documentos.py plantillas/carta_cobranza.txt datos/deudas.xlsx --zip
  python generar_documentos.py PLANTILLA EXCEL --solo-validar      # revisa sin generar

Requisitos: Python 3.9 o superior, fpdf2 y openpyxl (pip install -r requirements.txt).
Autor: Automatización & Sistemas.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
import time
import unicodedata
import warnings
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

warnings.filterwarnings("ignore", message="Pillow could not be imported")   # no se usan imágenes de mapa de bits
from fpdf import FPDF                                                      # noqa: E402
from openpyxl import Workbook, load_workbook                               # noqa: E402
from openpyxl.styles import Alignment, Font, PatternFill                   # noqa: E402

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"]
FORMATOS = {"fecha", "fecha_corta", "soles", "letras", "mayus", "titulo", "dias"}
AZUL = (10, 31, 68)
CELESTE = (0, 180, 255)
GRIS = (91, 107, 128)


# --------------------------------------------------------------------------
# Estructuras
# --------------------------------------------------------------------------
@dataclass
class Plantilla:
    nombre: str
    titulo: str
    archivo: str                       # patrón del nombre de archivo
    cuerpo: str
    datos: dict = field(default_factory=dict)        # empresa, ruc, direccion, lugar, firma_nombre, firma_cargo, prefijo, obligatorios

    def campos(self) -> set[str]:
        """Columnas del Excel que usa la plantilla (sin contar las internas)."""
        texto = "\n".join([self.titulo, self.archivo, self.cuerpo] + [str(v) for v in self.datos.values()])
        usados = {m.group(1) for m in re.finditer(r"\{([A-Za-zÁÉÍÓÚÑáéíóúñ_][\wÁÉÍÓÚÑáéíóúñ]*)(?::\w+)?\}", texto)}
        usados |= {m.group(1) for m in re.finditer(r"\{si (\w+)\}", texto)}
        return {c for c in usados if c not in ("hoy", "codigo", "numero", "si", "sino", "fin")}


@dataclass
class Resultado:
    fila: int
    archivo: str = ""
    codigo: str = ""
    error: str = ""
    resumen: str = ""


# --------------------------------------------------------------------------
# Formatos
# --------------------------------------------------------------------------
UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
            "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO",
            "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"]
DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]


def _hasta_999(n: int) -> str:
    if n == 100:
        return "CIEN"
    c, resto = divmod(n, 100)
    partes = [CENTENAS[c]] if c else []
    if resto < 30:
        partes.append(UNIDADES[resto])
    else:
        d, u = divmod(resto, 10)
        partes.append(DECENAS[d] + (" Y " + UNIDADES[u] if u else ""))
    return " ".join(p for p in partes if p)


def _apocope(texto: str) -> str:
    """Delante de MIL / MILLONES: UNO → UN, VEINTIUNO → VEINTIÚN."""
    if texto.endswith("VEINTIUNO"):
        return texto[:-9] + "VEINTIÚN"
    return texto[:-3] + "UN" if texto.endswith("UNO") else texto


def numero_a_letras(n: int) -> str:
    if n == 0:
        return "CERO"
    millones, resto = divmod(n, 1_000_000)
    miles, unidades = divmod(resto, 1000)
    partes = []
    if millones:
        partes.append("UN MILLÓN" if millones == 1 else _apocope(numero_a_letras(millones)) + " MILLONES")
    if miles:
        partes.append("MIL" if miles == 1 else _apocope(_hasta_999(miles)) + " MIL")
    if unidades:
        partes.append(_hasta_999(unidades))
    return " ".join(partes)


def monto_en_letras(monto: float) -> str:
    """1250.5 → 'MIL DOSCIENTOS CINCUENTA CON 50/100 SOLES' (formato de documentos en el Perú)."""
    centimos = round(monto * 100)
    enteros, cent = divmod(centimos, 100)
    return f"{numero_a_letras(enteros)} CON {cent:02d}/100 SOLES"


def fecha_larga(d: date) -> str:
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def leer_fecha(valor) -> date | None:
    if valor in (None, ""):
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, (int, float)) and 20000 < valor < 80000:
        return date(1899, 12, 30) + timedelta(days=int(valor))
    m = re.fullmatch(r"\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\s*", str(valor)) or None
    try:
        if m:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        m = re.fullmatch(r"\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*", str(valor))
        if m:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return None


def leer_monto(valor) -> float | None:
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    texto = str(valor or "").upper().replace("S/.", "").replace("S/", "").replace(" ", "").strip()
    if not re.fullmatch(r"-?[\d.,]+", texto or "x"):
        return None
    if "," in texto and "." in texto:
        texto = texto.replace(",", "") if texto.rfind(".") > texto.rfind(",") else texto.replace(".", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(",", "") if re.fullmatch(r"-?\d{1,3}(,\d{3})+", texto) else texto.replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def soles(monto: float) -> str:
    return f"S/ {monto:,.2f}"


def texto_pdf(texto: str) -> str:
    """Las fuentes estándar del PDF usan Latin-1: se reemplazan los signos tipográficos que no lo tienen."""
    reemplazos = {"—": "-", "–": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", "•": "-", " ": " ", "€": "EUR"}
    for a, b in reemplazos.items():
        texto = texto.replace(a, b)
    return texto.encode("latin-1", "replace").decode("latin-1")


def nombre_archivo(texto: str) -> str:
    """Quita tildes y caracteres no permitidos en Windows: 'Constancia_Núñez/Pérez' → 'Constancia_Nunez-Perez'."""
    t = unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode()
    t = re.sub(r'[\\/:*?"<>|]+', "-", t).replace(".", "")
    t = re.sub(r"\s+", "_", t.strip())
    return re.sub(r"_+", "_", t)[:120] or "documento"


# --------------------------------------------------------------------------
# Plantilla
# --------------------------------------------------------------------------
def leer_plantilla(texto: str, nombre: str = "plantilla") -> Plantilla:
    """
    Formato:
        ---
        titulo: CONSTANCIA DE TRABAJO
        archivo: Constancia_{DNI}_{ApellidoPaterno}
        empresa: ...            (otros datos del encabezado y la firma)
        ---
        Párrafos del documento. Línea en blanco = nuevo párrafo. **negrita**.
    """
    texto = texto.replace("\r\n", "\n").lstrip("﻿")
    m = re.match(r"\s*---\n(.*?)\n---\n(.*)", texto, re.S)
    if not m:
        raise ValueError("La plantilla debe empezar con un bloque de datos entre dos líneas '---' (título, nombre de archivo, empresa y firma).")
    datos = {}
    for linea in m.group(1).splitlines():
        if linea.strip() and not linea.strip().startswith("#"):
            if ":" not in linea:
                raise ValueError(f"Línea no válida en el encabezado de la plantilla: «{linea.strip()}» (debe ser 'dato: valor').")
            k, v = linea.split(":", 1)
            datos[k.strip().lower()] = v.strip()
    for requerido in ("titulo", "archivo"):
        if not datos.get(requerido):
            raise ValueError(f"Falta «{requerido}:» en el encabezado de la plantilla.")
    cuerpo = m.group(2).strip()
    if len(cuerpo) < 20:
        raise ValueError("El cuerpo de la plantilla está vacío o es muy corto.")
    abiertos, cerrados = len(re.findall(r"\{si \w+\}", cuerpo)), cuerpo.count("{fin}")
    if abiertos != cerrados:
        raise ValueError("Cada {si Campo} debe cerrarse con {fin}.")
    for m2 in re.finditer(r"\{(\w+):(\w+)\}", texto):
        if m2.group(2) not in FORMATOS:
            raise ValueError(f"Formato desconocido «:{m2.group(2)}» en {{{m2.group(1)}:{m2.group(2)}}}. Formatos válidos: {', '.join(sorted(FORMATOS))}.")
    return Plantilla(nombre=nombre, titulo=datos.pop("titulo"), archivo=datos.pop("archivo"), cuerpo=cuerpo, datos=datos)


def leer_excel(ruta: Path) -> tuple[list[str], list[tuple[int, dict]]]:
    """Devuelve (columnas, [(número de fila, {columna: valor})]). Los encabezados están en la primera fila con datos."""
    libro = load_workbook(ruta, data_only=True)
    hoja = libro.worksheets[0]
    filas = list(hoja.iter_rows(values_only=True))
    inicio = next((i for i, f in enumerate(filas[:15]) if sum(1 for v in f if v not in (None, "")) >= 2), None)
    if inicio is None:
        raise ValueError("No se encontraron encabezados en la primera hoja del Excel.")
    columnas = [re.sub(r"\s+", "", str(v)) if v not in (None, "") else "" for v in filas[inicio]]
    registros = []
    for n, f in enumerate(filas[inicio + 1:], start=inicio + 2):
        if all(v in (None, "") for v in f):
            continue
        registros.append((n, {c: (f[i] if i < len(f) else None) for i, c in enumerate(columnas) if c}))
    return [c for c in columnas if c], registros


# --------------------------------------------------------------------------
# Rellenar la plantilla con una fila
# --------------------------------------------------------------------------
def validar_fila(registro: dict, plantilla: Plantilla, hoy: date) -> list[str]:
    errores = []
    obligatorios = [c.strip() for c in plantilla.datos.get("obligatorios", "").split(",") if c.strip()]
    for campo in obligatorios:
        if registro.get(campo) in (None, ""):
            errores.append(f"{campo} vacío")
    for campo, valor in registro.items():
        if valor in (None, ""):
            continue
        clave = campo.lower()
        if clave == "dni" and not re.fullmatch(r"\d{8}", str(valor).strip()):
            errores.append(f"DNI «{valor}» no tiene 8 dígitos")
        if clave == "ruc" and not re.fullmatch(r"(10|15|17|20)\d{9}", str(valor).strip()):
            errores.append(f"RUC «{valor}» no tiene 11 dígitos válidos")
        if clave.startswith("fecha") or clave in ("emision", "vencimiento"):
            d = leer_fecha(valor)
            if d is None:
                errores.append(f"{campo} «{valor}» no es una fecha válida")
            elif d > hoy + timedelta(days=366):
                errores.append(f"{campo} «{valor}» está demasiado lejos en el futuro")
        if clave in ("monto", "importe", "saldo", "sueldo", "remuneracion"):
            m = leer_monto(valor)
            if m is None or m <= 0:
                errores.append(f"{campo} «{valor}» no es un monto válido")
    ingreso, cese = leer_fecha(registro.get("FechaIngreso")), leer_fecha(registro.get("FechaCese"))
    if ingreso and cese and cese < ingreso:
        errores.append("la fecha de cese es anterior a la de ingreso")
    return errores


def valor_formateado(registro: dict, campo: str, formato: str | None, extra: dict) -> str:
    valor = extra.get(campo, registro.get(campo))
    if valor in (None, ""):
        return ""
    if formato in ("fecha", "fecha_corta", "dias"):
        d = leer_fecha(valor)
        if d is None:
            return str(valor)
        if formato == "dias":
            return str(max(0, (extra["hoy"] - d).days))
        return fecha_larga(d) if formato == "fecha" else d.strftime("%d/%m/%Y")
    if formato in ("soles", "letras"):
        m = leer_monto(valor)
        if m is None:
            return str(valor)
        return soles(m) if formato == "soles" else monto_en_letras(m)
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    if isinstance(valor, (datetime, date)):
        valor = fecha_larga(valor if isinstance(valor, date) and not isinstance(valor, datetime) else valor.date())
    texto = re.sub(r"\s+", " ", str(valor)).strip()
    if formato == "mayus":
        return texto.upper()
    if formato == "titulo":
        return texto.title()
    return texto


def rellenar(texto: str, registro: dict, extra: dict) -> str:
    # Bloques condicionales: {si Campo}texto si tiene valor{sino}texto si está vacío{fin}
    def condicional(m):
        tiene = (extra.get(m.group(1)) or registro.get(m.group(1))) not in (None, "")
        return m.group(2) if tiene else (m.group(4) or "")
    texto = re.sub(r"\{si (\w+)\}(.*?)(\{sino\}(.*?))?\{fin\}", condicional, texto, flags=re.S)
    return re.sub(r"\{(\w+)(?::(\w+))?\}", lambda m: valor_formateado(registro, m.group(1), m.group(2), extra), texto)


def codigo_verificacion(plantilla: Plantilla, registro: dict, numero: int, hoy: date) -> str:
    prefijo = plantilla.datos.get("prefijo", "DOC").upper()[:4]
    base = plantilla.nombre + "|" + "|".join(f"{k}={registro[k]}" for k in sorted(registro)) + f"|{numero}|{hoy.isoformat()}"
    return f"{prefijo}-{hoy.year}-{numero:04d}-{hashlib.sha256(base.encode()).hexdigest()[:6].upper()}"


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------
class Documento(FPDF):
    def __init__(self):
        super().__init__(format="A4")
        self.set_margins(25, 22, 25)
        self.set_auto_page_break(True, margin=28)
        self.pie = ""
        self.inicio_documento = 1

    def footer(self):
        self.set_y(-20)
        self.set_draw_color(*CELESTE); self.set_line_width(0.4)
        self.line(25, self.get_y(), 185, self.get_y())
        self.set_font("helvetica", size=7.5); self.set_text_color(*GRIS)
        self.cell(130, 7, texto_pdf(self.pie))
        self.cell(30, 7, f"Página {self.page_no() - self.inicio_documento + 1}", align="R")


def escribir_documento(pdf: Documento, plantilla: Plantilla, registro: dict, extra: dict):
    pdf.add_page()
    pdf.inicio_documento = pdf.page_no()
    d = {k: rellenar(v, registro, extra) for k, v in plantilla.datos.items()}
    pdf.pie = f"Código de verificación: {extra['codigo']}  ·  Documento emitido el {extra['hoy']:%d/%m/%Y}" + (f"  ·  {d['empresa']}" if d.get("empresa") else "")
    # Encabezado con los datos de la empresa
    pdf.set_fill_color(*AZUL); pdf.rect(25, 18, 4, 16, style="F")
    pdf.set_xy(32, 18)
    pdf.set_font("helvetica", "B", 13); pdf.set_text_color(*AZUL)
    pdf.cell(0, 7, texto_pdf(d.get("empresa", "")), new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(32); pdf.set_font("helvetica", size=8.5); pdf.set_text_color(*GRIS)
    linea = "  ·  ".join(x for x in (("RUC " + d["ruc"]) if d.get("ruc") else "", d.get("direccion", "")) if x)
    pdf.cell(0, 5, texto_pdf(linea), new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(220, 226, 236); pdf.set_line_width(0.3); pdf.line(25, 40, 185, 40)
    # Título
    pdf.set_y(52)
    pdf.set_font("helvetica", "B", 15); pdf.set_text_color(*AZUL)
    pdf.cell(0, 9, texto_pdf(rellenar(plantilla.titulo, registro, extra)), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*CELESTE); pdf.set_line_width(0.8); pdf.line(90, pdf.get_y() + 1, 120, pdf.get_y() + 1)
    pdf.ln(12)
    fecha_arriba = d.get("fecha_arriba", "no").strip().lower() in ("si", "sí")
    lugar_fecha = texto_pdf(f"{d.get('lugar', 'Lima')}, {fecha_larga(extra['hoy'])}.")
    if fecha_arriba:                          # en las cartas, la fecha va arriba a la derecha
        pdf.set_font("helvetica", size=11); pdf.set_text_color(30, 41, 59)
        pdf.cell(0, 6, lugar_fecha, align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(6)
    # Cuerpo
    pdf.set_text_color(30, 41, 59); pdf.set_font("helvetica", size=11)
    for parrafo in re.split(r"\n\s*\n", rellenar(plantilla.cuerpo, registro, extra)):
        # Cada línea de la plantilla es una línea del documento; la línea en blanco separa párrafos
        parrafo = "\n".join(l.strip() for l in parrafo.strip().splitlines())
        if not parrafo:
            continue
        if parrafo.startswith("- "):          # viñetas
            for item in [l[2:] if l.startswith("- ") else l for l in parrafo.splitlines()]:
                pdf.set_x(32); pdf.multi_cell(0, 6.5, texto_pdf("-  " + item), align="L", markdown=True, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(3)
            continue
        pdf.multi_cell(0, 6.5, texto_pdf(parrafo), align="J", markdown=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)
    # Lugar, fecha y firma
    if not fecha_arriba:
        pdf.ln(4)
        pdf.cell(0, 6, lugar_fecha, align="R", new_x="LMARGIN", new_y="NEXT")
    if pdf.get_y() > 230:
        pdf.add_page()
    pdf.set_y(max(pdf.get_y() + 26, 0))
    pdf.set_draw_color(30, 41, 59); pdf.set_line_width(0.3); pdf.line(75, pdf.get_y(), 135, pdf.get_y())
    pdf.ln(2)
    pdf.set_font("helvetica", "B", 10.5); pdf.cell(0, 5.5, texto_pdf(d.get("firma_nombre", "")), align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", size=9.5); pdf.set_text_color(*GRIS)
    pdf.cell(0, 5, texto_pdf(d.get("firma_cargo", "")), align="C", new_x="LMARGIN", new_y="NEXT")


# --------------------------------------------------------------------------
# Proceso principal
# --------------------------------------------------------------------------
def generar(plantilla: Plantilla, excel: Path, salida: Path, hoy: date | None = None, solo_validar: bool = False,
            hacer_zip: bool = False, log=print) -> dict:
    inicio = time.perf_counter()
    hoy = hoy or date.today()
    columnas, registros = leer_excel(excel)
    faltan = sorted(plantilla.campos() - set(columnas))
    if faltan:
        raise ValueError("La plantilla usa columnas que no están en el Excel: " + ", ".join(faltan) + ". Columnas del Excel: " + ", ".join(columnas) + ".")
    if not registros:
        raise ValueError("El Excel no tiene filas de datos.")
    log(f"  · Plantilla «{plantilla.nombre}»: usa {len(plantilla.campos())} campo(s) del Excel; todos existen")
    log(f"  · {len(registros)} fila(s) en «{excel.name}»")

    resultados: list[Resultado] = []
    usados: dict[str, int] = {}
    combinado = Documento()
    combinado.set_title(texto_pdf(plantilla.titulo))
    salida.mkdir(parents=True, exist_ok=True)
    numero = 0
    for n_fila, registro in registros:
        errores = validar_fila(registro, plantilla, hoy)
        if errores:
            resultados.append(Resultado(n_fila, error="; ".join(errores)))
            log(f"  ✗ Fila {n_fila}: {'; '.join(errores)}")
            continue
        numero += 1
        extra = {"hoy": hoy, "numero": f"{numero:04d}"}
        extra["codigo"] = codigo_verificacion(plantilla, registro, numero, hoy)
        base = nombre_archivo(rellenar(plantilla.archivo, registro, extra))
        usados[base] = usados.get(base, 0) + 1
        archivo = base + ("" if usados[base] == 1 else f"_{usados[base]}") + ".pdf"
        resumen = rellenar(plantilla.datos.get("resumen", "{" + columnas[0] + "}"), registro, extra)
        resultados.append(Resultado(n_fila, archivo, extra["codigo"], resumen=resumen))
        if solo_validar:
            continue
        pdf = Documento()
        pdf.set_title(texto_pdf(rellenar(plantilla.titulo, registro, extra)))
        pdf.set_author(texto_pdf(plantilla.datos.get("empresa", "")))
        pdf.set_creator("generar_documentos.py - Automatizacion & Sistemas")
        escribir_documento(pdf, plantilla, registro, extra)
        pdf.output(str(salida / archivo))
        escribir_documento(combinado, plantilla, registro, extra)
        log(f"  ✓ {archivo}")

    ok = [r for r in resultados if not r.error]
    archivos_extra = []
    if ok and not solo_validar:
        combinado.output(str(salida / "todos_los_documentos.pdf"))
        archivos_extra.append("todos_los_documentos.pdf")
    escribir_registro(salida / "registro_documentos.xlsx", plantilla, excel.name, resultados, hoy, solo_validar)
    archivos_extra.append("registro_documentos.xlsx")
    zip_ruta = None
    if hacer_zip and ok and not solo_validar:
        zip_ruta = salida / f"{nombre_archivo(plantilla.nombre)}_{hoy:%Y-%m-%d}.zip"
        with zipfile.ZipFile(zip_ruta, "w", zipfile.ZIP_DEFLATED) as z:
            for r in ok:
                z.write(salida / r.archivo, r.archivo)
            for a in archivos_extra:
                z.write(salida / a, a)
    segundos = round(time.perf_counter() - inicio, 2)
    accion = "validado(s)" if solo_validar else "generado(s)"
    log(f"Listo: {len(ok)} documento(s) {accion}, {len(resultados) - len(ok)} fila(s) con errores → {salida} ({segundos} s)")
    return {
        "plantilla": plantilla.nombre, "excel": excel.name, "columnas": columnas, "campos": sorted(plantilla.campos()),
        "generados": len(ok), "con_errores": len(resultados) - len(ok), "segundos": segundos, "salida": str(salida),
        "zip": str(zip_ruta) if zip_ruta else None, "extras": archivos_extra,
        "resultados": [vars(r) for r in resultados],
    }


def escribir_registro(ruta: Path, plantilla: Plantilla, excel: str, resultados: list[Resultado], hoy: date, solo_validar: bool):
    libro = Workbook()
    h = libro.active; h.title = "Registro"
    h.append(["Registro de documentos emitidos" if not solo_validar else "Validación de datos (no se generaron documentos)"])
    h.append([f"Plantilla: {plantilla.nombre}  ·  Datos: {excel}  ·  Fecha: {hoy:%d/%m/%Y}"])
    h.append([])
    h.append(["N°", "Código de verificación", "Archivo", "Documento para", "Fila del Excel"])
    for i, r in enumerate([r for r in resultados if not r.error], start=1):
        h.append([i, r.codigo, r.archivo, r.resumen, r.fila])
    h["A1"].font = Font(size=14, bold=True, color="0A1F44")
    for c in h[4]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="0A1F44")
    for col, ancho in zip("ABCDE", (6, 26, 48, 40, 13)):
        h.column_dimensions[col].width = ancho
    h.freeze_panes = "A5"
    e = libro.create_sheet("Filas con errores")
    e.append(["Fila del Excel", "Motivo (no se generó el documento)"])
    for c in e[1]:
        c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="C62828")
    for r in resultados:
        if r.error:
            e.append([r.fila, r.error])
            e.cell(e.max_row, 2).alignment = Alignment(wrap_text=True)
    e.column_dimensions["A"].width, e.column_dimensions["B"].width = 14, 90
    libro.save(ruta)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Genera un PDF por cada fila de un Excel a partir de una plantilla de texto.")
    parser.add_argument("plantilla", help="archivo .txt de la plantilla")
    parser.add_argument("excel", help="Excel con los datos (una fila = un documento)")
    parser.add_argument("-o", "--salida", help="carpeta de salida (por defecto: salida/<plantilla>_<fecha>)")
    parser.add_argument("--zip", action="store_true", help="además, empaqueta todo en un .zip")
    parser.add_argument("--solo-validar", action="store_true", help="revisa los datos sin generar los PDF")
    args = parser.parse_args(argv)
    try:
        ruta = Path(args.plantilla)
        plantilla = leer_plantilla(ruta.read_text(encoding="utf-8"), ruta.stem)
        salida = Path(args.salida) if args.salida else Path("salida") / f"{ruta.stem}_{date.today():%Y-%m-%d}"
        print(f"Generando documentos con «{ruta.name}» y «{Path(args.excel).name}»…")
        generar(plantilla, Path(args.excel), salida, solo_validar=args.solo_validar, hacer_zip=args.zip)
    except FileNotFoundError as error:
        print(f"No se encontró el archivo: {error.filename}")
        return 1
    except ValueError as error:
        print(f"No se pudo generar: {error}")
        return 1
    except PermissionError:
        print("No se pudo guardar: cierra los PDF o el Excel de registro si los tienes abiertos y vuelve a intentarlo.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
