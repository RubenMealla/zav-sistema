#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("apps/mobile/test-results/evidencias-mobile")
OUT.mkdir(parents=True, exist_ok=True)
PKG = "bo.zav.gestion.vendedor"


def run(args: list[str], check: bool = True, capture: bool = False):
    return subprocess.run(
        args,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )


def screenshot(name: str):
    with (OUT / name).open("wb") as fh:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)


def dump_ui(tag: str = "ui") -> ET.Element:
    run(["adb", "shell", "uiautomator", "dump", "/sdcard/window.xml"], check=False)
    run(["adb", "pull", "/sdcard/window.xml", str(OUT / f"{tag}.xml")], check=False)
    archivo = OUT / f"{tag}.xml"
    if not archivo.exists():
        return ET.Element("hierarchy")
    return ET.parse(archivo).getroot()


def center(bounds: str) -> tuple[int, int]:
    nums = [int(x) for x in re.findall(r"\d+", bounds)]
    x1, y1, x2, y2 = nums
    return (x1 + x2) // 2, (y1 + y2) // 2


def node_for(value: str, contains: bool = False):
    root = dump_ui("ultimo")
    for node in root.iter("node"):
        for attr in ("text", "content-desc"):
            current = node.attrib.get(attr, "")
            if (current == value) or (contains and value in current):
                return node
    return None


def tap(value: str, contains: bool = False):
    node = node_for(value, contains=contains)
    if node is None:
        raise RuntimeError(f"No se encontró {value!r}")
    x, y = center(node.attrib["bounds"])
    run(["adb", "shell", "input", "tap", str(x), str(y)])
    time.sleep(0.8)


def type_text(value: str):
    safe = value.replace("%", "\%").replace(" ", "%s")
    run(["adb", "shell", "input", "text", safe])
    time.sleep(0.4)


def wait_for(value: str, seconds: int = 45):
    end = time.time() + seconds
    while time.time() < end:
        dismiss_system_dialog()
        if node_for(value, contains=True) is not None:
            return
        time.sleep(1)
    screenshot("debug-timeout.png")
    raise RuntimeError(f"No apareció {value!r} en {seconds}s")


def dismiss_system_dialog():
    root = dump_ui("estado")
    all_text = [n.attrib.get("text", "") for n in root.iter("node")]
    if any("isn't responding" in t for t in all_text):
        for label in ("Wait", "Close app"):
            for node in root.iter("node"):
                if node.attrib.get("text") == label:
                    x, y = center(node.attrib["bounds"])
                    run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
                    time.sleep(1)
                    return


def relaunch():
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1"])
    time.sleep(10)
    dismiss_system_dialog()


def login(identifier: str, password: str):
    tap("Identificador")
    type_text(identifier)
    tap("Contraseña")
    type_text(password)
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    tap("Iniciar sesión")
    time.sleep(5)


def main():
    vendedor = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    password = os.environ["QA_VENDEDOR_PASSWORD"]

    run(["adb", "reverse", "tcp:3001", "tcp:3001"])
    run(["adb", "shell", "pm", "clear", PKG])
    relaunch()
    wait_for("Acceso del Vendedor")
    screenshot("mobile-01-acceso.png")

    login("usuario.invalido@zav.test", "incorrecta")
    wait_for("HTTP 401")
    screenshot("mobile-02-error-401.png")

    run(["adb", "shell", "pm", "clear", PKG])
    relaunch()
    wait_for("Acceso del Vendedor")
    login(vendedor, password)
    wait_for("Pedidos")
    screenshot("mobile-03-pedidos.png")

    tap("Nuevo pedido")
    wait_for("Nuevo pedido")
    screenshot("mobile-04-nuevo-pedido.png")

    tap("Clientes")
    wait_for("Clientes")
    screenshot("mobile-05-clientes.png")

    for _ in range(3):
        if node_for("Guardar cliente") is not None:
            break
        run(["adb", "shell", "input", "swipe", "540", "1650", "540", "750", "600"], check=False)
        time.sleep(1)
    tap("Guardar cliente")
    wait_for("VALIDACIÓN")
    screenshot("mobile-06-validacion-cliente.png")

    print("Capturas reales Android:")
    for img in sorted(OUT.glob("*.png")):
        print(f"- {img.name}: {img.stat().st_size} bytes")


if __name__ == "__main__":
    main()
