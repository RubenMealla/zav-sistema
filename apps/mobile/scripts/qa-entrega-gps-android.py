#!/usr/bin/env python3
"""QA Android: confirmar entrega con GPS simulado y comprobar persistencia.

El emulador recibe una ubicación simulada sobre Tarija. Ni el recorrido
ni la entrega representan operaciones físicas realizadas por ZAV.
La API y PostgreSQL son servicios temporales aislados de GitHub Actions.
"""
from __future__ import annotations

import importlib.util
import json
import os
import time
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "qa_mobile_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py")
)
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

API = "http://127.0.0.1:3001"
CASO = "confirmacion-entrega-gps-emulador-android"
LATITUD_QA = -21.5355
LONGITUD_QA = -64.7296
PKG = "bo.zav.gestion.vendedor"


def verificar(condicion: bool, descripcion: str):
    if not condicion:
        raise RuntimeError(descripcion)


def peticion(ruta: str, token: str | None = None, datos: dict | None = None) -> dict:
    cabeceras = {"Content-Type": "application/json"}
    if token:
        cabeceras["Authorization"] = "Bearer " + token
    r = urllib.request.Request(
        API + ruta, headers=cabeceras,
        method="POST" if datos is not None else "GET",
        data=json.dumps(datos).encode() if datos is not None else None,
    )
    with urllib.request.urlopen(r, timeout=25) as respuesta:
        return json.load(respuesta)


def listado(token: str, estado: str):
    return peticion(
        f"/api/v1/pedidos?estado={estado}&page=1&limit=100", token
    )["items"]


def ejecutar():
    usuario = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    clave = os.environ["QA_VENDEDOR_PASSWORD"]
    token = peticion("/api/v1/auth/login",
                     datos={"identificador": usuario, "contrasena": clave})["accessToken"]
    entregados_antes = listado(token, "ENTREGADO")
    distribucion_antes = listado(token, "EN_DISTRIBUCION")
    verificar(distribucion_antes, "No hay pedido en distribución para entregar")

    # Habilitar geolocalización sin depender de un GPS físico.
    qa.run(["adb", "shell", "cmd", "location", "set-location-enabled", "true"],
           check=False)
    for permiso in ("ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
        qa.run(["adb", "shell", "pm", "grant", PKG,
                f"android.permission.{permiso}"], check=True)
    qa.run(["adb", "emu", "geo", "fix", str(LONGITUD_QA), str(LATITUD_QA)],
           check=True)
    time.sleep(5)
    qa.restart_clean()
    verificar(qa.login(usuario, clave), "El Vendedor no inició sesión en Android")
    qa.tap_tab("Pedidos")
    # Si no corresponde al día de QA, presentar todos los pedidos activos.
    qa.tap_node("Todos activos", exact=True)
    for _ in range(8):
        if qa.tap_node("Confirmar entrega", exact=True):
            break
        qa.swipe_up()
    else:
        raise RuntimeError("No apareció una acción Confirmar entrega")
    verificar(
        qa.wait_text("Comprobar entrega", seconds=40),
        "Android no obtuvo GPS o no abrió la confirmación de entrega",
    )
    verificar(
        qa.wait_text("La ubicación se capturó solo para esta confirmación", seconds=8),
        "No se observó el aviso de ubicación puntual en el diálogo",
    )
    qa.shot("MOV-22-confirmacion-gps-emulador.png")
    arbol = qa.dump_ui("dialogo-entrega-gps")
    verificar(arbol is not None, "No se obtuvo el diálogo Android")
    candidatos = [
        n for n in arbol.iter("node")
        if n.attrib.get("resource-id") == "android:id/button1"
        and n.attrib.get("clickable") == "true"
        and n.attrib.get("bounds")
    ]
    verificar(len(candidatos) == 1, "No hay un botón positivo Android inequívoco")
    x, y = qa.center(candidatos[0].attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)], check=True)

    verificar(
        qa.wait_text("Entrega registrada", seconds=35),
        "No apareció confirmación de entrega registrada",
    )
    qa.shot("MOV-23-entrega-gps-registrada.png")

    entregados_despues = listado(token, "ENTREGADO")
    distribucion_despues = listado(token, "EN_DISTRIBUCION")
    verificar(len(entregados_despues) == len(entregados_antes) + 1,
              "El conteo ENTREGADO no aumentó exactamente en uno")
    verificar(len(distribucion_despues) == len(distribucion_antes) - 1,
              "El conteo EN_DISTRIBUCION no disminuyó exactamente en uno")

    anteriores = {p["id"] for p in entregados_antes}
    nuevos = [p for p in entregados_despues if p["id"] not in anteriores]
    verificar(len(nuevos) == 1, "No se identificó un único pedido entregado")
    detalle = peticion("/api/v1/pedidos/" + nuevos[0]["id"], token)
    gps = detalle.get("entregaGps") or {}
    verificar(detalle.get("estado") == "ENTREGADO" and detalle.get("entregadoEn"),
              "La entrega no guardó su estado y su fecha")
    verificar(
        "latitud" in gps and "longitud" in gps
        and abs(float(gps["latitud"]) - LATITUD_QA) < 0.002
        and abs(float(gps["longitud"]) - LONGITUD_QA) < 0.002,
        f"GPS persistido no coincide con la simulación de Tarija: {gps!r}",
    )
    return {
        "caso": CASO, "resultado": "CORRECTO",
        "capturas": ["MOV-22-confirmacion-gps-emulador.png",
                     "MOV-23-entrega-gps-registrada.png"],
        "gps_emulador": {"latitud": LATITUD_QA, "longitud": LONGITUD_QA},
        "gps_registrado": gps,
        "estado": detalle["estado"],
        "entregado_en": detalle["entregadoEn"],
        "entregados_antes": len(entregados_antes),
        "entregados_despues": len(entregados_despues),
        "nota": "Ubicación ficticia del emulador, no entrega física real.",
    }


if __name__ == "__main__":
    reporte = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        reporte = ejecutar()
    except Exception as exc:
        reporte["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-entrega-gps-diagnostico.png")
            qa.dump_ui("entrega-gps-error")
        except Exception:
            pass
        raise
    finally:
        reporte.update({
            "run_id": os.environ.get("GITHUB_RUN_ID"),
            "commit": os.environ.get("GITHUB_SHA"),
            "apk_origen": os.environ.get("APK_BUILD_SHA"),
        })
        (qa.OUT / "REPORTE-ENTREGA-GPS-ANDROID.json").write_text(
            json.dumps(reporte, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
