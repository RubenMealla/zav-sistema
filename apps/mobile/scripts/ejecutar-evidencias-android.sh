#!/usr/bin/env bash
set -euo pipefail

APK="${APK_PATH:-apps/mobile/android/app/build/outputs/apk/release/app-release.apk}"
REMOTE_APK="/data/local/tmp/zav-evidencia.apk"
PACKAGE="bo.zav.gestion.vendedor"

echo "== Preparación del emulador =="
adb wait-for-device

for intento in $(seq 1 60); do
  BOOT="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  PM_READY="$(adb shell pm path android 2>/dev/null || true)"
  if [[ "$BOOT" == "1" && -n "$PM_READY" ]]; then
    echo "Android y Package Manager listos."
    break
  fi

  if [[ "$intento" == "60" ]]; then
    echo "El emulador arrancó, pero Package Manager no quedó estable."
    adb shell getprop || true
    exit 1
  fi
  sleep 2
done

adb shell settings put global verifier_verify_adb_installs 0 || true
adb shell settings put global package_verifier_enable 0 || true

echo "== Instalación no-streaming del APK =="
test -s "$APK"
adb push "$APK" "$REMOTE_APK"

INSTALADO=0
for intento in 1 2 3; do
  if adb shell pm install -r "$REMOTE_APK"; then
    INSTALADO=1
    break
  fi
  echo "Reintento de instalación $intento/3..."
  adb wait-for-device
  sleep 5
done

if [[ "$INSTALADO" != "1" ]]; then
  echo "No se pudo instalar el APK después de 3 intentos."
  adb shell dumpsys package | tail -n 120 || true
  exit 1
fi

INSTALLED_PATH="$(adb shell pm path "$PACKAGE" | tr -d '\r')"
if [[ "$INSTALLED_PATH" != package:* ]]; then
  echo "Package Manager no confirmó la instalación de $PACKAGE."
  exit 1
fi

echo "$INSTALLED_PATH"
echo "== Capturas funcionales =="
python3 apps/mobile/scripts/capturar-evidencias-movil.py

# Flujo integral: tras las capturas básicas, ejecutar las operaciones
# ya comprobadas individualmente. El workflow ejecuta GPS a continuación.
# Los reportes JSON por escenario quedan preservados en el artifact.
# Los fallos no interrumpen la captura de los siguientes escenarios.
# Se conservan resultados individuales y el script final GPS devolverá
# código != 0 cuando algún caso funcional haya fallado.
SALIDA="apps/mobile/test-results/evidencias-movil"
ESTADO="$SALIDA/RESULTADOS-SUITE-AMPLIADA.txt"
echo "run_id=${GITHUB_RUN_ID:-local}" > "$ESTADO"
echo "commit=${GITHUB_SHA:-local}" >> "$ESTADO"
FALLOS=0
TOTAL=0

ejecutar_qa() {
  local caso="$1"
  shift
  echo "== QA Android: $caso =="
  TOTAL=$((TOTAL + 1))
  if "$@"; then
    echo "$caso=CORRECTO" | tee -a "$ESTADO"
  else
    rc=$?
    echo "$caso=FALLIDO (código $rc)" | tee -a "$ESTADO"
    FALLOS=$((FALLOS + 1))
  fi
}

ejecutar_qa registro_pedido python3 apps/mobile/scripts/qa-registro-pedido-android.py
ejecutar_qa retiro_pedido python3 apps/mobile/scripts/qa-retiro-android.py
ejecutar_qa validacion_cliente_sin_gps python3 apps/mobile/scripts/qa-validacion-cliente-android.py
ejecutar_qa anulacion_pedido python3 apps/mobile/scripts/qa-cancelacion-pedido-android.py
ejecutar_qa organizacion_reparto python3 apps/mobile/scripts/qa-organizacion-reparto-android.py
ejecutar_qa conflicto_http_409 python3 apps/mobile/scripts/qa-conflicto-anulacion-android.py
ejecutar_qa edicion_pedido python3 apps/mobile/scripts/qa-edicion-pedido-android.py
ejecutar_qa alta_cliente_gps python3 apps/mobile/scripts/qa-alta-cliente-android.py
ejecutar_qa nuevo_pedido_en_ruta python3 apps/mobile/scripts/qa-nuevo-pedido-recorrido-android.py
ejecutar_qa retiro_multiple python3 apps/mobile/scripts/qa-retiro-multiple-android.py
ejecutar_qa permiso_gps_denegado python3 apps/mobile/scripts/qa-gps-denegado-android.py
echo "ejecutados=$TOTAL" | tee -a "$ESTADO"
echo "fallidos=$FALLOS" | tee -a "$ESTADO"
echo "Se ejecutaron $TOTAL casos operativos; $FALLOS fallidos. Sigue entrega GPS autorizada."
