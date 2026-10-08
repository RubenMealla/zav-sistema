#!/usr/bin/env bash
# Ejecuta los casos QA Android sobre un solo emulador y el APK reutilizado.
# Cada caso escribe su propio REPORTE-*.json y las capturas reales.
set -u -o pipefail

SALIDA="apps/mobile/test-results/evidencias-movil"
mkdir -p "$SALIDA"
RESUMEN="$SALIDA/RESUMEN-SUITE-ANDROID.txt"
{
  echo "ZAV Vendedor - QA Android"
  echo "run_id=${GITHUB_RUN_ID:-local}"
  echo "commit=${GITHUB_SHA:-local}"
  echo "apk_origen=${APK_BUILD_SHA:-no-especificado}"
  echo "resultados por caso:"
} > "$RESUMEN"

FALLOS=0
EJECUTADOS=0

ejecutar_caso() {
  local nombre="$1"
  shift
  echo "::group::QA Android - $nombre"
  "$@"
  local resultado=$?
  echo "::endgroup::"

  EJECUTADOS=$((EJECUTADOS + 1))
  if [[ "$resultado" -eq 0 ]]; then
    echo "$nombre=CORRECTO" | tee -a "$RESUMEN"
  else
    echo "$nombre=FALLIDO (código $resultado)" | tee -a "$RESUMEN"
    FALLOS=$((FALLOS + 1))
  fi
}

ejecutar_caso capturas_basicas env \
  APK_PATH=/tmp/zav-apk/ZAV-Vendedor-1.0.0-build10000-qa.apk \
  bash apps/mobile/scripts/ejecutar-evidencias-android.sh

ejecutar_caso registro_pedido \
  python3 apps/mobile/scripts/qa-registro-pedido-android.py

ejecutar_caso retiro_pedido \
  python3 apps/mobile/scripts/qa-retiro-android.py

ejecutar_caso validacion_cliente_sin_ubicacion \
  python3 apps/mobile/scripts/qa-validacion-cliente-android.py

ejecutar_caso anulacion_pedido \
  python3 apps/mobile/scripts/qa-cancelacion-pedido-android.py

{
  echo "ejecutados=$EJECUTADOS"
  echo "fallidos=$FALLOS"
} | tee -a "$RESUMEN"

if [[ "$FALLOS" -gt 0 ]]; then
  echo "::error::QA Android: $FALLOS de $EJECUTADOS casos fallidos; revisar reportes y capturas."
  exit 1
fi
echo "QA Android: todos los $EJECUTADOS casos fueron correctos."
