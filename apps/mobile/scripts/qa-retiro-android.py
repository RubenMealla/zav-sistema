#!/usr/bin/env python3
"""QA Android: retiro ejecutado en la interfaz y confirmado en la API aislada."""
import importlib.util
import json
import os
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "qa_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py")
)
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

def assert_true(condicion, mensaje):
    if not condicion:
        raise RuntimeError(mensaje)

def main():
    login = api("/api/v1/auth/login", body={
        "identificador": os.environ["QA_VENDEDOR_IDENTIFICADOR"],
        "contrasena": os.environ["QA_VENDEDOR_PASSWORD"],
    })
    token = login["accessToken"]
    ruta = "/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100"
    antes = api(ruta, token)["total"]
    qa.restart_clean()
    assert_true(qa.login(os.environ["QA_VENDEDOR_IDENTIFICADOR"],
                         os.environ["QA_VENDEDOR_PASSWORD"]), "Falló el acceso al Vendedor")
    qa.tap_tab("Pedidos")
    for _ in range(9):
        if qa.tap_node("Retirar para reparto", exact=True):
            break
        qa.swipe_up()
    else:
        raise RuntimeError("No se encontró la acción Retirar para reparto")
    assert_true(qa.wait_text("¿Confirmas que ya recibiste", seconds=12),
                "No apareció la confirmación de custodia")
    qa.shot("MOV-15-confirmacion-retiro.png")
    assert_true(qa.tap_node("Retirar para reparto", exact=True),
                "No se pudo confirmar el retiro")
    assert_true(qa.wait_text("Pedido retirado.", seconds=25),
                "El retiro no mostró confirmación de éxito")
    despues = api(ruta, token)["total"]
    assert_true(despues == antes + 1,
                f"Pedidos en distribución: antes={antes}, después={despues}")
    qa.shot("MOV-16-retiro-realizado.png")
    return {"caso": "retiro-pedido-desde-android", "resultado": "CORRECTO",
            "en_distribucion_antes": antes, "en_distribucion_despues": despues}

if __name__ == "__main__":
    resultado = {"caso": "retiro-pedido-desde-android", "resultado": "FALLIDO"}
    try:
        resultado = main()
    except Exception as error:
        resultado["error"] = str(error)
        try:
            qa.shot("MOV-97-retiro-diagnostico.png")
        except Exception:
            pass
        raise
    finally:
        (qa.OUT / "REPORTE-RETIRO-ANDROID.json").write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
