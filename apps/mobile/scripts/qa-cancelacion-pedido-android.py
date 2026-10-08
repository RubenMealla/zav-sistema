#!/usr/bin/env python3
"""QA E3: cancelación de pedido ejecutada desde la interfaz Android.

Los conteos se comprueban contra una API/PostgreSQL aislados de QA.
No modifica datos reales de ZAV.
"""
from __future__ import annotations

import importlib.util
import json
import os
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "qa_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py")
)
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

API = "http://127.0.0.1:3001"
CASO = "cancelacion-pedido-desde-android"


def peticion(ruta: str, token: str | None = None, cuerpo: dict | None = None):
    cabeceras = {"Content-Type": "application/json"}
    if token:
        cabeceras["Authorization"] = "Bearer " + token
    solicitud = urllib.request.Request(
        API + ruta,
        data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
        headers=cabeceras,
        method="POST" if cuerpo is not None else "GET",
    )
    with urllib.request.urlopen(solicitud, timeout=20) as respuesta:
        return json.load(respuesta)


def verificar(valor: bool, mensaje: str):
    if not valor:
        raise RuntimeError(mensaje)


def total_estado(token: str, estado: str) -> int:
    return int(
        peticion(f"/api/v1/pedidos?estado={estado}&page=1&limit=100", token)["total"]
    )


def ejecutar() -> dict:
    cuenta = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    clave = os.environ["QA_VENDEDOR_PASSWORD"]
    token = peticion(
        "/api/v1/auth/login",
        cuerpo={"identificador": cuenta, "contrasena": clave},
    )["accessToken"]

    registrados_antes = total_estado(token, "REGISTRADO")
    cancelados_antes = total_estado(token, "CANCELADO")
    verificar(registrados_antes > 0, "No existe pedido REGISTRADO para cancelar")

    qa.restart_clean()
    verificar(qa.login(cuenta, clave), "No se pudo iniciar sesión en Android")
    qa.tap_tab("Pedidos")
    encontrado = False
    for _ in range(8):
        if qa.tap_node("Anular", exact=True):
            encontrado = True
            break
        qa.swipe_up()
    verificar(encontrado, "No se encontró la acción Anular en un pedido REGISTRADO")
    verificar(
        qa.wait_text("¿Anular el pedido de", seconds=12),
        "No se abrió la confirmación de anulación",
    )
    qa.shot("MOV-18-confirmacion-anulacion.png")

    dialogo = qa.dump_ui("dialogo-anulacion-pedido")
    verificar(dialogo is not None, "No se obtuvo el diálogo de anulación")
    positivo = [
        n for n in dialogo.iter("node")
        if n.attrib.get("resource-id") == "android:id/button1"
        and n.attrib.get("clickable") == "true"
        and n.attrib.get("bounds")
    ]
    verificar(len(positivo) == 1, "No se identificó un único botón positivo Android")
    x, y = qa.center(positivo[0].attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)], check=True)

    verificar(
        qa.wait_text("Pedido anulado.", seconds=25),
        "No apareció confirmación de pedido anulado en Android",
    )
    qa.shot("MOV-19-pedido-anulado.png")
    registrados_despues = total_estado(token, "REGISTRADO")
    cancelados_despues = total_estado(token, "CANCELADO")
    verificar(
        cancelados_despues == cancelados_antes + 1,
        f"CANCELADO: antes={cancelados_antes} después={cancelados_despues}",
    )
    verificar(
        registrados_despues == registrados_antes - 1,
        f"REGISTRADO: antes={registrados_antes} después={registrados_despues}",
    )
    return {
        "caso": CASO,
        "resultado": "CORRECTO",
        "registrados_antes": registrados_antes,
        "registrados_despues": registrados_despues,
        "cancelados_antes": cancelados_antes,
        "cancelados_despues": cancelados_despues,
        "capturas": [
            "MOV-18-confirmacion-anulacion.png",
            "MOV-19-pedido-anulado.png",
        ],
    }


if __name__ == "__main__":
    resultado = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        resultado = ejecutar()
    except Exception as exc:
        resultado["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-anulacion-pedido-diagnostico.png")
        except Exception:
            pass
        raise
    finally:
        (qa.OUT / "REPORTE-ANULACION-PEDIDO.json").write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
