#!/usr/bin/env python3
"""QA Android: incorporar un pedido nuevo al recorrido sin cancelar la secuencia.

Los pedidos, origen y GPS son sintéticos, y el backend/PostgreSQL son temporales.
El primer recorrido se ejecuta desde la UI; el nuevo pedido se simula como
ingreso concurrente desde la API; la incorporación se pulsa en el APK Android.
"""
from __future__ import annotations
import importlib.util
import json
import os
import time
from pathlib import Path

def cargar(nombre: str, ruta: str):
    spec = importlib.util.spec_from_file_location(nombre, Path(ruta))
    assert spec and spec.loader
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo

org = cargar("qa_organizacion", "apps/mobile/scripts/qa-organizacion-reparto-android.py")
gps = cargar("qa_gps", "apps/mobile/scripts/qa-entrega-gps-android.py")
qa = org.qa
CASO = "incorporacion-nuevo-pedido-recorrido-android"

def asegurar(ok: bool, msg: str):
    if not ok: raise RuntimeError(msg)

def bajar_hasta_inicio():
    for _ in range(3):
        qa.run(["adb", "shell", "input", "swipe", "540", "400", "540", "1510", "430"], check=False)
        time.sleep(0.4)

def desplazar_en_lista() -> None:
    # La vista previa MapLibre ocupa el centro y absorbe algunos gestos
    # inyectados por ADB. Desplazar por el borde derecho del ScrollView,
    # fuera de la superficie del mapa.
    qa.run(["adb", "shell", "input", "swipe",
            "1033", "1710", "1033", "680", "490"], check=False)
    time.sleep(0.9)


def esperar_nuevos_en_recorrido(intentos: int = 9) -> bool:
    for indice in range(intentos):
        if qa.text_exists("pedido(s) fuera del recorrido"):
            qa.dump_ui("nuevos-pedidos-detectados")
            return True
        qa.dump_ui(f"nuevos-pedidos-viewport-{indice}")
        desplazar_en_lista()
    return qa.text_exists("pedido(s) fuera del recorrido")


def ejecutar():
    vendedor = org.sesion("VENDEDOR")
    activos = []
    for estado in ("REGISTRADO", "EN_DISTRIBUCION"):
        activos += org.api(f"/api/v1/pedidos?estado={estado}&page=1&limit=100", token=vendedor)["items"]
    asegurar(len(activos) >= 2, "Faltan dos pedidos activos de QA para crear recorrido")
    iniciales = {p["id"] for p in activos}
    # Reutilizar exactamente el flujo de planificación y mapa ya probado.
    org.ejecutar()
    asegurar(qa.tap_node("Cerrar", exact=True), "No se pudo cerrar el mapa de reparto")
    asegurar(qa.wait_text("Recorrido activo", seconds=12), "Se perdió el recorrido inicial")
    ref = org.api("/api/v1/pedidos/"+activos[0]["id"], token=vendedor)
    nuevo = org.api("/api/v1/pedidos", token=vendedor, metodo="POST", datos={
        "clienteId": ref["cliente"]["id"],
        "observacion": "NUEVO_PEDIDO_DURANTE_RECORRIDO_QA",
        "detalles": [{"productoId": ref["detalles"][0]["productoId"], "cantidad": 1}],
    })
    asegurar(nuevo["id"] not in iniciales, "La API no registró un pedido nuevo de QA")
    # El pull-to-refresh conserva el recorrido ya iniciado y carga nuevos pedidos.
    bajar_hasta_inicio()
    qa.run(["adb", "shell", "input", "swipe", "540", "530", "540", "1460", "620"], check=False)
    asegurar(esperar_nuevos_en_recorrido(),
            "No se encontró el control para nuevos pedidos tras actualizar y desplazar; "
            "verificar capturas y jerarquías de cada viewport")
    qa.shot("MOV-35A-pedido-nuevo-detectado-fuera-de-ruta.png")

    for permiso in ("ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
        qa.run(["adb", "shell", "pm", "grant", gps.PKG, "android.permission."+permiso], check=True)
    gps.configurar_proveedor_simulado()
    pulsado = False
    for _ in range(8):
        if qa.tap_node("Añadir", exact=True):
            pulsado=True
            break
        desplazar_en_lista()
    asegurar(pulsado, "La interfaz no mostró Añadir al recorrido")
    cantidad = len(iniciales) + 1
    bajar_hasta_inicio()
    asegurar(qa.wait_text(f"Recorrido activo · {cantidad} parada(s)", seconds=55),
            "La UI no recalculó un recorrido incluyendo el pedido recién registrado")
    qa.shot("MOV-35-nuevo-pedido-incorporado-al-recorrido.png")
    # Contraste independiente de planificación sobre los mismos IDs.
    respuesta = org.api("/api/v1/pedidos/planificacion", token=vendedor,
        metodo="POST", datos={"pedidoIds": list(iniciales) + [nuevo["id"]],
                              "origenTipo": "ACTUAL",
                              "origenLatitud": gps.LATITUD_QA,
                              "origenLongitud": gps.LONGITUD_QA})
    asegurar(len(respuesta.get("paradas", [])) == cantidad,
            "La API no calculó el mismo número de paradas")
    return {"caso":CASO,"resultado":"CORRECTO", "pedidos_antes":len(iniciales),
            "pedidos_despues":cantidad,"pedido_incorporado":nuevo["id"],
            "algoritmo":respuesta.get("algoritmo"),"capturas":["MOV-35-nuevo-pedido-incorporado-al-recorrido.png"],
            "nota":"Pedido simulado mientras la ruta estaba activa; GPS y base de datos de QA"}

if __name__ == "__main__":
    reporte = {"caso": CASO, "resultado": "FALLIDO"}
    try: reporte = ejecutar()
    except Exception as e:
        reporte["error"] = f"{type(e).__name__}: {e}"
        try:
            qa.shot("MOV-97-anadir-pedido-ruta-diagnostico.png")
            qa.dump_ui("anadir-pedido-ruta-fallo")
        except Exception: pass
        raise
    finally:
        reporte.update({"run_id":os.environ.get("GITHUB_RUN_ID"),
                        "commit":os.environ.get("GITHUB_SHA")})
        (qa.OUT/"REPORTE-ANADIR-PEDIDO-RUTA.json").write_text(
            json.dumps(reporte,ensure_ascii=False,indent=2)+"\n", encoding="utf-8")
