#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path("apps/mobile/test-results/evidencias-android-final")
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

def shot(name: str):
    with (OUT / name).open("wb") as fh:
        p = subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)
        if p.returncode != 0:
            raise RuntimeError(f"No se pudo capturar {name}")

def dump_ui(tag: str = "ui") -> ET.Element:
    run(["adb", "shell", "uiautomator", "dump", "/sdcard/window.xml"], check=False)
    run(["adb", "pull", "/sdcard/window.xml", str(OUT / f"{tag}.xml")])
    return ET.parse(OUT / f"{tag}.xml").getroot()

def bounds_center(raw: str) -> tuple[int, int]:
    nums = [int(x) for x in re.findall(r"\d+", raw)]
    if len(nums) != 4:
        raise ValueError(raw)
    x1, y1, x2, y2 = nums
    return ((x1 + x2) // 2, (y1 + y2) // 2)

def find_node(value: str, attr: str | None = None, contains: bool = False):
    root = dump_ui("ultimo")
    attrs = [attr] if attr else ["text", "content-desc"]
    for node in root.iter("node"):
        for key in attrs:
            current = node.attrib.get(key, "")
            if (current == value) or (contains and value in current):
                return node
    return None

def tap(value: str, attr: str | None = None, contains: bool = False):
    node = find_node(value, attr=attr, contains=contains)
    if node is None:
        raise RuntimeError(f"No se encontró nodo {attr or 'text/content-desc'}={value!r}")
    x, y = bounds_center(node.attrib["bounds"])
    run(["adb", "shell", "input", "tap", str(x), str(y)])
    time.sleep(0.5)

def type_text(value: str):
    run(["adb", "shell", "input", "text", value])
    time.sleep(0.4)

def wait_for(value: str, seconds: int = 25):
    end = time.time() + seconds
    while time.time() < end:
        if find_node(value, contains=True) is not None:
            return
        time.sleep(1)
    raise RuntimeError(f"No apareció {value!r} en {seconds}s")

def relaunch():
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1"])
    time.sleep(7)

def login(identifier: str, password: str):
    tap("Identificador", attr="content-desc")
    type_text(identifier)
    tap("Contraseña", attr="content-desc")
    type_text(password)
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    tap("Iniciar sesión")
    time.sleep(8)

def main():
    vendedor = os.environ.get("QA_VENDEDOR_IDENTIFICADOR", "vendedor@zav.test")
    password = os.environ.get("QA_VENDEDOR_PASSWORD", "VendedorQA2026")

    run(["adb", "reverse", "tcp:3001", "tcp:3001"])
    run(["adb", "shell", "pm", "clear", PKG])
    relaunch()
    wait_for("Acceso del Vendedor")
    shot("MOB-01-login.png")

    login("invalido@zav.test", "incorrecta")
    wait_for("HTTP 401")
    shot("MOB-02-login-error-401.png")

    run(["adb", "shell", "pm", "clear", PKG])
    relaunch()
    wait_for("Acceso del Vendedor")
    login(vendedor, password)
    wait_for("Pedidos")
    shot("MOB-03-pedidos.png")

    tap("Nuevo pedido")
    wait_for("Nuevo pedido")
    shot("MOB-04-nuevo-pedido.png")

    tap("Clientes")
    wait_for("Nuevo cliente")
    shot("MOB-05-clientes.png")

    dump_ui("final")
    print("Evidencias Android generadas:")
    for p in sorted(OUT.glob("*.png")):
        print(f"- {p} ({p.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
