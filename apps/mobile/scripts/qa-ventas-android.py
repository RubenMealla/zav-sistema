"""Ejecuta el APK QA contra NestJS/PostgreSQL locales; nunca usa producción."""
import glob
import json
import os
import re
import subprocess
import time
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import date, timedelta
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
    return ET.fromstring(adb('shell', 'cat', '/sdcard/zav-ventas.xml'))


def encontrar(texto, exacto=True):
    for nodo in layout().iter('node'):
        for atributo in ('text', 'content-desc'):
            valor = nodo.get(atributo, '')
            if (valor == texto if exacto else texto in valor):
                return nodo
    return None


def esperar(texto, exacto=True, desplazar=False):
    limite = time.monotonic() + 45
    intentos = 0
    while time.monotonic() < limite:
        nodo = encontrar(texto, exacto)
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
    tocar(etiqueta)
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


try:
    assert os.environ.get('NODE_ENV') == 'test'
    assert re.fullmatch(r'postgresql://[^@]+@127\.0\.0\.1:5432/zav_test', os.environ.get('DATABASE_URL', '')), 'Solo PostgreSQL QA de Actions.'
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
    escribir('Dirección de la API de pruebas','http://10.0.2.2:3001')
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
    tocar('Nueva venta')
    escribir('Cantidad '+codigo,'2')
    adb('emu','geo','fix','-64.73','-21.53')
    tocar('Obtener GPS y revisar entrega')
    esperar('Confirmar venta directa')
    captura('02-confirmacion-gps')
    tocar('Confirmar entrega')
    hasta(lambda:saldo(vt,p['id'])==3)
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
    resultado={'apk':Path(apk[0]).name,'carga':carga['id'],'venta':venta['id'],'devolucion':devolucion['id'],'stockLibreFinal':saldo(vt,p['id']),'gpsPuntual':True,'conciliado':True,'api':'local','base':'zav_test'}
    (SALIDA/'resultado.json').write_text(json.dumps(resultado,indent=2)+'\n',encoding='utf8')
    print(json.dumps(resultado))
finally:
    try:
        captura('estado-final')
        (SALIDA/'logcat.log').write_text(adb('logcat','-d','-t','500'),encoding='utf8')
    except (subprocess.SubprocessError,ET.ParseError,AssertionError) as error:
        print('No se obtuvo evidencia final:',type(error).__name__)
