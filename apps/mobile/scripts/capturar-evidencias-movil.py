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
VERSION = "2026-10-07.5"


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


def shot(nombre: str):
    destino = OUT / nombre
    with destino.open("wb") as fh:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)
    if destino.stat().st_size < 10_000:
        raise RuntimeError(f"Captura inválida: {nombre}")


def dump_ui(nombre: str = "ui") -> ET.Element | None:
    remoto = "/sdcard/window.xml"
    local = OUT / f"{nombre}.xml"
    r = run(["adb", "shell", "uiautomator", "dump", "--compressed", remoto], check=False, capture=True, timeout=12)
    if r is None or r.returncode != 0:
        return None
    run(["adb", "pull", remoto, str(local)], check=False, timeout=10)
    if not local.exists():
        return None
    try:
        return ET.parse(local).getroot()
    except ET.ParseError:
        return None


def all_nodes():
    root = dump_ui("estado")
    if root is None:
        return []

    # El emulador de GitHub Actions puede mostrar un ANR del proceso Android
    # "system" aun cuando ZAV ya está renderizado detrás del diálogo. No es un
    # error de la app. Si aparece el botón estándar "Wait", se pulsa y se
    # vuelve a leer el árbol de accesibilidad antes de continuar.
    for node in root.iter("node"):
        if node.attrib.get("resource-id") == "android:id/aerr_wait" and node.attrib.get("bounds"):
            x, y = center(node.attrib["bounds"])
            run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
            time.sleep(3)
            root = dump_ui("estado-post-anr")
            break

    return list(root.iter("node")) if root is not None else []


def text_exists(valor: str, exact: bool = False) -> bool:
    objetivo = valor.strip().lower()
    for node in all_nodes():
        for key in ("text", "content-desc"):
            actual = node.attrib.get(key, "").strip().lower()
            if exact and actual == objetivo:
                return True
            if not exact and objetivo in actual:
                return True
    return False


def wait_text(valor: str, seconds: int = 20, exact: bool = False) -> bool:
    end = time.time() + seconds
    while time.time() < end:
        if text_exists(valor, exact=exact):
            return True
        time.sleep(1)
    return False


def center(bounds: str) -> tuple[int, int]:
    nums = [int(x) for x in re.findall(r"\d+", bounds)]
    if len(nums) != 4:
        raise ValueError(bounds)
    x1, y1, x2, y2 = nums
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap_node(valor: str, *, exact: bool = True, desc_only: bool = False) -> bool:
    objetivo = valor.strip().lower()
    root = dump_ui("tap")
    if root is None:
        return False
    keys = ("content-desc",) if desc_only else ("text", "content-desc")
    for node in root.iter("node"):
        for key in keys:
            actual = node.attrib.get(key, "").strip().lower()
            match = actual == objetivo if exact else objetivo in actual
            if match and node.attrib.get("bounds"):
                x, y = center(node.attrib["bounds"])
                run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
                time.sleep(0.8)
                return True
    return False


def input_text(valor: str):
    escaped = valor.replace("%", "%25").replace(" ", "%s")
    run(["adb", "shell", "input", "text", escaped], check=False)
    time.sleep(0.7)


def hide_keyboard():
    resultado = run(["adb", "shell", "dumpsys", "input_method"], check=False, capture=True, timeout=10)
    salida = resultado.stdout.lower() if resultado and resultado.stdout else ""
    if any(x in salida for x in ("minputshown=true", "misinputviewshown=true", "isinputviewshown=true", "mshowrequested=true")):
        run(["adb", "shell", "input", "keyevent", "4"], check=False)
        time.sleep(0.8)


def fill_accessibility(label: str, valor: str):
    if not tap_node(label, exact=True, desc_only=True):
        raise RuntimeError(f"No se encontró el campo accesible {label!r}.")
    input_text(valor)


def foreground_is_app() -> bool:
    r = run(["adb", "shell", "dumpsys", "window", "windows"], check=False, capture=True, timeout=12)
    return PKG in (r.stdout if r and r.stdout else "")


def prepare_device():
    run(["adb", "wait-for-device"], check=False, timeout=60)
    run(["adb", "shell", "settings", "put", "global", "hide_error_dialogs", "1"], check=False)
    for key in ("window_animation_scale", "transition_animation_scale", "animator_duration_scale"):
        run(["adb", "shell", "settings", "put", "global", key, "0"], check=False)
    run(["adb", "shell", "input", "keyevent", "224"], check=False)
    run(["adb", "shell", "wm", "dismiss-keyguard"], check=False)
    time.sleep(5)


def restart_clean():
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "pm", "clear", PKG], check=False)
    run(["adb", "shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity"], check=False, timeout=30)
    end = time.time() + 70
    while time.time() < end:
        if foreground_is_app() and wait_text("Acceso del Vendedor", seconds=3, exact=True):
            return
        run(["adb", "shell", "am", "start", "-n", f"{PKG}/.MainActivity"], check=False, timeout=10)
        time.sleep(2)
    shot("MOV-00-arranque-fallo.png")
    raise RuntimeError("No apareció la pantalla real de acceso.")


def login(identificador: str, password: str) -> bool:
    fill_accessibility("Identificador", identificador)
    fill_accessibility("Contraseña", password)
    hide_keyboard()
    if not tap_node("Iniciar sesión", exact=True):
        raise RuntimeError("No se encontró el botón Iniciar sesión.")
    return wait_text("ZAV · VENDEDOR", seconds=25, exact=True)


def tap_tab(nombre: str):
    if not tap_node(nombre, exact=True):
        raise RuntimeError(f"No se encontró la pestaña {nombre!r}.")
    time.sleep(1)


