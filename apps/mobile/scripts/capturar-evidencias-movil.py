#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("apps/mobile/test-results/evidencias-movil")
OUT.mkdir(parents=True, exist_ok=True)
PKG = "bo.zav.gestion.vendedor"

def run(args: list[str], check: bool = True, capture: bool = False, timeout: int = 20):
    try:
        return subprocess.run(
            args,
            check=check,
            text=True,
            stdout=subprocess.PIPE if capture else None,
            stderr=subprocess.STDOUT if capture else None,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        if check:
            raise
        return None

def shot(name: str):
    with (OUT / name).open("wb") as fh:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)

def dump_ui(name: str = "ui") -> ET.Element:
    run(["adb", "shell", "uiautomator", "dump", "/sdcard/window.xml"], check=False, timeout=8)
    run(["adb", "pull", "/sdcard/window.xml", str(OUT / f"{name}.xml")], check=False, timeout=8)
    return ET.parse(OUT / f"{name}.xml").getroot()

def center(bounds: str) -> tuple[int, int]:
    nums = [int(x) for x in re.findall(r"\d+", bounds)]
    x1, y1, x2, y2 = nums
    return (x1 + x2) // 2, (y1 + y2) // 2

def find(value: str, contains: bool = False):
    root = dump_ui("ultimo")
    for node in root.iter("node"):
        for key in ("text", "content-desc"):
            current = node.attrib.get(key, "")
            if current == value or (contains and value in current):
                return node
    return None

def tap(value: str, contains: bool = False):
    node = find(value, contains=contains)
    if node is None:
        raise RuntimeError(f"No se encontró {value!r}")
    x, y = center(node.attrib["bounds"])
    run(["adb", "shell", "input", "tap", str(x), str(y)])
    time.sleep(0.8)

def wait_for(value: str, seconds: int = 40):
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            node = find(value, contains=True)
            if node is not None:
                return node
        except Exception:
            pass
        time.sleep(1)
    shot("diagnostico-timeout.png")
    raise RuntimeError(f"No apareció {value!r} en {seconds}s")

def type_text(value: str):
    escaped = value.replace("%", "%25").replace(" ", "%s")
    run(["adb", "shell", "input", "text", escaped])
    time.sleep(0.6)

def dismiss_system_anr():
    for _ in range(8):
        try:
            root = dump_ui("sistema")
            wait_btn = None
            for node in root.iter("node"):
                if node.attrib.get("resource-id") == "android:id/aerr_wait" or node.attrib.get("text") == "Wait":
                    wait_btn = node
                    break
            if wait_btn is None:
                return
            x, y = center(wait_btn.attrib["bounds"])
            run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
            time.sleep(3)
        except Exception:
            time.sleep(2)

def relaunch():
    # El emulador de CI puede mostrar un diálogo transitorio de System UI.
    # El toque corresponde al botón "Wait" del diálogo estándar Pixel; si no
    # existe, se ejecuta antes de lanzar ZAV y no afecta la app.
    run(["adb", "shell", "input", "tap", "540", "1330"], check=False)
    time.sleep(2)
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1"])
    time.sleep(8)

def login(identifier: str, password: str):
    tap("Identificador")
    type_text(identifier)
    tap("Contraseña")
    type_text(password)
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    time.sleep(0.5)
    tap("Iniciar sesión")
    time.sleep(6)

def main():
    vendedor = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    password = os.environ["QA_VENDEDOR_PASSWORD"]

    run(["adb", "reverse", "tcp:3001", "tcp:3001"])
    run(["adb", "shell", "pm", "clear", PKG], check=False)
    relaunch()

    wait_for("Acceso del Vendedor")
    shot("MOV-01-acceso-vendedor.png")

    login("invalido@zav.test", "incorrecta")
    wait_for("HTTP 401")
    shot("MOV-02-error-login-401.png")

    run(["adb", "shell", "pm", "clear", PKG], check=False)
    relaunch()
    wait_for("Acceso del Vendedor")
    login(vendedor, password)

    wait_for("Pedidos")
    wait_for("Cliente Centro QA")
    shot("MOV-03-pedidos.png")

    tap("Nuevo pedido")
    wait_for("Nuevo pedido")
    shot("MOV-04-nuevo-pedido.png")

    tap("Registrar pedido")
    wait_for("VALIDACIÓN")
    shot("MOV-05-validacion-pedido.png")

    tap("Buscar y seleccionar cliente")
    wait_for("Seleccionar cliente")
    shot("MOV-06-selector-clientes.png")
    tap("Elegir")
    wait_for("CLIENTE SELECCIONADO")
    shot("MOV-07-cliente-seleccionado.png")

    tap("Buscar y agregar productos")
    wait_for("Agregar productos")
    wait_for("Jamón cocido QA")
    shot("MOV-08-selector-productos.png")
    tap("Sumar una unidad de Jamón cocido QA")
    tap("Listo")
    wait_for("1 producto(s)")
    shot("MOV-09-pedido-preparado.png")

    tap("Clientes")
    wait_for("Clientes")
    wait_for("Cliente Centro QA")
    shot("MOV-10-clientes.png")

    dump_ui("arbol-final")
    print("Capturas móviles reales generadas:")
    for img in sorted(OUT.glob("MOV-*.png")):
        print(f"- {img.name}: {img.stat().st_size} bytes")

if __name__ == "__main__":
    main()
