"""Ejecuta el APK QA contra NestJS/PostgreSQL locales; nunca usa producción."""
import glob
import hashlib
import http.client
import json
import os
import re
import subprocess
import threading
import time
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PACKAGE = 'bo.zav.gestion.vendedor.qa'
API = 'http://127.0.0.1:3001/api/v1/'
SALIDA = Path('evidencias-ventas-android')
SALIDA.mkdir(exist_ok=True)
SERIAL = os.environ.get('ANDROID_SERIAL', '')
if not SERIAL:
    dispositivos = subprocess.check_output(['adb', 'devices'], text=True)
    encontrados = re.findall(r'^(emulator-\d+)\s+device$', dispositivos, re.M)
    assert len(encontrados) == 1, 'Se requiere un único emulador QA.'
    SERIAL = encontrados[0]
assert SERIAL.startswith('emulator-'), 'No se permite ejecutar en teléfonos personales.'


class RespuestaIncierta(BaseHTTPRequestHandler):
    """Proxy local de QA: pierde una respuesta exitosa, conserva el backend real."""
    intentos_venta = []

    def reenviar(self):
        cuerpo = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        conexion = http.client.HTTPConnection('127.0.0.1', 3001, timeout=30)
        headers = {'Content-Type': 'application/json'}
        if self.headers.get('Authorization'):
            headers['Authorization'] = self.headers['Authorization']
        try:
            conexion.request(self.command, self.path, body=cuerpo or None, headers=headers)
            respuesta = conexion.getresponse()
            contenido, estado = respuesta.read(), respuesta.status
            if self.command == 'POST' and self.path == '/api/v1/operaciones/salidas-directas':
                self.intentos_venta.append(json.loads(cuerpo))
                if len(self.intentos_venta) == 1 and estado == 201:
                    # El servidor confirmó; la app recibe un fallo de intermediario.
                    estado = 503
                    contenido = b'{"message":"QA: respuesta de confirmacion no disponible"}'
            self.send_response(estado)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(contenido)))
            self.end_headers()
            self.wfile.write(contenido)
        finally:
            conexion.close()

    do_GET = reenviar
    do_POST = reenviar

    def log_message(self, *_args):
        pass  # No registrar JWT, credenciales ni cuerpos.


def adb(*args):
    return subprocess.check_output(['adb', '-s', SERIAL, *args], timeout=45).decode('utf8', errors='replace').strip()


def api(ruta, datos=None, token=None, metodo=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(API + ruta, headers=headers,
                                 data=None if datos is None else json.dumps(datos).encode(),
                                 method=metodo or ('GET' if datos is None else 'POST'))
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)


def layout():
    adb('shell', 'uiautomator', 'dump', '/sdcard/zav-ventas.xml')
    contenido = adb('shell', 'cat', '/sdcard/zav-ventas.xml')
    # Android puede serializar caracteres de control de campos de contraseña.
    contenido = re.sub(r'&#(?:x(?:0[0-8bcef]|1[0-9a-f])|(?:[0-8]|11|12|1[4-9]|2[0-9]|3[01]));', '', contenido, flags=re.I)
    contenido = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', contenido)
    return ET.fromstring(contenido)


def encontrar(texto, exacto=True, clase=None):
    try:
        raiz = layout()
    except (subprocess.CalledProcessError, ET.ParseError):
        # El primer frame del arranque todavía puede no tener raíz accesible.
        return None
    for nodo in raiz.iter('node'):
        if clase and nodo.get('class') != clase:
            continue
        limites = list(map(int, re.findall(r'\d+', nodo.get('bounds', ''))))
        if len(limites) != 4 or limites[2] <= limites[0] or limites[3] <= limites[1]:
            continue
        for atributo in ('text', 'content-desc'):
            valor = nodo.get(atributo, '').casefold()
            if (valor == texto.casefold() if exacto else texto.casefold() in valor):
                return nodo
    return None


def esperar(texto, exacto=True, desplazar=False, clase=None):
    limite = time.monotonic() + 45
    intentos = 0
    while time.monotonic() < limite:
        nodo = encontrar(texto, exacto, clase)
        if nodo is not None:
            return nodo
        if desplazar:
            # Pixel 2, pantalla 1080x1920: gestos dentro del ScrollView.
            if intentos % 12 < 8:
                adb('shell', 'input', 'swipe', '540', '1500', '540', '450', '350')
            else:
                adb('shell', 'input', 'swipe', '540', '450', '540', '1500', '350')
        intentos += 1
        time.sleep(0.7)
    raise AssertionError('No aparece en APK: ' + texto)


def tocar(texto, exacto=True, desplazar=True):
    nodo = esperar(texto, exacto, desplazar)
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', nodo.get('bounds', '')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))