def swipe_up():
    run(["adb", "shell", "input", "swipe", "540", "1550", "540", "650", "450"], check=False)
    time.sleep(0.8)


def main():
    vendedor = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    password = os.environ["QA_VENDEDOR_PASSWORD"]

    run(["adb", "reverse", "tcp:3001", "tcp:3001"], check=False)
    prepare_device()

    # Acceso.
    restart_clean()
    shot("MOV-01-acceso-vendedor.png")

    # Validación local de campos vacíos.
    if not tap_node("Iniciar sesión", exact=True):
        raise RuntimeError("No se pudo ejecutar la validación del login.")
    if not wait_text("VALIDACIÓN", seconds=8, exact=True):
        raise RuntimeError("No apareció la validación del login.")
    shot("MOV-02-validacion-login.png")

    # Error real de autenticación.
    restart_clean()
    fill_accessibility("Identificador", "usuario.invalido@zav.test")
    fill_accessibility("Contraseña", "incorrecta")
    hide_keyboard()
    tap_node("Iniciar sesión", exact=True)
    if not wait_text("HTTP 401", seconds=20, exact=True):
        shot("MOV-03-error-login-no-expuesto.png")
        raise RuntimeError("Las credenciales inválidas no produjeron HTTP 401 visible.")
    shot("MOV-03-error-login-401.png")

    # Login válido desde estado limpio.
    restart_clean()
    if not login(vendedor, password):
        shot("MOV-04-login-valido-fallo.png")
        raise RuntimeError("El login válido no abrió la pantalla del Vendedor.")
    if not wait_text("Salir", seconds=8, exact=True):
        raise RuntimeError("No se confirmó la pantalla autenticada.")
    time.sleep(2)
    shot("MOV-04-pedidos.png")

    # Nuevo pedido.
    tap_tab("Nuevo pedido")
    if not wait_text("1. Cliente", seconds=10, exact=True):
        raise RuntimeError("No se abrió el formulario Nuevo pedido.")
    shot("MOV-05-nuevo-pedido.png")

    # Selector de cliente.
    if tap_node("Buscar y seleccionar cliente", exact=True):
        if wait_text("Seleccionar cliente", seconds=8, exact=True):
            shot("MOV-06-selector-clientes.png")
        tap_node("Cerrar", exact=True)
        time.sleep(1)

    # Selector de productos.
    if tap_node("Buscar y agregar productos", exact=True):
        if wait_text("Agregar productos", seconds=8, exact=True):
            shot("MOV-07-selector-productos.png")
        tap_node("Cerrar", exact=True)
        time.sleep(1)

    # Validación de pedido incompleto.
    for _ in range(5):
        if tap_node("Registrar pedido", exact=True):
            if wait_text("VALIDACIÓN", seconds=6, exact=True):
                shot("MOV-08-validacion-pedido.png")
            break
        swipe_up()

    # Clientes.
    tap_tab("Clientes")
    if not wait_text("Nuevo cliente", seconds=10, exact=True):
        raise RuntimeError("No se abrió Clientes.")
    shot("MOV-09-clientes.png")

    # Validación de cliente sin datos.
    if tap_node("Guardar cliente", exact=True):
        if wait_text("VALIDACIÓN", seconds=6, exact=True):
            shot("MOV-10-validacion-cliente.png")

    # Selector de ubicación / mapa.
    if tap_node("Definir ubicación", exact=True):
        if wait_text("Confirmar punto en mapa", seconds=15, exact=True):
            time.sleep(5)
            shot("MOV-11-mapa-cliente.png")
        tap_node("Cerrar", exact=True)
        time.sleep(1)

    # Regreso a pedidos con acciones reales.
    tap_tab("Pedidos")
    if not wait_text("ZAV · VENDEDOR", seconds=8, exact=True):
        raise RuntimeError("No se pudo volver a Pedidos.")
    time.sleep(2)
    shot("MOV-12-pedidos-acciones.png")

    capturas = sorted(OUT.glob("MOV-*.png"))
    esenciales = {
        "MOV-01-acceso-vendedor.png",
        "MOV-02-validacion-login.png",
        "MOV-04-pedidos.png",
        "MOV-05-nuevo-pedido.png",
        "MOV-09-clientes.png",
        "MOV-12-pedidos-acciones.png",
    }
    presentes = {p.name for p in capturas}
    faltantes = sorted(esenciales - presentes)
    if faltantes:
        raise RuntimeError(f"Faltan capturas esenciales: {faltantes}")

    manifiesto = OUT / "MANIFIESTO-EVIDENCIAS.txt"
    manifiesto.write_text(
        "ZAV Vendedor · evidencias visuales Android\n"
        "Origen: ADB screencap sobre el APK release real ejecutado en emulador Android.\n"
        "Datos: sintéticos, sembrados en PostgreSQL aislado de QA.\n"
        f"Script: {VERSION}\n"
        "Las figuras son capturas directas de la aplicación; no son recreaciones ni imágenes generadas.\n\n"
        + "\n".join(f"{p.name}\t{p.stat().st_size} bytes" for p in capturas)
        + "\n",
        encoding="utf-8",
    )

    print("CAPTURAS MOVILES GENERADAS")
    for p in capturas:
        print(f"{p.name} {p.stat().st_size}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            shot("MOV-99-fallo-diagnostico.png")
        except Exception:
            pass
        try:
            r = run(["adb", "logcat", "-d", "-t", "1800"], check=False, capture=True, timeout=20)
            if r and r.stdout:
                (OUT / "logcat-mobile.txt").write_text(r.stdout, encoding="utf-8", errors="replace")
        except Exception:
            pass
        raise
