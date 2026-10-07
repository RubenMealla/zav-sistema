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
EVIDENCE_SCRIPT_VERSION = "2026-10-07.3"

# Posiciones relativas usadas únicamente como respaldo cuando UIAutomator no
# expone temporalmente el árbol de accesibilidad de React Native.
LOGIN_IDENTIFICADOR = (0.50, 0.405)
LOGIN_PASSWORD = (0.50, 0.490)
LOGIN_BOTON = (0.50, 0.660)
TAB_PEDIDOS = (0.17, 0.105)
TAB_NUEVO = (0.50, 0.105)
TAB_CLIENTES = (0.83, 0.105)


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


def screen_size() -> tuple[int, int]:
    resultado = run(["adb", "shell", "wm", "size"], check=False, capture=True, timeout=10)
    texto = resultado.stdout if resultado and resultado.stdout else ""
    coincidencias = re.findall(r"(\d+)x(\d+)", texto)
    if coincidencias:
        ancho, alto = coincidencias[-1]
        return int(ancho), int(alto)
    return 1080, 2400


ANCHO, ALTO = screen_size()


def punto(relativo: tuple[float, float]) -> tuple[int, int]:
    return round(ANCHO * relativo[0]), round(ALTO * relativo[1])


def tap_xy(x: int, y: int):
    run(["adb", "shell", "input", "tap", str(x), str(y)], check=False)
    time.sleep(0.8)


def tap_rel(relativo: tuple[float, float]):
    tap_xy(*punto(relativo))


def texto(valor: str):
    escaped = (
        valor.replace("%", "%25")
        .replace(" ", "%s")
        .replace("&", "\\&")
    )
    run(["adb", "shell", "input", "text", escaped], check=False)
    time.sleep(0.8)


def shot(nombre: str):
    destino = OUT / nombre
    with destino.open("wb") as fh:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)
    if destino.stat().st_size < 10_000:
        raise RuntimeError(f"Captura demasiado pequeña: {nombre}")


def dump_ui(nombre: str = "ui") -> ET.Element | None:
    remoto = "/sdcard/window.xml"
    local = OUT / f"{nombre}.xml"
    r = run(
        ["adb", "shell", "uiautomator", "dump", "--compressed", remoto],
        check=False,
        capture=True,
        timeout=15,
    )
    if r is None or r.returncode != 0:
        return None
    run(["adb", "pull", remoto, str(local)], check=False, timeout=10)
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
        for clave in ("text", "content-desc"):
            valor = node.attrib.get(clave, "")
            if valor:
                valores.append(valor)
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
    objetivo = valor.lower()
    for node in root.iter("node"):
        for clave in ("text", "content-desc"):
            actual = node.attrib.get(clave, "")
            coincide = actual == valor or (contains and objetivo in actual.lower())
            if coincide and node.attrib.get("bounds"):
                tap_xy(*center(node.attrib["bounds"]))
                return True
    return False


def wait_text(valor: str, seconds: int = 20) -> bool:
    limite = time.time() + seconds
    while time.time() < limite:
        if valor.lower() in textos_ui().lower():
            return True
        time.sleep(1.5)
    return False


def foreground_is_app() -> bool:
    resultado = run(
        ["adb", "shell", "dumpsys", "window", "windows"],
        check=False,
        capture=True,
        timeout=15,
    )
    salida = resultado.stdout if resultado and resultado.stdout else ""
    return PKG in salida


def preparar_dispositivo():
    run(["adb", "wait-for-device"], check=False, timeout=60)
    # Evita que un ANR transitorio del proceso System UI del emulador cubra la
    # aplicación. No modifica la app ni sus validaciones.
    run(["adb", "shell", "settings", "put", "global", "hide_error_dialogs", "1"], check=False)
    for clave in ("window_animation_scale", "transition_animation_scale", "animator_duration_scale"):
        run(["adb", "shell", "settings", "put", "global", clave, "0"], check=False)
    run(["adb", "shell", "settings", "put", "global", "stay_on_while_plugged_in", "3"], check=False)
    run(["adb", "shell", "svc", "bluetooth", "disable"], check=False)
    run(["adb", "shell", "input", "keyevent", "224"], check=False)
    run(["adb", "shell", "wm", "dismiss-keyguard"], check=False)
    time.sleep(8)


