#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

OUT = Path("apps/mobile/test-results/evidencias-movil")
OUT.mkdir(parents=True, exist_ok=True)
PKG = "bo.zav.gestion.vendedor"

# Coordenadas calibradas para el perfil Pixel 6 de GitHub Actions (1080x2400).
# Se usan solo para navegación de evidencia; la aplicación no depende de ellas.
LOGIN_IDENTIFICADOR = (540, 1120)
LOGIN_PASSWORD = (540, 1360)
LOGIN_BOTON = (540, 1560)
TAB_PEDIDOS = (180, 350)
TAB_NUEVO = (540, 350)
TAB_CLIENTES = (900, 350)
CLIENTE_DEFINIR_UBICACION = (540, 1190)
CLIENTE_GUARDAR = (540, 1390)

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

def tap(punto: tuple[int, int]):
    run(["adb", "shell", "input", "tap", str(punto[0]), str(punto[1])], check=False)
    time.sleep(1)

def texto(valor: str):
    # input text acepta %s como espacio. Los usuarios QA no contienen espacios.
    escaped = valor.replace("%", "%25").replace(" ", "%s")
    run(["adb", "shell", "input", "text", escaped], check=False)
    time.sleep(0.7)

def shot(nombre: str):
    with (OUT / nombre).open("wb") as fh:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=fh)

def iniciar_limpio():
    run(["adb", "shell", "settings", "put", "global", "hide_error_dialogs", "1"], check=False)
    run(["adb", "shell", "am", "force-stop", PKG], check=False)
    run(["adb", "shell", "pm", "clear", PKG], check=False)
    run(["adb", "shell", "am", "start", "-n", f"{PKG}/.MainActivity"], check=False)
    # El release x86_64 tarda bastante más en CI que en un teléfono físico.
    time.sleep(165)
    shot("MOV-00-arranque-diagnostico.png")

def borrar_campo(punto: tuple[int, int], repeticiones: int = 48):
    tap(punto)
    for _ in range(repeticiones):
        run(["adb", "shell", "input", "keyevent", "67"], check=False, timeout=5)
    time.sleep(0.5)

def escribir_login(identificador: str, password: str):
    tap(LOGIN_IDENTIFICADOR)
    texto(identificador)
    tap(LOGIN_PASSWORD)
    texto(password)
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    time.sleep(1)

def main():
    vendedor = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    password = os.environ["QA_VENDEDOR_PASSWORD"]

    run(["adb", "reverse", "tcp:3001", "tcp:3001"])
    iniciar_limpio()

    # 1. Pantalla real de acceso.
    shot("MOV-01-acceso-vendedor.png")

    # 2. Validación de cliente: campos obligatorios vacíos.
    tap(LOGIN_BOTON)
    time.sleep(1)
    shot("MOV-02-validacion-login.png")

    # 3. Error real HTTP 401 con credenciales incorrectas.
    escribir_login("usuario.invalido@zav.test", "incorrecta")
    tap(LOGIN_BOTON)
    time.sleep(5)
    shot("MOV-03-error-login-401.png")

    # 4. Inicio de sesión real contra la API local aislada.
    borrar_campo(LOGIN_IDENTIFICADOR)
    texto(vendedor)
    borrar_campo(LOGIN_PASSWORD)
    texto(password)
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    tap(LOGIN_BOTON)
    time.sleep(15)
    shot("MOV-04-pedidos.png")

    # 5. Formulario móvil de Pedido.
    tap(TAB_NUEVO)
    time.sleep(2)
    shot("MOV-05-nuevo-pedido.png")

    # 6. Formulario/directorio de Clientes.
    tap(TAB_CLIENTES)
    time.sleep(2)
    shot("MOV-06-clientes.png")

    # 7. Validación visible de Cliente sin ubicación obligatoria.
    tap(CLIENTE_GUARDAR)
    time.sleep(1)
    shot("MOV-07-validacion-cliente.png")

    # 8. Selector geográfico real de la aplicación.
    # La notificación de validación es temporal; se espera a que desaparezca.
    time.sleep(6)
    tap(CLIENTE_DEFINIR_UBICACION)
    time.sleep(8)
    shot("MOV-08-mapa-cliente.png")

    # Volver a la pantalla principal sin depender de UIAutomator.
    run(["adb", "shell", "input", "keyevent", "4"], check=False)
    time.sleep(2)
    tap(TAB_PEDIDOS)
    time.sleep(2)
    shot("MOV-09-pedidos-acciones.png")

    print("Capturas móviles reales generadas:")
    for img in sorted(OUT.glob("MOV-*.png")):
        print(f"- {img.name}: {img.stat().st_size} bytes")

if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            shot("MOV-00-fallo-diagnostico.png")
        except Exception:
            pass
        try:
            resultado = run(["adb", "logcat", "-d", "-t", "2500"], check=False, capture=True, timeout=20)
            if resultado is not None and resultado.stdout:
                (OUT / "logcat-mobile.txt").write_text(
                    resultado.stdout,
                    encoding="utf-8",
                    errors="replace",
                )
        except Exception:
            pass
        raise
