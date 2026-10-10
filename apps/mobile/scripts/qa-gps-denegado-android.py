#!/usr/bin/env python3
"""QA Android: denegar ubicación puntual y comprobar que no se registra entrega.

Se ejecuta en emulador Google APIs, solo contra la API y BD aisladas de QA.
"""
from __future__ import annotations
import importlib.util
import json
import os
import time
import urllib.request
from pathlib import Path

spec = importlib.util.spec_from_file_location("qa_base", Path("apps/mobile/scripts/capturar-evidencias-movil.py"))
assert spec and spec.loader
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
CASO = "rechazo-entrega-por-permiso-gps-denegado-android"
PKG = "bo.zav.gestion.vendedor"

def req(ruta: str, token: str | None = None, body: dict | None = None) -> dict:
    hdr = {"Content-Type": "application/json"}
    if token:
        hdr["Authorization"] = "Bearer " + token
    x = urllib.request.Request("http://127.0.0.1:3001"+ruta, headers=hdr,
        data=json.dumps(body).encode() if body is not None else None,
        method="POST" if body is not None else "GET")
    with urllib.request.urlopen(x, timeout=25) as res: return json.load(res)

def require(cond: bool, msg: str):
    if not cond: raise RuntimeError(msg)

def ejecutar():
    user, key = os.environ["QA_VENDEDOR_IDENTIFICADOR"], os.environ["QA_VENDEDOR_PASSWORD"]
    token = req("/api/v1/auth/login", body={"identificador":user,"contrasena":key})["accessToken"]
    dist_antes = req("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100",token)["total"]
    entre_antes = req("/api/v1/pedidos?estado=ENTREGADO&page=1&limit=100",token)["total"]
    require(dist_antes >= 1, "Falta pedido de prueba para negar GPS")
    qa.restart_clean()
    require(qa.login(user,key), "Falló acceso Android")
    # El permiso se retira solo del APK instalado en el emulador de CI.
    for permiso in ("ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"):
        qa.run(["adb","shell","pm","revoke",PKG,"android.permission."+permiso],check=False)
    qa.tap_tab("Pedidos")
    qa.tap_node("Todos activos",exact=True)
    for _ in range(8):
        if qa.tap_node("Confirmar entrega",exact=True): break
        qa.swipe_up()
    else: raise RuntimeError("No aparece Confirmar entrega para un pedido en distribución")
    time.sleep(2)
    arbol = qa.dump_ui("entrega-permiso-android")
    require(arbol is not None, "No se obtuvo solicitud de permiso")
    negativas=[]
    for nodo in arbol.iter("node"):
        name=(nodo.attrib.get("text","")+" "+nodo.attrib.get("content-desc","")).strip().lower()
        res=nodo.attrib.get("resource-id","")
        if nodo.attrib.get("bounds") and (
            "don't allow" in name or "no permitir" in name or
            res.endswith(":id/permission_deny_button")):
            negativas.append(nodo)
    require(negativas, "Android no mostró la opción nativa de denegar ubicación")
    qa.shot("MOV-36-permiso-ubicacion-android.png")
    x,y=qa.center(negativas[0].attrib["bounds"])
    qa.run(["adb","shell","input","tap",str(x),str(y)],check=True)
    require(qa.wait_text("La entrega no se registró porque no se autorizó",seconds=20),
            "No se mostró la validación por falta de permiso GPS")
    qa.shot("MOV-37-entrega-rechazada-permiso-denegado.png")
    dist_despues=req("/api/v1/pedidos?estado=EN_DISTRIBUCION&page=1&limit=100",token)["total"]
    entre_despues=req("/api/v1/pedidos?estado=ENTREGADO&page=1&limit=100",token)["total"]
    require(dist_despues==dist_antes and entre_despues==entre_antes,
            "El estado de pedidos cambió pese a denegar GPS")
    return {"caso":CASO,"resultado":"CORRECTO","entregados_antes":entre_antes,
            "entregados_despues":entre_despues,"distribucion_antes":dist_antes,
            "distribucion_despues":dist_despues,
            "capturas":["MOV-36-permiso-ubicacion-android.png",
                        "MOV-37-entrega-rechazada-permiso-denegado.png"],
            "nota":"Permiso denegado en emulador; sin entrega física"}

if __name__=="__main__":
    report={"caso":CASO,"resultado":"FALLIDO"}
    try: report=ejecutar()
    except Exception as e:
        report["error"]=f"{type(e).__name__}: {e}"
        try:
            qa.shot("MOV-97-permiso-gps-diagnostico.png")
            qa.dump_ui("permiso-gps-fallo")
        except Exception: pass
        raise
    finally:
        report.update({"run_id":os.environ.get("GITHUB_RUN_ID"),
                       "commit":os.environ.get("GITHUB_SHA")})
        (qa.OUT/"REPORTE-GPS-DENEGADO-ANDROID.json").write_text(
            json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