def escribir(etiqueta, valor):
    # La etiqueta visible TextView no transfiere foco; seleccionar el EditText accesible.
    nodo = esperar(etiqueta, desplazar=True, clase='android.widget.EditText')
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', nodo.get('bounds', '')))
    adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    hasta(lambda: any(n.get('class') == 'android.widget.EditText'
                     and n.get('content-desc') == etiqueta and n.get('focused') == 'true'
                     for n in layout().iter('node')))
    adb('shell', 'input', 'keycombination', '113', '29')
    adb('shell', 'input', 'text', valor)
    adb('shell', 'input', 'keyevent', '4')


def captura(nombre):
    ET.ElementTree(layout()).write(SALIDA / (nombre+'.xml'), encoding='utf8')
    with open(SALIDA / (nombre+'.png'), 'wb') as f:
        subprocess.run(['adb', '-s', SERIAL, 'exec-out', 'screencap', '-p'], stdout=f, check=True, timeout=30)


def saldo(token, producto):
    return next((p['cantidadDisponible'] for p in api('operaciones/disponibilidad', token=token)['items'] if p['productoId'] == producto), 0)


def hasta(condicion):
    limite = time.monotonic()+30
    while time.monotonic()<limite:
        if condicion():
            return
        time.sleep(1)
    raise AssertionError('La API no confirmó el resultado esperado.')


