/* ==========================================================================
   python-worker.mjs — Ejecuta consolidar.py con Python real (Pyodide) en un
   hilo aparte, para que la página no se congele mientras trabaja.
   Todo ocurre en el navegador del visitante: los archivos no se suben a
   ningún servidor. Pyodide y openpyxl se sirven desde este mismo sitio.

   Mensajes que recibe:  { tipo: "ejecutar", archivos: [{nombre, bytes}] }
   Mensajes que envía:   { tipo: "estado", texto }   { tipo: "log", texto }
                         { tipo: "listo", resumen, excel, nombre }   { tipo: "error", texto }
   ========================================================================== */
import { loadPyodide } from "../../comun/lib/pyodide/pyodide.mjs";

const LIB = new URL("../../comun/lib/", import.meta.url).href;
const CODIGO = new URL("../python/consolidar.py", import.meta.url).href;
let preparando = null;

function enviar(m, transferir) { self.postMessage(m, transferir || []); }

async function preparar() {
  const inicio = performance.now();
  enviar({ tipo: "estado", texto: "Cargando Python en tu navegador (solo la primera vez)…" });
  const py = await loadPyodide({ indexURL: LIB + "pyodide/", stdout: function (t) { enviar({ tipo: "log", texto: t }); }, stderr: function (t) { enviar({ tipo: "log", texto: t }); } });
  enviar({ tipo: "estado", texto: "Instalando openpyxl…" });
  await py.loadPackage([LIB + "python/et_xmlfile-2.0.0-py3-none-any.whl", LIB + "python/openpyxl-3.1.5-py2.py3-none-any.whl"], { messageCallback: function () {} });
  const codigo = await (await fetch(CODIGO)).text();
  py.FS.writeFile("/home/pyodide/consolidar.py", codigo);
  enviar({ tipo: "log", texto: "Python " + py.runPython("import sys; sys.version.split()[0]") + " listo en " + ((performance.now() - inicio) / 1000).toFixed(1) + " s (openpyxl " + py.runPython("import openpyxl; openpyxl.__version__") + ")" });
  return py;
}

self.enviarLog = function (texto) { enviar({ tipo: "log", texto: String(texto) }); };

self.onmessage = async function (e) {
  if (e.data.tipo !== "ejecutar") return;
  try {
    preparando = preparando || preparar();
    const py = await preparando;
    enviar({ tipo: "estado", texto: "Consolidando…" });
    // Carpeta de entrada limpia en el sistema de archivos virtual de Python
    py.runPython("import shutil, pathlib; shutil.rmtree('entrada', ignore_errors=True); shutil.rmtree('salida', ignore_errors=True); pathlib.Path('entrada').mkdir()");
    e.data.archivos.forEach(function (a) { py.FS.writeFile("/home/pyodide/entrada/" + a.nombre.replace(/[\/\\]/g, "_"), new Uint8Array(a.bytes)); });
    enviar({ tipo: "log", texto: "$ python consolidar.py entrada" });
    enviar({ tipo: "log", texto: "Consolidando " + e.data.archivos.length + " archivo(s) de «entrada»…" });
    const json = await py.runPythonAsync(`
import json, pathlib, importlib
from js import enviarLog
import consolidar
importlib.reload(consolidar)
_archivos = [p for p in pathlib.Path("entrada").glob("*.xlsx") if not p.name.startswith("~$")]
try:
    _r = consolidar.consolidar(_archivos, log=enviarLog)
    _r["ok"] = True
except ValueError as _e:
    _r = {"ok": False, "error": str(_e)}
json.dumps(_r, default=str, ensure_ascii=False)
`);
    const resumen = JSON.parse(json);
    if (!resumen.ok) { enviar({ tipo: "error", texto: resumen.error }); return; }
    const bytes = py.FS.readFile("/home/pyodide/" + resumen.salida);
    enviar({ tipo: "listo", resumen: resumen, excel: bytes.buffer, nombre: resumen.salida.split("/").pop() }, [bytes.buffer]);
  } catch (err) {
    console.error(err);
    preparando = null;
    enviar({ tipo: "error", texto: "Python no pudo ejecutarse en este navegador (" + (err && err.message ? err.message.split("\n").slice(-2).join(" ") : err) + ")." });
  }
};