def iniciar_limpio():
    preparar_dispositivo()
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "pm", "clear", PKG], check=False)
    run(["adb", "shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity"], check=False, timeout=30)

    # Primer arranque release + React Native puede tardar en CI. En vez de
    # depender de un único dump de UI, se verifica también la actividad.
    limite = time.time() + 90
    while time.time() < limite:
        if foreground_is_app():
            time.sleep(10)
            break
        time.sleep(3)
        run(["adb", "shell", "am", "start", "-n", f"{PKG}/.MainActivity"], check=False)

    # Algunos runners muestran un ANR del proceso System UI aun cuando ZAV ya
    # está en primer plano. Se pulsa "Wait" en la posición del diálogo estándar
    # Pixel y se exige después que la pantalla de acceso sea visible.
    for _ in range(3):
        if wait_text("Acceso del Vendedor", seconds=4):
            break
        tap_xy(round(ANCHO * 0.28), round(ALTO * 0.55))
        time.sleep(3)

    shot("MOV-00-arranque-diagnostico.png")
    if not foreground_is_app():
        raise RuntimeError("ZAV Vendedor no quedó en primer plano en el emulador.")
    if not wait_text("Acceso del Vendedor", seconds=15):
        raise RuntimeError("La pantalla real de acceso de ZAV Vendedor no quedó disponible.")


def borrar_campo(relativo: tuple[float, float], repeticiones: int = 50):
    # En React Native, UIAutomator puede exponer la etiqueta pero no siempre el
    # TextInput editable. Por eso los campos de login usan coordenadas relativas
    # estables verificadas contra la captura real del emulador.
    tap_rel(relativo)
    run(["adb", "shell", "input", "keyevent", "123"], check=False)
    for _ in range(repeticiones):
        run(["adb", "shell", "input", "keyevent", "67"], check=False, timeout=4)
    time.sleep(0.4)


def teclado_visible() -> bool:
    resultado = run(
        ["adb", "shell", "dumpsys", "input_method"],
        check=False,
        capture=True,
        timeout=10,
    )
    salida = (resultado.stdout if resultado and resultado.stdout else "").lower()
    return any(
        marca in salida
        for marca in (
            "minputshown=true",
            "misinputviewshown=true",
            "isinputviewshown=true",
            "mshowrequested=true",
        )
    )


def ocultar_teclado_si_corresponde():
    # KEYCODE_BACK cierra el teclado, pero si el teclado no está visible puede
    # sacar la aplicación al launcher. Se envía solo cuando dumpsys confirma IME.
    if teclado_visible():
        run(["adb", "shell", "input", "keyevent", "4"], check=False)
        time.sleep(1)


def escribir_login(identificador: str, password: str):
    borrar_campo(LOGIN_IDENTIFICADOR)
    texto(identificador)

    borrar_campo(LOGIN_PASSWORD)
    texto(password)

    ocultar_teclado_si_corresponde()
    if not foreground_is_app():
        raise RuntimeError("La aplicación perdió el primer plano al completar el formulario de acceso.")


def pulsar_login():
    if not tap_text("Iniciar sesión", contains=True):
        tap_rel(LOGIN_BOTON)
    time.sleep(1)


def abrir_tab(nombre: str, respaldo: tuple[float, float]):
    if not tap_text(nombre, contains=True):
        tap_rel(respaldo)
    time.sleep(2.5)


