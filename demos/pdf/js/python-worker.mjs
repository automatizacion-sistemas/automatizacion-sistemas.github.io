/* ==========================================================================
   python-worker.mjs — Ejecuta generar_documentos.py con Python real (Pyodide)
   en un hilo aparte. Todo ocurre en el navegador del visitante: los datos no
   se suben a ningún servidor. Pyodide y las librerías se sirven desde este sitio.

   Recibe:  { tipo: "analizar", id, plantilla, excel: {nombre, bytes} }
            { tipo: "generar",  id, plantilla, nombrePlantilla, excel: {nombre, bytes} }
   Envía:   { tipo: "estado", texto }  { tipo: "listo-python" }  { tipo: "log", texto }
            { tipo: "analisis", id, datos }  { tipo: "documentos", id, resumen, archivos: [{nombre, bytes}] }
            { tipo: "error", id, texto }
   ========================================================================== */
import { loadPyodide } from "../../comun/lib/pyodide/pyodide.mjs";

const LIB = new URL("../../comun/lib/", import.meta.url).href;
const CODIGO = new URL("../python/generar_documentos.py", import.meta.url).href;
const PAQUETES = ["et_xmlfile-2.0.0-py3-none-any.whl", "openpyxl-3.1.5-py2.py3-none-any.whl", "defusedxml-0.7.1-py2.py3-none-any.whl",
  "fonttools-4.68.0-py3-none-any.whl", "fpdf2-2.9.0-py3-none-any.whl"];
let preparando = null;

function enviar(m, transferir) { self.postMessage(m, transferir || []); }
self.enviarLog = function (texto) { enviar({ tipo: "log", texto: String(texto) }); };

async function preparar() {
  const inicio = performance.now();
  enviar({ tipo: "estado", texto: "Cargando Python en tu navegador…" });
  const py = await loadPyodide({ indexURL: LIB + "pyodide/" });
  enviar({ tipo: "estado", texto: "Instalando fpdf2 y openpyxl…" });
  await py.loadPackage(PAQUETES.map(function (p) { return LIB + "python/" + p; }), { messageCallback: function () {} });
  py.FS.writeFile("/home/pyodide/generar_documentos.py", await (await fetch(CODIGO)).text());
  py.runPython("import generar_documentos");
  enviar({ tipo: "listo-python", texto: "Python " + py.runPython("import sys; sys.version.split()[0]") + " listo en " + ((performance.now() - inicio) / 1000).toFixed(1) + " s" });
  return py;
}

function escribirEntrada(py, d) {
  py.runPython("import shutil, pathlib; shutil.rmtree('trabajo', ignore_errors=True); pathlib.Path('trabajo/salida').mkdir(parents=True)");
  py.FS.writeFile("/home/pyodide/trabajo/plantilla.txt", d.plantilla);
  py.FS.writeFile("/home/pyodide/trabajo/" + d.excel.nombre.replace(/[\/\\]/g, "_"), new Uint8Array(d.excel.bytes));
}

const ANALIZAR = `
import json, pathlib
import generar_documentos as g
from datetime import date
def _analizar(nombre_excel, nombre_plantilla):
    r = {"ok": True}
    try:
        p = g.leer_plantilla(pathlib.Path("trabajo/plantilla.txt").read_text(encoding="utf-8"), nombre_plantilla)
        r["campos"] = sorted(p.campos())
    except ValueError as e:
        p = None
        r["error_plantilla"] = str(e)
    try:
        columnas, filas = g.leer_excel(pathlib.Path("trabajo") / nombre_excel)
    except Exception as e:
        return {"ok": False, "error": "No se pudo leer el Excel: " + str(e)}
    r["columnas"] = columnas
    r["faltan"] = sorted(p.campos() - set(columnas)) if p else []
    hoy = date.today()
    def texto(v):
        if v is None: return ""
        if hasattr(v, "strftime"): return v.strftime("%d/%m/%Y")
        if isinstance(v, float) and v.is_integer(): return str(int(v))
        return str(v)
    r["filas"] = [{"fila": n, "valores": [texto(reg.get(c)) for c in columnas], "errores": g.validar_fila(reg, p, hoy) if p else []} for n, reg in filas]
    return r
`;

self.onmessage = async function (e) {
  const d = e.data;
  try {
    preparando = preparando || preparar();
    const py = await preparando;
    if (d.tipo === "cargar") return;
    escribirEntrada(py, d);
    if (d.tipo === "analizar") {
      py.runPython(ANALIZAR);
      const datos = py.runPython("json.dumps(_analizar(" + JSON.stringify(d.excel.nombre) + ", " + JSON.stringify(d.nombrePlantilla || "plantilla") + "), ensure_ascii=False)");
      enviar({ tipo: "analisis", id: d.id, datos: JSON.parse(datos) });
      return;
    }
    if (d.tipo === "generar") {
      enviar({ tipo: "log", texto: "$ python generar_documentos.py " + d.nombrePlantilla + ".txt " + d.excel.nombre + " --zip" });
      py.globals.set("_excel", d.excel.nombre); py.globals.set("_nombre", d.nombrePlantilla);
      const json = py.runPython(`
import json, pathlib
import generar_documentos as g
from js import enviarLog
enviarLog(f"Generando documentos con «{_nombre}.txt» y «{_excel}»…")
try:
    _p = g.leer_plantilla(pathlib.Path("trabajo/plantilla.txt").read_text(encoding="utf-8"), _nombre)
    _r = g.generar(_p, pathlib.Path("trabajo") / _excel, pathlib.Path("trabajo/salida"), hacer_zip=True, log=enviarLog)
    _r["ok"] = True
except ValueError as _e:
    _r = {"ok": False, "error": str(_e)}
json.dumps(_r, ensure_ascii=False, default=str)
`);
      const resumen = JSON.parse(json);
      if (!resumen.ok) { enviar({ tipo: "error", id: d.id, texto: resumen.error }); return; }
      const nombres = resumen.resultados.filter(function (r) { return !r.error; }).map(function (r) { return r.archivo; }).concat(resumen.extras);
      if (resumen.zip) nombres.push(resumen.zip.split("/").pop());
      const archivos = nombres.map(function (n) { return { nombre: n, bytes: py.FS.readFile("/home/pyodide/trabajo/salida/" + n).buffer }; });
      enviar({ tipo: "documentos", id: d.id, resumen: resumen, archivos: archivos }, archivos.map(function (a) { return a.bytes; }));
    }
  } catch (err) {
    console.error(err);
    if (!(err && err.type)) preparando = null;
    enviar({ tipo: "error", id: d.id, texto: "Python no pudo completar la tarea (" + (err && err.message ? err.message.split("\n").filter(Boolean).slice(-1)[0] : err) + ")." });
  }
};
