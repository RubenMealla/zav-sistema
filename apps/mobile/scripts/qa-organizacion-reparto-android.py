#!/usr/bin/env python3
"""QA E3: planificar un reparto desde Android con origen sintético de ZAV.

Se ejecuta exclusivamente contra la API/PostgreSQL aislados del workflow.
La coordenada del despacho es un dato de QA, no una localización real de ZAV.
Las capturas proceden de ADB sobre el APK ejecutado en emulador Android.
"""
from __future__ import annotations

import importlib.util
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "qa_mobile_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py")
)
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

API = "http://127.0.0.1:3001"
CASO = "organizacion-reparto-desde-android"
CAPTURAS = [
    "MOV-20-recorrido-organizado.png",
    "MOV-21-mapa-recorrido-android.png",
]
ORIGEN_QA = {"latitud": -21.5355, "longitud": -64.7296}


def comprobar(condicion: bool, mensaje: str) -> None:
    if not condicion:
        raise RuntimeError(mensaje)


def api(ruta: str, *, token: str | None = None, metodo: str = "GET",
        datos: dict | None = None) -> dict:
    cabeceras = {"Content-Type": "application/json"}
    if token:
        cabeceras["Authorization"] = "Bearer " + token
    req = urllib.request.Request(
        API + ruta,
        headers=cabeceras,
        method=metodo,
        data=json.dumps(datos).encode("utf-8") if datos is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as respuesta:
            return json.load(respuesta)
    except urllib.error.HTTPError as exc:
        cuerpo = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{metodo} {ruta}: HTTP {exc.code} {cuerpo[:500]}") from exc


def sesion(rol: str) -> str:
    identificador = os.environ[f"QA_{rol}_IDENTIFICADOR"]
    clave = os.environ[f"QA_{rol}_PASSWORD"]
    return api("/api/v1/auth/login", metodo="POST",
               datos={"identificador": identificador,
                      "contrasena": clave})["accessToken"]


def pulsar_con_desplazamiento(texto: str, intentos: int = 4) -> None:
    for _ in range(intentos):
        if qa.tap_node(texto, exact=True):
            return
        qa.swipe_up()
    raise RuntimeError(f"No se pudo pulsar el control Android: {texto!r}")


def ejecutar() -> dict:
    admin = sesion("ADMIN")
    vendedor = sesion("VENDEDOR")

    # El origen se registra exclusivamente en la base efímera del workflow.
    despacho = api("/api/v1/ubicaciones/venta-despacho", token=admin)
    comprobar(despacho.get("codigo") == "VENTA_DESPACHO" and despacho.get("id"),
              "La ubicación Venta y Despacho de QA no está disponible")
    configurado = api(
        f"/api/v1/ubicaciones/{despacho['id']}/georreferencia",
        token=admin, metodo="PATCH", datos=ORIGEN_QA,
    )
    # TypeORM/PostgreSQL pueden normalizar la precisión decimal.
    # Leer de vuelta y comparar coordenadas numéricas, no objetos JSON.
    guardado = api("/api/v1/ubicaciones/venta-despacho", token=admin)
    punto = guardado.get("ubicacion") or configurado.get("ubicacion") or {}
    try:
        diferencias = {
            eje: abs(float(punto[eje]) - valor)
            for eje, valor in ORIGEN_QA.items()
        }
    except (ValueError, TypeError, KeyError) as exc:
        raise RuntimeError(
            f"La georreferencia de QA no devolvió latitud/longitud: "
            f"PATCH={configurado!r}; GET={guardado!r}"
        ) from exc
    comprobar(
        guardado.get("codigo") == "VENTA_DESPACHO"
        and all(delta < 0.00001 for delta in diferencias.values()),
        f"Origen de QA inconsistente. Solicitado={ORIGEN_QA!r}; "
        f"PATCH={configurado!r}; GET={guardado!r}",
    )

    activos = []
    for estado in ("REGISTRADO", "EN_DISTRIBUCION"):
        respuesta = api(
            f"/api/v1/pedidos?estado={estado}&page=1&limit=100",
            token=vendedor,
        )
        activos.extend(respuesta.get("items", []))
    planificables = [p for p in activos if p.get("destinoGps")]
    comprobar(len(planificables) >= 2,
              "Se necesitan al menos dos pedidos sintéticos georreferenciados")

    qa.restart_clean()
    comprobar(
        qa.login(os.environ["QA_VENDEDOR_IDENTIFICADOR"],
                 os.environ["QA_VENDEDOR_PASSWORD"]),
        "No se abrió la sesión Android del Vendedor",
    )
    qa.tap_tab("Pedidos")
    # Incluye pedidos activos aun si el filtro Hoy no coincide con el reloj CI.
    pulsar_con_desplazamiento("Todos activos")
    pulsar_con_desplazamiento("Seleccionar todos")
    comprobar(qa.wait_text("seleccionado(s)", seconds=12),
              "La aplicación no reconoció los pedidos seleccionados")
    pulsar_con_desplazamiento("Desde ZAV")
    comprobar(qa.wait_text("Recorrido activo", seconds=30),
              "La pantalla no mostró el recorrido activo")
    comprobar(qa.wait_text("Mapa completo", seconds=12),
              "No apareció la vista previa del mapa del recorrido")
    time.sleep(3)
    qa.shot(CAPTURAS[0])

    pulsar_con_desplazamiento("Mapa completo")
    comprobar(qa.wait_text("PEDIDOS · MAPA", seconds=15),
              "No se abrió el mapa completo del reparto")
    comprobar(qa.wait_text("Recorrido ·", seconds=10),
              "El mapa no mostró el número de paradas")
    time.sleep(3)
    qa.shot(CAPTURAS[1])

    # Comprobación independiente de la API para los mismos pedidos de QA.
    esperado = api(
        "/api/v1/pedidos/planificacion", token=vendedor, metodo="POST",
        datos={
            "pedidoIds": [p["id"] for p in planificables[:2]],
            "origenTipo": "DESPACHO",
        },
    )
    comprobar(esperado.get("origen", {}).get("tipo") == "DESPACHO",
              "La API no utilizó el origen de despacho")
    comprobar(len(esperado.get("paradas", [])) == 2,
              "La API no generó las dos paradas de control")
    comprobar(
        esperado.get("algoritmo") == "VECINO_MAS_CERCANO_HAVERSINE",
        "El algoritmo de secuencia no coincide con el contrato",
    )

    return {
        "caso": CASO,
        "resultado": "CORRECTO",
        "capturas": CAPTURAS,
        "api": "PostgreSQL QA aislado (no producción)",
        "origen_de_prueba": ORIGEN_QA,
        "pedidos_activos_elegibles": len(planificables),
        "paradas_api_verificadas": len(esperado["paradas"]),
        "algoritmo_api": esperado["algoritmo"],
        "nota": "La planificación de la API se contrasta de forma independiente; "
                "no se atribuye un GPS físico real al emulador.",
    }


if __name__ == "__main__":
    reporte = {"caso": CASO, "resultado": "FALLIDO"}
    try:
        reporte = ejecutar()
    except Exception as exc:
        reporte["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-organizacion-reparto-diagnostico.png")
        except Exception:
            pass
        try:
            estado = qa.dump_ui("diagnostico-organizacion-reparto")
            reporte["jerarquia_accesible_guardada"] = estado is not None
        except Exception:
            pass
        raise
    finally:
        reporte.update({
            "run_id": os.environ.get("GITHUB_RUN_ID"),
            "commit": os.environ.get("GITHUB_SHA"),
            "apk_origen": os.environ.get("APK_BUILD_SHA"),
        })
        (qa.OUT / "REPORTE-ORGANIZACION-REPARTO.json").write_text(
            json.dumps(reporte, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