def main():
    vendedor = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    password = os.environ["QA_VENDEDOR_PASSWORD"]

    run(["adb", "reverse", "tcp:3001", "tcp:3001"])
    iniciar_limpio()

    # 1. Acceso real.
    shot("MOV-01-acceso-vendedor.png")

    # 2. Validación del cliente con campos vacíos.
    pulsar_login()
    if not wait_text("VALIDACIÓN", seconds=8):
        raise RuntimeError("No apareció la validación de campos vacíos en Login.")
    shot("MOV-02-validacion-login.png")

    # 3. Credenciales inválidas. Esta verificación visual es complementaria:
    # el HTTP 401 ya se acredita de forma determinista en Swagger/API. Si el
    # árbol de accesibilidad de React Native no expone el mensaje en CI, se
    # conserva igualmente la pantalla resultante y se continúa con el flujo
    # funcional móvil, evitando que una limitación del runner bloquee el resto
    # de las evidencias.
    escribir_login("invalido", "incorrecta")
    pulsar_login()
    if wait_text("HTTP 401", seconds=12):
        shot("MOV-03-error-login-401.png")
    else:
        shot("MOV-03-login-invalido.png")
        print("AVISO: UIAutomator no expuso el texto HTTP 401; la prueba API se acredita en Swagger.")

    # 4. Login válido y listado de Pedidos.
    escribir_login(vendedor, password)
    pulsar_login()
    if not wait_text("Pedidos", seconds=25):
        raise RuntimeError("El login válido no abrió la pantalla Pedidos.")
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    time.sleep(1)
    shot("MOV-04-pedidos.png")

    # 5. Formulario Nuevo pedido.
    abrir_tab("Nuevo pedido", TAB_NUEVO)
    if not wait_text("Nuevo pedido", seconds=12):
        raise RuntimeError("No se abrió el formulario Nuevo pedido.")
    shot("MOV-05-nuevo-pedido.png")

    # 6. Validación visible de Pedido incompleto, si el árbol permite localizar
    # la acción. Si no, se conserva la pantalla del formulario y se continúa.
    for _ in range(4):
        if tap_text("Registrar pedido", contains=True):
            time.sleep(1.5)
            shot("MOV-06-validacion-pedido.png")
            break
        run(["adb", "shell", "input", "swipe", str(ANCHO//2), str(round(ALTO*0.80)), str(ANCHO//2), str(round(ALTO*0.36)), "500"], check=False)
        time.sleep(1)

    # 7. Directorio/formulario Clientes.
    abrir_tab("Clientes", TAB_CLIENTES)
    if not wait_text("Clientes", seconds=12):
        raise RuntimeError("No se abrió la pantalla Clientes.")
    shot("MOV-07-clientes.png")

    # 8. Validación de Cliente, si la acción es localizable.
    for _ in range(4):
        if tap_text("Guardar cliente", contains=True):
            time.sleep(1.5)
            shot("MOV-08-validacion-cliente.png")
            break
        run(["adb", "shell", "input", "swipe", str(ANCHO//2), str(round(ALTO*0.80)), str(ANCHO//2), str(round(ALTO*0.36)), "500"], check=False)
        time.sleep(1)

    # 9. Selector geográfico / mapa cuando esté accesible.
    run(["adb", "shell", "input", "swipe", str(ANCHO//2), str(round(ALTO*0.35)), str(ANCHO//2), str(round(ALTO*0.80)), "500"], check=False)
    time.sleep(1)
    for etiqueta in ("Definir ubicación", "Revisar ubicación"):
        if tap_text(etiqueta, contains=True):
            time.sleep(10)
            shot("MOV-09-mapa-cliente.png")
            run(["adb", "shell", "input", "keyevent", "4"], check=False)
            time.sleep(2)
            break

    # 10. Pedidos con acciones visibles.
    abrir_tab("Pedidos", TAB_PEDIDOS)
    if not wait_text("Pedidos", seconds=12):
        raise RuntimeError("No fue posible volver al listado de Pedidos.")
    shot("MOV-10-pedidos-acciones.png")

    dump_ui("arbol-final")

    capturas = sorted(OUT.glob("MOV-*.png"))
    esenciales = {
        "MOV-01-acceso-vendedor.png",
        "MOV-02-validacion-login.png",
        "MOV-03-error-login-401.png",
        "MOV-04-pedidos.png",
        "MOV-05-nuevo-pedido.png",
        "MOV-07-clientes.png",
        "MOV-10-pedidos-acciones.png",
    }
    presentes = {p.name for p in capturas}
    faltantes = sorted(esenciales - presentes)
    if faltantes:
        raise RuntimeError(f"Faltan capturas móviles esenciales: {faltantes}")

    manifiesto = OUT / "MANIFIESTO-EVIDENCIAS.txt"
    manifiesto.write_text(
        "ZAV Vendedor · evidencias visuales Android\n"
        "Origen: captura directa ADB screencap sobre APK release ejecutado en emulador Android.\n"
        f"Resolución: {ANCHO}x{ALTO}\n"
        "Datos: sintéticos, sembrados en PostgreSQL aislado de QA.\n"
        f"Script de captura: {EVIDENCE_SCRIPT_VERSION}\n"
        "Las capturas no son imágenes generadas ni recreaciones gráficas.\n\n"
        + "\n".join(f"{img.name}\t{img.stat().st_size} bytes" for img in capturas)
        + "\n",
        encoding="utf-8",
    )

    print(f"Pantalla del emulador: {ANCHO}x{ALTO}")
    print("Capturas móviles reales generadas:")
    for img in capturas:
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
            resultado = run(
                ["adb", "logcat", "-d", "-t", "2500"],
                check=False,
                capture=True,
                timeout=20,
            )
            if resultado is not None and resultado.stdout:
                (OUT / "logcat-mobile.txt").write_text(
                    resultado.stdout,
                    encoding="utf-8",
                    errors="replace",
                )
        except Exception:
            pass
        raise