proxy = None
try:
    assert os.environ.get('NODE_ENV') == 'test'
    assert re.fullmatch(r'postgresql://[^@]+@127\.0\.0\.1:5432/zav_test', os.environ.get('DATABASE_URL', '')), 'Solo PostgreSQL QA de Actions.'
    proxy = ThreadingHTTPServer(('0.0.0.0', 3003), RespuestaIncierta)
    threading.Thread(target=proxy.serve_forever, daemon=True).start()
    admin = api('auth/login', {'identificador': os.environ['QA_ADMIN_IDENTIFICADOR'], 'contrasena': os.environ['QA_ADMIN_PASSWORD']})
    vendedor = api('auth/login', {'identificador': os.environ['QA_VENDEDOR_IDENTIFICADOR'], 'contrasena': os.environ['QA_VENDEDOR_PASSWORD']})
    at, vt = admin['accessToken'], vendedor['accessToken']
    codigo = 'ANDROID-QA-' + uuid.uuid4().hex[:8].upper()
    p = api('productos', {'codigo':codigo,'nombre':'Producto sintético Android','familia':'QA Android','presentacion':'Paquete QA 500g','pesoGramos':500,'precioBob':'20.00','validacionComercial':'VALIDADO'}, at)
    l = api('lotes', {'operacionClave':str(uuid.uuid4()),'productoId':p['id'],'codigo':'L-'+codigo,'elaboradoEl':str(date.today()-timedelta(days=1)),'venceEl':str(date.today()+timedelta(days=30)),'cantidadInicial':10,'ubicacionCodigo':'PRODUCCION_ALMACENAMIENTO'}, at)
    api('lotes/'+l['id']+'/liberar',{'operacionClave':str(uuid.uuid4()),'motivo':'Liberación sintética QA'},at)
    api('movimientos/traslado',{'operacionClave':str(uuid.uuid4()),'loteId':l['id'],'cantidad':10,'origenCodigo':'PRODUCCION_ALMACENAMIENTO','destinoCodigo':'VENTA_DESPACHO'},at)
    carga = api('operaciones/cargas',{'operacionClave':str(uuid.uuid4()),'vendedorId':vendedor['usuario']['id'],'detalles':[{'productoId':p['id'],'cantidad':5}]},at)
    assert saldo(vt,p['id'])==0, 'Carga sin recepción no vendible.'
    apk = glob.glob('apk-qa/**/*-qa.apk', recursive=True)
    assert len(apk)==1
    adb('install','-r',apk[0])
    adb('shell','pm','clear',PACKAGE)  # Solo identidad QA instalada en emulador aislado.
    adb('shell','pm','grant',PACKAGE,'android.permission.ACCESS_FINE_LOCATION')
    adb('shell','pm','grant',PACKAGE,'android.permission.ACCESS_COARSE_LOCATION')
    adb('shell','settings','put','secure','location_mode','3')
    adb('emu','geo','fix','-64.73','-21.53')
    adb('shell','monkey','-p',PACKAGE,'-c','android.intent.category.LAUNCHER','1')
    tocar('Configurar API de mi computadora')
    escribir('Dirección de la API de pruebas','http://10.0.2.2:3003')
    tocar('Probar y guardar servidor')
    esperar('Servidor de pruebas conectado.')
    escribir('Identificador',os.environ['QA_VENDEDOR_IDENTIFICADOR'])
    escribir('Contraseña',os.environ['QA_VENDEDOR_PASSWORD'])
    tocar('Iniciar sesión')
    tocar('Venta directa')
    tocar('Cargas y devolución')
    tocar('Confirmar recepción')
    tocar('Recibí la carga')
    hasta(lambda:saldo(vt,p['id'])==5)
    captura('01-carga-recibida')
    permisos = ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION']
    for permiso in permisos:
        adb('shell','pm','revoke',PACKAGE,permiso)
        adb('shell','pm','set-permission-flags',PACKAGE,permiso,'user-fixed')
    adb('shell','monkey','-p',PACKAGE,'-c','android.intent.category.LAUNCHER','1')
    tocar('Venta directa')
    escribir('Cantidad '+codigo,'2')
    tocar('Obtener GPS y revisar entrega')
    esperar('No se registró la entrega: falta autorizar la ubicación puntual.',desplazar=True)
    assert saldo(vt,p['id'])==5
    assert len(api('operaciones?tipo=SALIDA_DIRECTA',token=vt)['items'])==0
    captura('02-permiso-gps-denegado')
    for permiso in reversed(permisos):
        adb('shell','pm','clear-permission-flags',PACKAGE,permiso,'user-fixed','user-set')
        adb('shell','pm','grant',PACKAGE,permiso)
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','monkey','-p',PACKAGE,'-c','android.intent.category.LAUNCHER','1')
    tocar('Venta directa')
    tocar('Nueva venta')
    escribir('Cantidad '+codigo,'2')
    adb('emu','geo','fix','-64.73','-21.53')
    tocar('Obtener GPS y revisar entrega')
    esperar('Confirmar venta directa')
    captura('02-confirmacion-gps')
    tocar('Confirmar entrega')
    hasta(lambda:saldo(vt,p['id'])==3)
    esperar('Pendiente de verificar', desplazar=True)
    captura('03-respuesta-incierta')
    assert len(api('operaciones?tipo=SALIDA_DIRECTA',token=vt)['items']) == 1
    adb('shell','am','force-stop',PACKAGE)
    adb('shell','monkey','-p',PACKAGE,'-c','android.intent.category.LAUNCHER','1')
    tocar('Venta directa')
    esperar('Pendiente de verificar', desplazar=True)
    tocar('Verificar / reintentar')
    esperar('Confirmado por el servidor:',exacto=False,desplazar=True)
    assert len(RespuestaIncierta.intentos_venta) == 2
    assert RespuestaIncierta.intentos_venta[0] == RespuestaIncierta.intentos_venta[1], 'El reintento debe conservar todos los datos y la clave.'
    assert saldo(vt,p['id'])==3
    tocar('Historial')
    esperar('SALIDA_DIRECTA',exacto=False,desplazar=True)
    captura('03-venta-confirmada')
    historial=api('operaciones?tipo=SALIDA_DIRECTA',token=vt)['items']
    assert len(historial)==1
    venta=api('operaciones/'+historial[0]['id'],token=vt)
    assert venta['usuarioId']==vendedor['usuario']['id'] and venta['detalles'][0]['cantidad']==2
    assert abs(float(venta['latitud'])+21.53)<0.01 and venta['precisionM'] is not None
    tocar('Cargas y devolución')
    escribir('Devolver lote L-'+codigo,'1')
    escribir('Motivo de devolución','Sobrante-QA')
    tocar('Revisar devolución')
    tocar('Solicitar')
    hasta(lambda:saldo(vt,p['id'])==2)
    devolucion=api('operaciones?tipo=DEVOLUCION',token=vt)['items'][0]
    assert devolucion['estado']=='PENDIENTE_RECEPCION'
    api('operaciones/'+devolucion['id']+'/recibir-devolucion',{'operacionClave':str(uuid.uuid4())},at)
    assert api('operaciones/conciliacion',token=at)['conciliado']
    tocar('Actualizar datos')
    captura('04-devolucion-recibida')
    resultado={'apk':Path(apk[0]).name,'apkSha256':hashlib.sha256(Path(apk[0]).read_bytes()).hexdigest(),'apkRunId':os.environ.get('QA_APK_RUN_ID'),'pruebaCommit':os.environ.get('GITHUB_SHA'),'carga':carga['id'],'venta':venta['id'],'devolucion':devolucion['id'],'stockLibreFinal':saldo(vt,p['id']),'gpsPuntual':True,'permisoDenegadoSinSalida':True,'respuestaInciertaRecuperadaTrasReabrir':True,'reintentoMismaSolicitud':True,'conciliado':True,'api':'local','base':'zav_test'}
    (SALIDA/'resultado.json').write_text(json.dumps(resultado,indent=2)+'\n',encoding='utf8')
    print(json.dumps(resultado))
finally:
    if proxy:
        proxy.shutdown()
    try:
        captura('estado-final')
        (SALIDA/'logcat.log').write_text(adb('logcat','-d','-t','500'),encoding='utf8')
    except (subprocess.SubprocessError,ET.ParseError,AssertionError) as error:
        print('No se obtuvo evidencia final:',type(error).__name__)
