"""Pruebas de consolidar.py — ejecutar con:  python -m pytest -q"""
import sys
from datetime import date
from pathlib import Path

import pytest
from openpyxl import Workbook, load_workbook

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import consolidar as c          # noqa: E402
import generar_ejemplos         # noqa: E402

HOY = date(2026, 11, 7)


@pytest.mark.parametrize("valor, esperado", [
    (1250.5, 1250.5), ("1,250.50", 1250.5), ("1.250,50", 1250.5), ("S/ 23.90", 23.9), ("S/. 1 234,5", 1234.5),
    ("(120.00)", -120.0), ("12", 12.0), ("1.234.567", 1234567.0), ("consultar", None), ("", None), (None, None),
])
def test_leer_monto(valor, esperado):
    assert c.leer_monto(valor) == esperado


@pytest.mark.parametrize("valor, esperado", [
    ("05/10/2026", date(2026, 10, 5)), ("5-10-26", date(2026, 10, 5)), ("2026-10-05", date(2026, 10, 5)),
    (46300, date(2026, 10, 5)), ("31/02/2026", None), ("ayer", None), (None, None),
])
def test_leer_fecha(valor, esperado):
    assert c.leer_fecha(valor) == esperado


def test_comprobante_y_encabezados():
    assert c.normalizar_comprobante("b003-45") == ("B003-00000045", True)
    assert c.normalizar_comprobante("F001 00000123") == ("F001-00000123", True)
    assert c.normalizar_comprobante("TICKET 9")[1] is False
    assert c.normalizar("P. Unit. (S/)") == "p unit s"
    assert c.sucursal_desde_nombre("Ventas Trujillo oct-2026.xlsx") == "Trujillo"
    assert c.sucursal_desde_nombre("ventas_lima_centro_2026-10.xlsx") == "Lima Centro"


@pytest.fixture(scope="module")
def resultado(tmp_path_factory):
    carpeta = tmp_path_factory.mktemp("entrada")
    generar_ejemplos.crear(carpeta)
    salida = carpeta.parent / "consolidado.xlsx"
    r = c.consolidar(list(carpeta.glob("*.xlsx")), salida, hoy=HOY, log=lambda *_: None)
    return r, salida


def test_resultado_de_los_ejemplos(resultado):
    r, _ = resultado
    assert r["periodo"] == "2026-10"
    assert r["conteo_observaciones"] == {"Excluida": 8, "Corregida": 1, "Omitida": 2, "Unificada": 10}
    archivos = {a["archivo"]: a for a in r["archivos"]}
    assert archivos["notas_reunion.xlsx"]["estado"] == "Sin tabla de ventas"
    assert archivos["ventas_arequipa_octubre.xlsx"]["fila_encabezado"] == 4
    assert archivos["ventas_chiclayo_2026-10.xlsx"]["hoja"] == "Detalle ventas"
    assert archivos["ventas_piura_2026-10.xlsx"]["excluidas"] == 5
    assert archivos["ventas_cusco_2026-10.xlsx"]["excluidas"] == 3
    assert len(r["por_sucursal"]) == 6
    assert len(r["por_producto"]) == 10                    # las variantes en mayúsculas se unificaron
    assert sum(s["venta"] for s in r["por_sucursal"]) == pytest.approx(r["venta_total"], abs=0.05)


def test_excel_generado(resultado):
    r, salida = resultado
    libro = load_workbook(salida)
    assert libro.sheetnames == ["Resumen", "Detalle", "Observaciones", "Archivos"]
    detalle = libro["Detalle"]
    assert detalle.max_row - 1 == r["lineas"]
    assert "Ventas" in detalle.tables
    assert str(detalle["H2"].value).startswith("=F2*G2")
    suma = sum(fila[5] * fila[6] for fila in detalle.iter_rows(min_row=2, values_only=True))
    assert suma == pytest.approx(r["venta_total"], abs=0.05)
    assert libro["Resumen"]._charts                         # tiene el gráfico
    assert libro["Observaciones"].max_row - 1 == sum(r["conteo_observaciones"].values())


def test_periodo_forzado_y_fecha_futura(tmp_path):
    libro = Workbook(); h = libro.active
    h.append(["Fecha", "Comprobante", "Producto", "Cantidad", "Precio"])
    h.append(["05/10/2026", "B001-1", "Arroz", 2, 10])
    h.append(["06/11/2026", "B001-2", "Arroz", 1, 10])
    h.append(["20/11/2026", "B001-3", "Arroz", 1, 10])     # posterior a "hoy"
    libro.save(tmp_path / "ventas_lince.xlsx")
    r = c.consolidar([tmp_path / "ventas_lince.xlsx"], tmp_path / "s.xlsx", periodo="2026-11", hoy=HOY, log=lambda *_: None)
    assert r["lineas"] == 1 and r["venta_total"] == 10
    detalles = [o["detalle"] for o in r["observaciones"]]
    assert any("fecha futura" in d for d in detalles) and any("fuera del período" in d for d in detalles)
    with pytest.raises(ValueError):
        c.consolidar([tmp_path / "ventas_lince.xlsx"], tmp_path / "s.xlsx", periodo="2026-13")


def test_sin_archivos_validos(tmp_path):
    libro = Workbook(); libro.active.append(["hola"]); libro.save(tmp_path / "x.xlsx")
    with pytest.raises(ValueError):
        c.consolidar([tmp_path / "x.xlsx"], tmp_path / "s.xlsx", log=lambda *_: None)
    (tmp_path / "roto.xlsx").write_text("no soy un excel")
    with pytest.raises(ValueError):
        c.consolidar([tmp_path / "roto.xlsx"], tmp_path / "s.xlsx", log=lambda *_: None)
