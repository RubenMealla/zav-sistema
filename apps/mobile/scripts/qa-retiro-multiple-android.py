#!/usr/bin/env python3
"""QA Android: retiro múltiple efectivo desde la UI y persistencia en API de QA.

Se crean pedidos de control por API local antes del caso; el retiro se ejecuta
únicamente mediante la pantalla y la confirmación nativa del APK.
"""
from __future__ import annotations

import importlib.util
import json
import os
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location("qa_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py"))
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

CASO = "retiro-multiple-pedidos-desde-android"

def verificar(cond: bool, msg: str):
    if not cond:
        raise RuntimeError(msg)

def api(path: str, token: str | None = None, body: dict | None = None) -> dict:
    hdr = {"Content-Type": "application/json"}
    if token: hdr["Authorization"] = "Bearer " + token
    req = urllib.request.Request("http://127.0.0.1:3001" + path, headers=hdr,
        data=json.dumps(body).encode() if body is not None else None,
        method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=25) as resp: return json.load(resp)

def ejecutar():
    user = os.environ["QA_VENDEDOR_IDENTIFICADOR"]
    pwd = os.environ["QA_VENDEDOR_PASSWORD"]
    token = api("/api/v1/auth/login", body={"identificador": user, "contrasena": pwd})["accessToken"]
    src = api("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100", token)["items"]
    verificar(src, "No se encontró pedido de referencia para QA")
    detail = api("/api/v1/pedidos/" + src[0]["id"], token)
    creados = []
    for i in range(2):
        p = api("/api/v1/pedidos", token, {
            "clienteId": detail["cliente"]["id"],
            "observacion": f"QA_RETIRO_MULTIPLE_ANDROID_{i+1}",
            "detalles": [{"productoId": detail["detalles"][0]["productoId"], "cantidad": 1}],
        })
        creados.append(p["id"])
    registrados = api("/api/v1/pedidos?estado=REGISTRADO&page=1&limit=100", token)
    ids_antes = {p["id"] for p in registrados["items"]}
    verificar(all(p in ids_antes for p in creados), "Los dos pedidos QA no figuran registrados")
    n = len(ids_antes)
    verificar(n >= 2, "Menos de dos pedidos para retiro múltiple")
    dist_antes = api("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100", token)["total"]
    qa.restart_clean()
    verificar(qa.login(user, pwd), "No inició sesión Android")
    qa.tap_tab("Pedidos")
    verificar(qa.tap_node("Todos activos", exact=True), "No se pudo cambiar filtro")
    verificar(qa.tap_node("Seleccionar todos", exact=True), "No se seleccionaron activos")
    verificar(qa.wait_text("seleccionado(s)", seconds=10), "Sin seleccionados visibles")
    boton = f"Retirar seleccionados ({n})"
    for _ in range(8):
        if qa.tap_node(boton, exact=True):
            break
        qa.swipe_up()
    else:
        raise RuntimeError(f"No apareció botón de retiro múltiple: {boton!r}")
    verificar(qa.wait_text("Retirar seleccionados para reparto", seconds=12),
              "No se abrió confirmación de retiro múltiple")
    qa.shot("MOV-33-confirmacion-retiro-multiple.png")
    arbol = qa.dump_ui("dialogo-retiro-multiple")
    verificar(arbol is not None, "Sin diálogo de retiro múltiple")
    positivos = [x for x in arbol.iter("node") if x.attrib.get("resource-id") == "android:id/button1"
                 and x.attrib.get("clickable") == "true" and x.attrib.get("bounds")]
    verificar(len(positivos) == 1, "Botón de confirmación Android no inequívoco")
    x,y = qa.center(positivos[0].attrib["bounds"])
    qa.run(["adb", "shell", "input", "tap", str(x), str(y)], check=True)
    verificar(qa.wait_text("pedido(s) pasaron a reparto.", seconds=25),
              "No apareció notificación de resultado del retiro")
    registrados_despues = api("/api/v1/pedidos?estado=REGISTRADO&page=1&limit=100", token)["total"]
    dist_despues = api("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100", token)["total"]
    verificar(registrados_despues == 0 and dist_despues == dist_antes + n,
              f"Conteos inesperados: REGISTRADO={registrados_despues}; EN_DISTRIBUCION={dist_despues}")
    for id_ in creados:
        verificar(api("/api/v1/pedidos/"+id_, token)["estado"] == "EN_DISTRIBUCION",
                  "Pedido de control no retirado: " + id_)
    qa.shot("MOV-34-pedidos-retiro-multiple-confirmado.png")
    return {"caso": CASO, "resultado": "CORRECTO", "pedidos_qa_creados": creados,
            "registrados_retirados": n, "en_distribucion_antes": dist_antes,
            "en_distribucion_despues": dist_despues,
            "capturas": ["MOV-33-confirmacion-retiro-multiple.png",
                         "MOV-34-pedidos-retiro-multiple-confirmado.png"],
            "nota": "Datos sintéticos; UI Android verificada contra PostgreSQL aislado"}

if __name__ == "__main__":
    resultado = {"caso": CASO, "resultado": "FALLIDO"}
    try: resultado = ejecutar()
    except Exception as exc:
        resultado["error"] = f"{type(exc).__name__}: {exc}"
        try:
            qa.shot("MOV-97-retiro-multiple-diagnostico.png")
            qa.dump_ui("retiro-multiple-error")
        except Exception: pass
        raise
    finally:
        resultado.update({"run_id": os.environ.get("GITHUB_RUN_ID"),
                          "commit": os.environ.get("GITHUB_SHA")})
        (qa.OUT/"REPORTE-RETIRO-MULTIPLE-ANDROID.json").write_text(
            json.dumps(resultado, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
