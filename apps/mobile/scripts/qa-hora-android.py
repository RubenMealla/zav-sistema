"""Comprueba el APK QA real, con servidor sintético y zonas del emulador distintas."""
import glob
import json
import re
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from zoneinfo import ZoneInfo

PACKAGE = 'bo.zav.gestion.vendedor.qa'
SALIDA = Path('evidencias-hora-android')
SALIDA.mkdir(exist_ok=True)


def adb(*args):
    return subprocess.check_output(['adb', *args], timeout=45).decode('utf-8', errors='replace').strip()


def layout():
    adb('shell', 'uiautomator', 'dump', '/sdcard/zav-hora.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/zav-hora.xml'))


def esperar(texto, atributo='text', exacto=False):
    limite = time.monotonic() + 50
    while time.monotonic() < limite:
        raiz = layout()
        for nodo in raiz.iter('node'):
            valor = nodo.get(atributo, '')
            coincide = valor == texto if exacto else texto in valor
            if coincide:
                return nodo
        time.sleep(1)
    raise AssertionError(f'No aparece: {texto}')


def tocar(nodo):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', nodo.get('bounds', '')))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))


class Salud(BaseHTTPRequestHandler):
    def do_GET(self):
        contenido = b'{"estado":"ok"}'
        self.send_response(200 if self.path == '/api/v1/salud' else 404)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(contenido)))
        self.end_headers()
        self.wfile.write(contenido)

    def log_message(self, *_args):
        pass


servidor = HTTPServer(('0.0.0.0', 3001), Salud)
threading.Thread(target=servidor.serve_forever, daemon=True).start()
try:
    apk = glob.glob('apk-qa/**/*-qa.apk', recursive=True)
    assert len(apk) == 1, f'Se esperaba un APK QA: {apk}'
    adb('install', '-r', apk[0])
    adb('root')
    adb('wait-for-device')
    adb('shell', 'settings', 'put', 'global', 'auto_time_zone', '0')
    resultados = []
    for zona in ['UTC', 'Asia/Tokyo']:
        adb('shell', 'am', 'force-stop', PACKAGE)
        adb('shell', 'cmd', 'alarm', 'set-timezone', zona)
        assert adb('shell', 'getprop', 'persist.sys.timezone') == zona
        adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1')
        tocar(esperar('Configurar API de mi computadora'))
        tocar(esperar('Dirección de la API de pruebas', 'content-desc'))
        adb('shell', 'input', 'keycombination', '113', '29')  # Ctrl+A
        adb('shell', 'input', 'text', 'http://10.0.2.2:3001')
        adb('shell', 'input', 'keyevent', '4')  # Ocultar teclado.
        tocar(esperar('Probar y guardar servidor'))
        esperar('Servidor de pruebas conectado.')
        tocar(esperar('Abrir consola QA', 'content-desc'))
        inicio = time.time()
        tocar(esperar('Comprobar API', exacto=True))
        esperar('API ZAV disponible')
        nodo = esperar('Bolivia (UTC-04:00)')
        fin = time.time()
        hora = re.search(r'\b(\d{2}:\d{2}:\d{2}) Bolivia', nodo.get('text', ''))
        assert hora, nodo.attrib
        posibles = {datetime.fromtimestamp(t, ZoneInfo('America/La_Paz')).strftime('%H:%M:%S')
                    for t in range(int(inicio) - 1, int(fin) + 2)}
        assert hora[1] in posibles, f'Zona {zona}: {hora[1]} fuera de {posibles}'
        nombre = zona.replace('/', '-')
        ET.ElementTree(layout()).write(SALIDA / f'{nombre}.xml', encoding='utf-8')
        with open(SALIDA / f'{nombre}.png', 'wb') as captura:
            subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=captura, check=True, timeout=30)
        resultados.append({'zonaAndroid': zona, 'horaQaBolivia': hora[1], 'desdeUtc': inicio, 'hastaUtc': fin})
    (SALIDA / 'resultado.json').write_text(json.dumps(resultados, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(resultados))
finally:
    servidor.shutdown()
    # Conserva información útil también si falla el arranque o la interacción.
    try:
        (SALIDA / 'logcat.log').write_text(adb('logcat', '-d', '-t', '500'), encoding='utf-8')
        ET.ElementTree(layout()).write(SALIDA / 'estado-final.xml', encoding='utf-8')
        with open(SALIDA / 'estado-final.png', 'wb') as captura:
            subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=captura, check=True, timeout=30)
    except (subprocess.SubprocessError, ET.ParseError) as error:
        print(f'No se pudo completar la evidencia final: {error}')
