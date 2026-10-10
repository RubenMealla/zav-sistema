#!/usr/bin/env python3
"""Verifica el registro de un pedido mediante la interfaz Android y la API QA."""
import importlib.util
import json
import os
import urllib.request
from pathlib import Path

path = Path("apps/mobile/scripts/capturar-evidencias-movil.py")
spec = importlib.util.spec_from_file_location("qa_base", path)
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

def api(path, token=None, body=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(
        "http://127.0.0.1:3001" + path,
        data=json.dumps(body).encode("utf-8") if body else None,
        headers=headers,
        method="POST" if body else "GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)

def required(ok, message):
    if not ok:
        raise RuntimeError(message)

def tap(label, desc=False):
    required(qa.tap_node(label, exact=True, desc_only=desc), "No se encontró " + label)

def wait(label):
    required(qa.wait_text(label, seconds=25), "No se observó " + label)

def main():
    login = api("/api/v1/auth/login", body={
        "identificador": os.environ["QA_VENDEDOR_IDENTIFICADOR"],
        "contrasena": os.environ["QA_VENDEDOR_PASSWORD"],
    })
    token = login["accessToken"]
    url = "/api/v1/pedidos?estado=REGISTRADO&page=1&limit=100"
    antes = api(url, token)["total"]
    qa.restart_clean()
    required(qa.login(os.environ["QA_VENDEDOR_IDENTIFICADOR"],
                      os.environ["QA_VENDEDOR_PASSWORD"]), "No se inició sesión")
    qa.tap_tab("Nuevo pedido")
    tap("Buscar y seleccionar cliente")
    wait("Seleccionar cliente")
    tap("Cliente Centro QA")
    wait("Cliente Centro QA")
    tap("Buscar y agregar productos")
    wait("Agregar productos")
    tap("Sumar una unidad de Jamón cocido QA", desc=True)
    wait("1 unidad(es)")
    tap("Listo")
    qa.shot("MOV-13-formulario-pedido-completo.png")
    for _ in range(6):
        if qa.tap_node("Registrar pedido", exact=True):
            break
        qa.swipe_up()
    else:
        raise RuntimeError("No se encontró Registrar pedido")
    wait("Pedido registrado.")
    despues = api(url, token)["total"]
    required(despues == antes + 1, "El conteo de pedidos no aumentó en uno")
    qa.shot("MOV-14-pedido-registrado-ui.png")
    return {"caso":"registro-pedido-desde-android", "resultado":"CORRECTO",
            "antes":antes, "despues":despues}

if __name__ == "__main__":
    resultado = {"caso":"registro-pedido-desde-android", "resultado":"FALLIDO"}
    try:
        resultado = main()
    except Exception as error:
        resultado["error"] = str(error)
        try:
            qa.shot("MOV-97-registro-pedido-diagnostico.png")
        except Exception:
            pass
        raise
    finally:
        (qa.OUT / "REPORTE-REGISTRO-PEDIDO.json").write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
