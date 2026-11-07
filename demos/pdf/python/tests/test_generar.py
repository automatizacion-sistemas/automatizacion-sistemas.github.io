"""Pruebas de generar_documentos.py — ejecutar con:  python -m pytest -q"""
import sys
import zipfile
from datetime import date
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
sys.path.insert(0, str(RAIZ / "datos"))
import generar_documentos as g      # noqa: E402
import generar_ejemplos             # noqa: E402

HOY = date(2026, 11, 7)


@pytest.mark.parametrize("monto, esperado", [
    (0, "CERO CON 00/100 SOLES"), (1, "UNO CON 00/100 SOLES"), (21, "VEINTIUNO CON 00/100 SOLES"), (100, "CIEN CON 00/100 SOLES"),
    (101.5, "CIENTO UNO CON 50/100 SOLES"), (1250.5, "MIL DOSCIENTOS CINCUENTA CON 50/100 SOLES"),
    (21000, "VEINTIÚN MIL CON 00/100 SOLES"), (12750, "DOCE MIL SETECIENTOS CINCUENTA CON 00/100 SOLES"),
    (500700.99, "QUINIENTOS MIL SETECIENTOS CON 99/100 SOLES"), (1000000, "UN MILLÓN CON 00/100 SOLES"),
    (2001001, "DOS MILLONES MIL UNO CON 00/100 SOLES"), (31_000_000, "TREINTA Y UN MILLONES CON 00/100 SOLES"),
])
def test_monto_en_letras(monto, esperado):
    assert g.monto_en_letras(monto) == esperado


def test_formatos_y_nombres():
    assert g.fecha_larga(date(2026, 9, 5)) == "5 de setiembre de 2026"
    assert g.leer_fecha("02/05/2022") == date(2022, 5, 2) and g.leer_fecha("31/02/2022") is None
    assert g.leer_monto("S/ 1,250.50") == 1250.5 and g.leer_monto("1.250,50") == 1250.5 and g.leer_monto("abc") is None
    assert g.nombre_archivo("Cobranza_F001-12_Núñez S.A.C.") == "Cobranza_F001-12_Nunez_SAC"
    assert g.nombre_archivo('a/b:c*?') == "a-b-c-"
    assert g.texto_pdf("“Hola” — ok…") == '"Hola" - ok...'


def test_condicionales_y_campos():
    reg = {"Nombre": "ana", "Cese": None, "Monto": 1500}
    extra = {"hoy": HOY}
    texto = "{Nombre:mayus} {si Cese}cesó{sino}labora{fin} · {Monto:soles} · {Monto:letras}"
    assert g.rellenar(texto, reg, extra) == "ANA labora · S/ 1,500.00 · MIL QUINIENTOS CON 00/100 SOLES"
    assert g.rellenar("{Venc:dias}", {"Venc": "28/10/2026"}, extra) == "10"


def test_plantilla_invalida():
    with pytest.raises(ValueError):
        g.leer_plantilla("sin encabezado")
    with pytest.raises(ValueError):
        g.leer_plantilla("---\ntitulo: X\n---\nTexto suficientemente largo para la prueba")       # falta archivo
    with pytest.raises(ValueError):
        g.leer_plantilla("---\ntitulo: X\narchivo: a\n---\nTexto {si A}sin cierre, bastante largo")
    with pytest.raises(ValueError):
        g.leer_plantilla("---\ntitulo: X\narchivo: a\n---\nTexto con {Monto:euros} bastante largo")


@pytest.fixture(scope="module")
def datos(tmp_path_factory):
    carpeta = tmp_path_factory.mktemp("datos")
    generar_ejemplos.crear(carpeta)
    return carpeta


def plantilla(nombre):
    ruta = RAIZ / "plantillas" / f"{nombre}.txt"
    return g.leer_plantilla(ruta.read_text(encoding="utf-8"), nombre)


def test_constancias(datos, tmp_path):
    r = g.generar(plantilla("constancia_trabajo"), datos / "trabajadores.xlsx", tmp_path, hoy=HOY, hacer_zip=True, log=lambda *_: None)
    assert (r["generados"], r["con_errores"]) == (9, 3)
    errores = {x["fila"]: x["error"] for x in r["resultados"] if x["error"]}
    assert "8 dígitos" in errores[6] and "Cargo vacío" in errores[8] and "cese es anterior" in errores[10]
    pdfs = sorted(p.name for p in tmp_path.glob("Constancia_*.pdf"))
    assert len(pdfs) == 9 and "Constancia_70214589_Nunez.pdf" in pdfs
    for p in tmp_path.glob("*.pdf"):
        assert p.read_bytes()[:5] == b"%PDF-"
    combinado = (tmp_path / "todos_los_documentos.pdf").read_bytes()
    assert combinado.count(b"/Type /Page\n") + combinado.count(b"/Type /Page ") + combinado.count(b"/Type /Page>") >= 9
    registro = load_workbook(tmp_path / "registro_documentos.xlsx")
    assert registro["Registro"].max_row - 4 == 9 and registro["Filas con errores"].max_row - 1 == 3
    codigos = [c.value for c in registro["Registro"]["B"][4:]]
    assert len(set(codigos)) == 9 and all(c.startswith("CT-2026-") for c in codigos)
    with zipfile.ZipFile(r["zip"]) as z:
        assert len(z.namelist()) == 11


def test_cobranzas(datos, tmp_path):
    r = g.generar(plantilla("carta_cobranza"), datos / "deudas.xlsx", tmp_path, hoy=HOY, log=lambda *_: None)
    assert (r["generados"], r["con_errores"]) == (6, 2)
    assert any("RUC" in x["error"] for x in r["resultados"]) and any("Saldo" in x["error"] for x in r["resultados"])


def test_columnas_faltantes_y_solo_validar(datos, tmp_path):
    libro = Workbook(); libro.active.append(["DNI", "Nombres"]); libro.active.append(["12345678", "Ana"])
    libro.save(tmp_path / "incompleto.xlsx")
    with pytest.raises(ValueError, match="ApellidoPaterno"):
        g.generar(plantilla("constancia_trabajo"), tmp_path / "incompleto.xlsx", tmp_path / "s", hoy=HOY, log=lambda *_: None)
    r = g.generar(plantilla("constancia_trabajo"), datos / "trabajadores.xlsx", tmp_path / "v", hoy=HOY, solo_validar=True, log=lambda *_: None)
    assert r["generados"] == 9 and not list((tmp_path / "v").glob("*.pdf"))


def test_nombres_repetidos(tmp_path):
    libro = Workbook(); h = libro.active
    h.append(["Nombre", "Curso"]); h.append(["Ana Ruiz", "Excel"]); h.append(["Ana Ruiz", "Excel"])
    libro.save(tmp_path / "d.xlsx")
    p = g.leer_plantilla("---\ntitulo: CERTIFICADO\narchivo: Certificado_{Nombre}\n---\nSe certifica que {Nombre} aprobó el curso de {Curso}.", "certificado")
    r = g.generar(p, tmp_path / "d.xlsx", tmp_path / "s", hoy=HOY, log=lambda *_: None)
    assert [x["archivo"] for x in r["resultados"]] == ["Certificado_Ana_Ruiz.pdf", "Certificado_Ana_Ruiz_2.pdf"]
