#!/usr/bin/env python3
"""QA Android: registrar Cliente nuevo con mapa y GPS ficticio.

Unicamente emulador Google APIs y API/PostgreSQL de pruebas. Las coordenadas
simuladas no son datos reales de ZAV ni prueban una visita fisica.
"""
from __future__ import annotations

import importlib.util
import json
import os
import time
import threading
import urllib.request
from pathlib import Path

def importar(nombre: str, ruta: str):
    spec = importlib.util.spec_from_file_location(nombre, Path(ruta))
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

qa = importar("qa_base", "apps/mobile/scripts/capturar-evidencias-movil.py")
gps = importar("qa_gps_base", "apps/mobile/scripts/qa-entrega-gps-android.py")
CASO = "alta-cliente-con-mapa-desde-android"
NOMBRE = "CLIENTE_ALTA_GPS_QA_MOVIL"

def verificar(condicion: bool, texto: str):
    if not condicion:
        raise RuntimeError(texto)

def peticion(ruta: str, token: str | None = None, body: dict | None = None) -> dict:
    hdr = {"Content-Type": "application/json"}
    if token:
        hdr["Authorization"] = "Bearer " + token
    req = urllib.request.Request("http://127.0.0.1:3001" + ruta,
        headers=hdr, data=json.dumps(body).encode() if body is not None else None,
        method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.load(resp)

def pulsar(texto: str, intentos: int = 5) -> None:
    for _ in range(intentos):
        if qa.tap_node(texto, exact=True):
            return
        qa.swipe_up()
    raise RuntimeError("No se encontró botón Android: " + texto)

def ejecutar() -> dict:
    usuario, clave = os.environ["QA_VENDEDOR_IDENTIFICADOR"], os.environ["QA_VENDEDOR_PASSWORD"]
    token = peticion("/api/v1/auth/login", body={"identificador": usuario, "contrasena": clave})["accessToken"]
    antes = peticion("/api/v1/clientes?page=1&limit=100", token)
    verificar(not any(c.get("nombre") == NOMBRE for c in antes.get("items", [])),
              "El nombre QA ya existe antes de la prueba")

    qa.restart_clean()
    verificar(qa.login(usuario, clave), "No inició sesión en Android")
    qa.tap_tab("Clientes")
    verificar(qa.wait_text("Nuevo cliente", seconds=15), "No abrió formulario de clientes")
    arbol = qa.dump_ui("alta-cliente-inicial")
    verificar(arbol is not None, "No existe árbol accesible de Clientes")
    cajas = [n for n in arbol.iter("node") if n.attrib.get("class", "").endswith("EditText") and n.attrib.get("bounds")]
    verificar(len(cajas) >= 1, "No aparece TextInput Nombre")
    x, y = qa.center(cajas[0].attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)])
    qa.input_text(NOMBRE)
    qa.hide_keyboard()
    verificar(qa.wait_tab_selected("Clientes", seconds=8), "Android perdió pestaña Clientes")

    gps.configurar_proveedor_simulado()
    pulsar("Definir ubicación")
    verificar(qa.wait_text("Confirmar punto en mapa", seconds=20), "No abrió selector de mapa")
    qa.shot("MOV-27-alta-cliente-mapa-abierto.png")
    pulsar("Mi ubicación")
    # En el primer uso el emulador presenta un dialogo NATIVO de Android.
    # Sin concederlo el script no debe esperar a que exista un punto GPS.
    if qa.wait_text("While using the app", seconds=8):
        qa.shot("MOV-27A-solicitud-permiso-ubicacion-cliente.png")
        verificar(qa.tap_node("While using the app", exact=True),
                  "No se pudo conceder el permiso nativo foreground")
    elif qa.wait_text("Mientras se usa la aplicación", seconds=2):
        qa.shot("MOV-27A-solicitud-permiso-ubicacion-cliente.png")
        verificar(qa.tap_node("Mientras se usa la aplicación", exact=True),
                  "No se pudo conceder el permiso nativo foreground")
    # En el primer uso Android puede conceder el permiso pero el proveedor
    # fused todavía no tener un fix reciente. No suponer un GPS real fallido:
    # reinyectar la coordenada ficticia, repetir la acción desde la interfaz
    # y conservar la captura del primer intento para diagnóstico.
    if not qa.wait_text("Punto seleccionado", seconds=14):
        qa.shot("MOV-97-alta-cliente-primer-intento-gps.png")
        gps.refrescar_gps_simulado()
        qa.run(["adb", "emu", "geo", "fix",
                str(gps.LONGITUD_QA), str(gps.LATITUD_QA)], check=False)
        detener = threading.Event()

        def renovar_ubicacion():
            while not detener.wait(1.5):
                gps.refrescar_gps_simulado()
                qa.run(["adb", "emu", "geo", "fix",
                        str(gps.LONGITUD_QA), str(gps.LATITUD_QA)], check=False)

        alimentador = threading.Thread(target=renovar_ubicacion, daemon=True)
        alimentador.start()
        try:
            pulsar("Mi ubicación", intentos=1)
            verificar(qa.wait_text("Punto seleccionado", seconds=45),
                      "No se obtuvo punto simulado incluso tras renovar GPS; revisar diagnóstico")
        finally:
            detener.set()
            alimentador.join(timeout=6)
    # Dirección visible controlada, para no confundir coordenadas con geocodificación real.
    arbol_mapa = qa.dump_ui("alta-cliente-punto-elegido")
    verificar(arbol_mapa is not None, "Falta jerarquía del mapa")
    cajas_mapa = [n for n in arbol_mapa.iter("node") if n.attrib.get("class", "").endswith("EditText") and n.attrib.get("bounds")]
    if cajas_mapa and not cajas_mapa[0].attrib.get("text", "").strip():
        x, y = qa.center(cajas_mapa[0].attrib["bounds"])
        qa.run(["adb", "shell", "input", "tap", str(x), str(y)])
        qa.input_text("Zona Centro Tarija")
        qa.hide_keyboard()
    qa.shot("MOV-28-cliente-punto-gps-seleccionado.png")
    pulsar("Confirmar ubicación", intentos=1)
    verificar(qa.wait_text("Ubicación confirmada", seconds=25),
              "El mapa no confirmó una dirección para el punto de QA")
    # La captura #126 demostró un toque sobre la IME: añadió una "v" al
    # nombre porque el botón Guardar estaba detrás del teclado visible.
    # KEYCODE_BACK cierra la IME antes de localizar coordenadas del botón.
    qa.run(["adb", "shell", "input", "keyevent", "KEYCODE_BACK"], check=True)
    time.sleep(1.6)
    verificar(qa.wait_tab_selected("Clientes", seconds=8),
              "Se perdió Clientes al ocultar el teclado")
    arbol_previo = qa.dump_ui("alta-cliente-antes-de-guardar")
    verificar(arbol_previo is not None, "Sin jerarquía de cliente antes de guardar")
    verificar(any(n.attrib.get("class", "").endswith("EditText")
                  and n.attrib.get("text", "") == NOMBRE
                  for n in arbol_previo.iter("node")),
              "Nombre QA alterado al volver del mapa o al ocultar teclado")
    qa.shot("MOV-29-cliente-ubicacion-confirmada.png")
    pulsar("Guardar cliente")
    verificar(qa.wait_text("Cliente registrado", seconds=25),
              "No se observó confirmación de alta de cliente")
    resultado = peticion("/api/v1/clientes?page=1&limit=100", token)
    nuevos = [c for c in resultado.get("items", []) if c.get("nombre") == NOMBRE]
    verificar(len(nuevos) == 1, "No se persistió exactamente un cliente QA nuevo")
    geo = nuevos[0].get("ubicacion") or {}
    verificar("latitud" in geo and "longitud" in geo,
              "Cliente creado sin coordenadas persistidas")
    qa.shot("MOV-30-cliente-registrado-con-gps.png")
    return {"caso": CASO, "resultado": "CORRECTO", "cliente_id": nuevos[0]["id"],
            "ubicacion": geo, "nombre": NOMBRE,
            "capturas": ["MOV-27-alta-cliente-mapa-abierto.png",
                          "MOV-28-cliente-punto-gps-seleccionado.png",
                          "MOV-29-cliente-ubicacion-confirmada.png",
                          "MOV-30-cliente-registrado-con-gps.png"],
            "nota": "Ubicación simulada de Tarija; API y datos de QA, no operación física"}

if __name__ == "__main__":
    informe = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        informe = ejecutar()
    except Exception as exc:
        informe["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-alta-cliente-diagnostico.png")
            qa.dump_ui("alta-cliente-error")
        except Exception:
            pass
        raise
    finally:
        informe.update({"run_id": os.environ.get("GITHUB_RUN_ID"),
                        "commit": os.environ.get("GITHUB_SHA"),
                        "apk_origen": os.environ.get("APK_BUILD_SHA")})
        (qa.OUT / "REPORTE-ALTA-CLIENTE-ANDROID.json").write_text(
            json.dumps(informe, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8")
