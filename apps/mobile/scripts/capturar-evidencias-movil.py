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

# Coordenadas únicamente de respaldo para el Pixel 6 de CI (1080x2400).
LOGIN_IDENTIFICADOR = (540, 1040)
LOGIN_PASSWORD = (540, 1290)
LOGIN_BOTON = (540, 1605)
ANR_WAIT = (300, 1320)

def run(args: list[str], check: bool = True, capture: bool = False, timeout: int = 30):
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

def tap_xy(x: int, y: int):
    run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
    time.sleep(0.8)

def texto(valor: str):
    escaped = valor.replace("%", "%25").replace(" ", "%s")
    run(["adb", "shell", "input", "text", escaped], check=False)
    time.sleep(0.8)

def shot(nombre: str):
    with (OUT / nombre).open("wb") as fh:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)

def dump_ui(nombre: str = "ui") -> ET.Element | None:
    remoto = "/sdcard/window.xml"
    local = OUT / f"{nombre}.xml"
    r = run(["adb", "shell", "uiautomator", "dump", "--compressed", remoto], check=False, capture=True, timeout=20)
    if r is None or r.returncode != 0:
        return None
    run(["adb", "pull", remoto, str(local)], check=False, timeout=15)
    if not local.exists():
        return None
    try:
        return ET.parse(local).getroot()
    except ET.ParseError:
        return None

def textos_ui() -> str:
    root = dump_ui("estado")
    if root is None:
        return ""
    valores: list[str] = []
    for node in root.iter("node"):
        for k in ("text", "content-desc"):
            v = node.attrib.get(k, "")
            if v:
                valores.append(v)
    return "\n".join(valores)

def center(bounds: str) -> tuple[int, int]:
    nums = [int(x) for x in re.findall(r"\d+", bounds)]
    if len(nums) != 4:
        raise ValueError(bounds)
    x1, y1, x2, y2 = nums
    return (x1 + x2) // 2, (y1 + y2) // 2

def tap_text(valor: str, contains: bool = False) -> bool:
    root = dump_ui("tap")
    if root is None:
        return False
    for node in root.iter("node"):
        for key in ("text", "content-desc"):
            actual = node.attrib.get(key, "")
            if actual == valor or (contains and valor.lower() in actual.lower()):
                bounds = node.attrib.get("bounds", "")
                if bounds:
                    x, y = center(bounds)
                    tap_xy(x, y)
                    return True
    return False

def wait_text(valor: str, seconds: int = 30) -> bool:
    deadline = time.time() + seconds
    while time.time() < deadline:
        if valor.lower() in textos_ui().lower():
            return True
        time.sleep(1.5)
    return False

def dismiss_system_anr():
    # El runner puede mostrar un ANR transitorio del proceso Android "system".
    # Solo se pulsa "Wait"; nunca "Close app".
    for _ in range(4):
        ui = textos_ui().lower()
        if "isn't responding" in ui or "is not responding" in ui or "no responde" in ui:
            if not tap_text("Wait"):
                tap_xy(*ANR_WAIT)
            time.sleep(6)
        else:
            return
    # Respaldo visual: la posición de "Wait" es estable en el perfil Pixel 6.
    tap_xy(*ANR_WAIT)
    time.sleep(8)

def iniciar_limpio():
    run(["adb", "shell", "settings", "put", "global", "hide_error_dialogs", "0"], check=False)
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "pm", "clear", PKG], check=False)
    run(["adb", "shell", "am", "start", "-n", f"{PKG}/.MainActivity"], check=False)
    time.sleep(150)
    dismiss_system_anr()
    time.sleep(12)
    shot("MOV-00-arranque-diagnostico.png")
    if not wait_text("Acceso del Vendedor", seconds=25):
        shot("MOV-00-fallo-acceso.png")
        raise RuntimeError("La pantalla Acceso del Vendedor no quedó disponible tras el arranque.")

def borrar_campo(punto: tuple[int, int], repeticiones: int = 60):
    tap_xy(*punto)
    run(["adb", "shell", "input", "keyevent", "123"], check=False)  # MOVE_END
    for _ in range(repeticiones):
        run(["adb", "shell", "input", "keyevent", "67"], check=False, timeout=5)
    time.sleep(0.4)

