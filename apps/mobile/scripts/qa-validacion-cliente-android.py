#!/usr/bin/env python3
"""QA E3: validación del formulario Cliente ejecutada en Android.

El caso comprueba la prohibición de registrar clientes sin ubicación
confirmada, verificando la UI y la ausencia de inserción en la API QA.
"""
from __future__ import annotations

import importlib.util
import json
import os
import urllib.request
from pathlib import Path

BASE = Path("apps/mobile/scripts/capturar-evidencias-movil.py")
spec = importlib.util.spec_from_file_location("qa_mobile_base", BASE)
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

API_BASE = "http://127.0.0.1:3001"
CASO = "validacion-cliente-sin-ubicacion-desde-android"
CAPTURA = "MOV-17-cliente-sin-ubicacion-rechazado.png"


def obtener_clientes(token: str) -> list[dict]:
    solicitud = urllib.request.Request(
        API_BASE + "/api/v1/clientes?page=1&limit=100",
        headers={"Authorization": "Bearer " + token},
    )
    with urllib.request.urlopen(solicitud, timeout=20) as respuesta:
        datos = json.load(respuesta)
    return datos["items"] if isinstance(datos, dict) and "items" in datos else datos


def token_qa() -> str:
    payload = {
        "identificador": os.environ["QA_VENDEDOR_IDENTIFICADOR"],
        "contrasena": os.environ["QA_VENDEDOR_PASSWORD"],
    }
    solicitud = urllib.request.Request(
        API_BASE + "/api/v1/auth/login",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(solicitud, timeout=20) as respuesta:
        return json.load(respuesta)["accessToken"]


def ejecutar() -> dict:
    token = token_qa()
    identificador = "CLIENTE-VALIDACION-SIN-UBICACION-QA"
    anteriores = obtener_clientes(token)
    antes = sum(c.get("nombre") == identificador for c in anteriores)

    qa.restart_clean()
    if not qa.login(
        os.environ["QA_VENDEDOR_IDENTIFICADOR"],
        os.environ["QA_VENDEDOR_PASSWORD"],
    ):
        raise RuntimeError("No fue posible iniciar sesión en Android")
    qa.tap_tab("Clientes")
    if not qa.wait_text("Directorio de clientes", seconds=20, exact=True):
        raise RuntimeError("No abrió Clientes")

    # La etiqueta Nombre es un Text sin onPress. El primer EditText del
    # formulario Clientes es el campo Nombre: tocarlo directamente.
    arbol = qa.dump_ui("cliente-antes-nombre")
    if arbol is None:
        raise RuntimeError("No se obtuvo la jerarquía accesible de Clientes")
    editores = [
        n for n in arbol.iter("node")
        if n.attrib.get("class", "").endswith("EditText")
        and n.attrib.get("enabled") == "true"
        and n.attrib.get("bounds")
    ]
    if not editores:
        qa.shot("MOV-97-cliente-sin-editables.png")
        raise RuntimeError("No hay controles editables visibles en Clientes")
    x, y = qa.center(editores[0].attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)])
    qa.input_text(identificador)
    if not qa.foreground_is_app():
        qa.shot("MOV-97-cliente-app-fuera-de-foco.png")
        raise RuntimeError("ZAV perdió el primer plano al escribir el nombre")
    # En CI, pulsar Back para ocultar teclado no siempre es inocuo.
    # Utilizar primero el árbol, y desplazar antes de tocar Guardar.
    encontrado = False
    for _ in range(5):
        if qa.tap_node("Guardar cliente", exact=True):
            encontrado = True
            break
        if not qa.foreground_is_app():
            qa.shot("MOV-97-cliente-app-fuera-de-foco.png")
            raise RuntimeError("ZAV dejó de estar en primer plano")
        qa.swipe_up()
    if not encontrado:
        qa.shot("MOV-97-cliente-boton-no-visible.png")
        raise RuntimeError("No se encontró Guardar cliente después de desplazar")
    if not qa.wait_text("VALIDACIÓN", seconds=12, exact=False):
        qa.shot("MOV-97-cliente-sin-validacion-diagnostico.png")
        raise RuntimeError("No se mostró el error de validación")
    if not qa.wait_text("ubicación", seconds=10):
        qa.shot("MOV-97-cliente-mensaje-diagnostico.png")
        raise RuntimeError("No se observó la indicación de ubicación obligatoria")
    qa.shot(CAPTURA)

    posteriores = obtener_clientes(token)
    despues = sum(c.get("nombre") == identificador for c in posteriores)
    if despues != antes:
        raise RuntimeError(
            f"Registro inválido persistido: antes={antes}, después={despues}"
        )
    return {
        "caso": CASO,
        "resultado": "CORRECTO",
        "comprobacion": "Interfaz rechaza cliente sin ubicación; API QA sin inserción",
        "coincidencias_antes": antes,
        "coincidencias_despues": despues,
        "captura": CAPTURA,
    }


if __name__ == "__main__":
    resultado = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        resultado = ejecutar()
    except Exception as exc:
        resultado["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-validacion-cliente-diagnostico.png")
        except Exception:
            pass
        raise
    finally:
        (qa.OUT / "REPORTE-VALIDACION-CLIENTE.json").write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
