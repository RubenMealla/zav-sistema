#!/usr/bin/env python3
"""QA Android: corregir un pedido registrado desde la interfaz y comprobar la API.

Precondiciones: datos sintéticos de PostgreSQL del workflow. Se crea por API un
pedido de control para aislar la prueba; la MODIFICACIÓN se ejecuta exclusivamente
mediante la pantalla real de Android.
"""
from __future__ import annotations

import importlib.util
import json
import os
import time
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location("qa_mobile_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py"))
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

API = "http://127.0.0.1:3001"
CASO = "edicion-pedido-registrado-desde-android"
MARCA = "QA-EDICION-CORRECTA-MOVIL"

def verificar(ok: bool, msg: str):
    if not ok:
        raise RuntimeError(msg)

def api(ruta: str, token: str | None = None, datos: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(API + ruta, headers=headers,
        data=json.dumps(datos).encode("utf-8") if datos is not None else None,
        method="POST" if datos is not None else "GET")
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.load(resp)

def ejecutar() -> dict:
    usuario = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    clave = os.environ["QA_VENDEDOR_PASSWORD"]
    token = api("/api/v1/auth/login", datos={"identificador": usuario, "contrasena": clave})["accessToken"]

    # Preparar un pedido REGISTRADO identificable sin depender del orden visual.
    activos = api("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100", token)["items"]
    verificar(len(activos) > 0, "Falta el pedido de referencia para crear el control")
    detalle = api("/api/v1/pedidos/" + activos[0]["id"], token)
    verificar(len(detalle.get("detalles", [])) > 0, "Referencia sin productos")
    pedido = api("/api/v1/pedidos", token, {
        "clienteId": detalle["cliente"]["id"],
        "observacion": "QA-EDICION-INICIAL",
        "detalles": [{"productoId": detalle["detalles"][0]["productoId"], "cantidad": 1}],
    })
    pedido_id = pedido["id"]
    verificar(api("/api/v1/pedidos/" + pedido_id, token)["estado"] == "REGISTRADO",
              "No se creó el pedido sintético REGISTRADO")

    qa.restart_clean()
    verificar(qa.login(usuario, clave), "El APK no inició sesión")
    qa.tap_tab("Pedidos")
    qa.tap_node("Todos activos", exact=True)
    localizado = False
    for _ in range(9):
        if qa.tap_node("Editar pedido", exact=True):
            localizado = True
            break
        qa.swipe_up()
    verificar(localizado, "No se halló Editar pedido")
    verificar(qa.wait_text("Editar pedido", seconds=18), "No abrió el formulario de edición")
    qa.shot("MOV-24-pedido-modo-edicion.png")

    # En el formulario de edición, la única caja TextInput es Observación.
    # La observación queda por debajo de los selectores Cliente/Productos:
    # UIAutomator expone solo los controles renderizados en el viewport.
    cajas = []
    arbol = None
    for _ in range(9):
        arbol = qa.dump_ui("edicion-pedido-formulario")
        verificar(arbol is not None, "Sin árbol accesible del editor")
        cajas = [n for n in arbol.iter("node")
                 if n.attrib.get("class", "").endswith("EditText") and n.attrib.get("bounds")]
        if cajas:
            break
        qa.swipe_up()
    verificar(len(cajas) == 1,
              f"No se encontró el campo Observación tras recorrer el formulario; encontrados={len(cajas)}")
    campo = cajas[0]
    texto_inicial = campo.attrib.get("text", "")
    x, y = qa.center(campo.attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)])
    qa.run(["adb", "shell", "input", "keyevent", "KEYCODE_MOVE_END"], check=False)
    qa.input_text(MARCA)
    qa.hide_keyboard()

    arbol_escrito = qa.dump_ui("edicion-pedido-observacion-modificada")
    verificar(arbol_escrito is not None and any(
        MARCA in n.attrib.get("text", "") for n in arbol_escrito.iter("node")),
        "La observación no quedó escrita en Android")
    qa.shot("MOV-25-pedido-observacion-modificada.png")
    guardado = False
    for _ in range(6):
        if qa.tap_node("Guardar corrección", exact=True):
            guardado = True
            break
        qa.swipe_up()
    verificar(guardado, "No se encontró Guardar corrección")
    verificar(qa.wait_text("Pedido corregido", seconds=25),
              "Android no mostró confirmación de corrección")
    actualizado = api("/api/v1/pedidos/" + pedido_id, token)
    verificar(actualizado.get("estado") == "REGISTRADO",
              "La edición cambió indebidamente el estado")
    verificar(MARCA in (actualizado.get("observacion") or ""),
              "La observación no persistió en la API de QA")
    qa.shot("MOV-26-pedido-corregido-confirmado.png")
    return {
        "caso": CASO, "resultado": "CORRECTO", "pedido_id": pedido_id,
        "observacion_original": texto_inicial,
        "observacion_guardada": actualizado["observacion"], "estado": actualizado["estado"],
        "capturas": ["MOV-24-pedido-modo-edicion.png", "MOV-25-pedido-observacion-modificada.png",
                      "MOV-26-pedido-corregido-confirmado.png"],
        "ambiente": "PostgreSQL QA temporal; pedido creado por API, corrección por Android",
    }

if __name__ == "__main__":
    reporte = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        reporte = ejecutar()
    except Exception as exc:
        reporte["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-edicion-pedido-diagnostico.png")
            qa.dump_ui("diagnostico-edicion-pedido")
        except Exception:
            pass
        raise
    finally:
        reporte["commit"] = os.environ.get("GITHUB_SHA")
        reporte["run_id"] = os.environ.get("GITHUB_RUN_ID")
        (qa.OUT / "REPORTE-EDICION-PEDIDO.json").write_text(
            json.dumps(reporte, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