def escribir_login(identificador: str, password: str):
    borrar_campo(LOGIN_IDENTIFICADOR)
    texto(identificador)
    borrar_campo(LOGIN_PASSWORD)
    texto(password)
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    time.sleep(1)

def main():
    vendedor = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    password = os.environ["QA_VENDEDOR_PASSWORD"]

    run(["adb", "reverse", "tcp:3001", "tcp:3001"])
    iniciar_limpio()

    # 1. Pantalla real de acceso, sin diálogo del sistema.
    shot("MOV-01-acceso-vendedor.png")

    # 2. Validación cliente con campos vacíos.
    tap_xy(*LOGIN_BOTON)
    time.sleep(1.5)
    shot("MOV-02-validacion-login.png")

    # 3. Error HTTP 401 real.
    escribir_login("usuario.invalido@zav.test", "incorrecta")
    tap_xy(*LOGIN_BOTON)
    time.sleep(5)
    if not wait_text("401", seconds=15):
        shot("MOV-03-diagnostico-login.png")
        raise RuntimeError("No apareció la respuesta 401 esperada en la app móvil.")
    shot("MOV-03-error-login-401.png")

    # 4. Login válido.
    escribir_login(vendedor, password)
    tap_xy(*LOGIN_BOTON)
    if not wait_text("Pedidos", seconds=25):
        shot("MOV-04-fallo-login-valido.png")
        raise RuntimeError("El login válido no abrió la pantalla Pedidos.")
    shot("MOV-04-pedidos.png")

    # 5. Nuevo pedido.
    if not tap_text("Nuevo pedido", contains=True):
        raise RuntimeError("No se encontró la acción Nuevo pedido.")
    if not wait_text("Nuevo pedido", seconds=12):
        raise RuntimeError("No se abrió el formulario Nuevo pedido.")
    shot("MOV-05-nuevo-pedido.png")

    # 6. Validación visible de Pedido sin completar.
    if tap_text("Registrar pedido", contains=True):
        time.sleep(1.5)
        shot("MOV-06-validacion-pedido.png")

    # 7. Directorio/formulario de Clientes.
    if not tap_text("Clientes"):
        run(["adb", "shell", "input", "keyevent", "4"], check=False)
        time.sleep(1)
        if not tap_text("Clientes"):
            raise RuntimeError("No se pudo abrir Clientes.")
    if not wait_text("Clientes", seconds=12):
        raise RuntimeError("No se abrió la sección Clientes.")
    shot("MOV-07-clientes.png")

    # 8. Validación de Cliente.
    if tap_text("Guardar cliente", contains=True):
        time.sleep(1.5)
        shot("MOV-08-validacion-cliente.png")

    # 9. Selector geográfico / mapa.
    # Se usa el texto funcional de la pantalla; si cambia, el workflow falla en vez
    # de guardar una captura con nombre incorrecto.
    for etiqueta in ("Definir ubicación", "Ubicación", "Mapa"):
        if tap_text(etiqueta, contains=True):
            time.sleep(8)
            shot("MOV-09-mapa-cliente.png")
            break

    # 10. Regreso a Pedidos para mostrar acciones/estado.
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    time.sleep(1.5)
    if tap_text("Pedidos"):
        time.sleep(2)
    if wait_text("Pedidos", seconds=10):
        shot("MOV-10-pedidos-acciones.png")

    dump_ui("arbol-final")
    print("Capturas móviles verificadas generadas:")
    for img in sorted(OUT.glob("MOV-*.png")):
        print(f"- {img.name}: {img.stat().st_size} bytes")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            shot("MOV-99-fallo-diagnostico.png")
        except Exception:
            pass
        try:
            resultado = run(["adb", "logcat", "-d", "-t", "2500"], check=False, capture=True, timeout=20)
            if resultado is not None and resultado.stdout:
                (OUT / "logcat-mobile.txt").write_text(resultado.stdout, encoding="utf-8", errors="replace")
        except Exception:
            pass
        raise
