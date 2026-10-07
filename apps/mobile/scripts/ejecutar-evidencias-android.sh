#!/usr/bin/env bash
set -euo pipefail

APK="apps/mobile/android/app/build/outputs/apk/release/app-release.apk"
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
