#!/usr/bin/env python3
"""QA Android: conflicto concurrente. Anulación tardía rechazada por servidor.

Se crea un pedido de QA, se abre su confirmación en Android, se simula otro
operador retirándolo mediante API aislada y se comprueba HTTP 409 visible.
No se inyecta el error en el APK ni se modifica la API productiva.
"""
from __future__ import annotations
import importlib.util
import json
import os
import uuid
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location("qa_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py"))
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
API = "http://127.0.0.1:3001"
CASO = "rechazo-anulacion-concurrente-http409-android"

def require(condicion: bool, mensaje: str):
    if not condicion:
        raise RuntimeError(mensaje)

def req(ruta: str, token: str | None = None, datos: dict | None = None) -> dict:
    hdr = {"Content-Type": "application/json"}
    if token:
        hdr["Authorization"] = "Bearer " + token
    r = urllib.request.Request(API + ruta, headers=hdr,
        data=json.dumps(datos).encode() if datos is not None else None,
        method="POST" if datos is not None else "GET")
    with urllib.request.urlopen(r, timeout=25) as f:
        return json.load(f)

def ejecutar() -> dict:
    identificador = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    clave = os.environ["QA_VENDEDOR_PASSWORD"]
    token = req("/api/v1/auth/login", datos={"identificador": identificador, "contrasena": clave})["accessToken"]

    # Una sola tarjeta REGISTRADO para que el objetivo visible sea inequívoco.
    registrados = req("/api/v1/pedidos?estado=REGISTRADO&page=1&limit=100", token)
    require(registrados["total"] == 0,
            "La precondición requiere cero pedidos REGISTRADO; controlar orden de la suite")
    distribucion = req("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100", token)["items"]
    require(distribucion, "No hay pedido de referencia EN_DISTRIBUCION")
    detalle = req("/api/v1/pedidos/" + distribucion[0]["id"], token)
    pedido = req("/api/v1/pedidos", token, {
        "clienteId": detalle["cliente"]["id"],
        "observacion": "QA_CONFLICTO_ANULACION_ANDROID",
        "detalles": [{"productoId": detalle["detalles"][0]["productoId"], "cantidad": 1}],
    })
    pedido_id = pedido["id"]
    require(req("/api/v1/pedidos/" + pedido_id, token)["estado"] == "REGISTRADO",
            "No quedó registrado el pedido de control")

    qa.restart_clean()
    require(qa.login(identificador, clave), "No inició sesión en Android")
    qa.tap_tab("Pedidos")
    qa.tap_node("Todos activos", exact=True)
    for _ in range(9):
        if qa.tap_node("Anular", exact=True):
            break
        qa.swipe_up()
    else:
        raise RuntimeError("No se encontró Anular en la tarjeta registrada")
    require(qa.wait_text("¿Anular el pedido de", seconds=10),
            "No se abrió confirmación nativa de anulación")
    qa.shot("MOV-31-dialogo-anulacion-antes-conflicto.png")
    arbol = qa.dump_ui("qa-conflicto-dialogo")
    require(arbol is not None, "Sin diálogo accesible")
    botones = [n for n in arbol.iter("node") if n.attrib.get("resource-id") == "android:id/button1"
               and n.attrib.get("clickable") == "true" and n.attrib.get("bounds")]
    require(len(botones) == 1, "No se encontró botón positivo inequívoco")

    # Simular concurrencia controlada: retiro entre confirmación y envío.
    req("/api/v1/pedidos/" + pedido_id + "/retiro", token,
        {"operacionClave": str(uuid.uuid4())})
    require(req("/api/v1/pedidos/" + pedido_id, token)["estado"] == "EN_DISTRIBUCION",
            "La operación concurrente no cambió el estado")
    x, y = qa.center(botones[0].attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)], check=True)

    require(qa.wait_text("HTTP 409", seconds=23),
            "No se observó HTTP 409 visible en la interfaz tras anulación tardía")
    qa.shot("MOV-32-anulacion-rechazada-http409.png")
    vigente = req("/api/v1/pedidos/" + pedido_id, token)
    require(vigente["estado"] == "EN_DISTRIBUCION",
            "El servidor no conservó el estado correcto tras rechazar la anulación")
    return {"caso": CASO, "resultado": "CORRECTO", "pedido_id": pedido_id,
            "estado_despues": vigente["estado"], "rechazo": "HTTP 409 mostrado en Android",
            "capturas": ["MOV-31-dialogo-anulacion-antes-conflicto.png",
                          "MOV-32-anulacion-rechazada-http409.png"],
            "nota": "Conflicto reproducido con API y PostgreSQL aislados; no es operación real"}

if __name__ == "__main__":
    resultado = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        resultado = ejecutar()
    except Exception as exc:
        resultado["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-conflicto-anulacion-diagnostico.png")
            qa.dump_ui("conflicto-error")
        except Exception:
            pass
        raise
    finally:
        resultado.update({"run_id": os.environ.get("GITHUB_RUN_ID"),
                          "commit": os.environ.get("GITHUB_SHA")})
        (qa.OUT / "REPORTE-CONFLICTO-ANULACION-ANDROID.json").write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8")
