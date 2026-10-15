#!/usr/bin/env bash
# SOLO PARA PRUEBAS. Compila el APK de DEPURACIÓN de la app (id com.tueventofun.app.pruebas),
# apuntado a https://localhost:8443 (servicio mobile-tls de compose.yml), lo instala en el
# emulador de Android y lo abre. No firma ni publica nada: el release sigue en mobile.yml.
#
#   bash scripts/mobile-test-android.sh            # todo: build + emulador + instalar + abrir
#   AVD=Pixel_10_Pro bash scripts/mobile-test-android.sh
#   SKIP_BUILD=1 bash scripts/mobile-test-android.sh   # reutiliza el APK ya compilado
set -euo pipefail
cd "$(dirname "$0")/.."

ORIGIN="https://localhost:8443"
AVD="${AVD:-Pixel_10}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
APK=apps/web/android/app/build/outputs/apk/debug/app-debug.apk
APP_ID="com.tueventofun.app.pruebas"
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
# En CI, setup-java ya define JAVA_HOME; en local se busca el JDK 21 de macOS.
if [ -z "${JAVA_HOME:-}" ]; then
  export JAVA_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || echo /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home)"
fi

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "▸ HTTPS de pruebas y CA"
  # MOBILE_STACK=native: CI de macOS sin Docker (scripts/mobile-native-stack.sh ya lo levantó).
  if [ "${MOBILE_STACK:-}" != native ]; then
    docker compose --profile mobile up -d --wait gateway mobile-tls >/dev/null 2>&1 || docker compose --profile mobile up -d gateway mobile-tls
  fi
  bash scripts/mobile-test-ca.sh >/dev/null
  mkdir -p apps/web/android/app/src/debug/res/raw
  cp tests/mobile/.ca/root.crt apps/web/android/app/src/debug/res/raw/test_ca.crt

  echo "▸ Web empaquetada contra $ORIGIN"
  export VITE_PUBLIC_ORIGIN="$ORIGIN" VITE_APP_VERSION="0.0.0-pruebas"
  npm run build -w @tuevento/contracts >/dev/null
  npm run build -w @tuevento/client >/dev/null
  (cd apps/web && npm run build >/dev/null && npx cap sync android >/dev/null)

  echo "▸ APK de depuración"
  (cd apps/web/android && ./gradlew assembleDebug -q)
fi
[ -f "$APK" ] || { echo "No existe $APK" >&2; exit 1; }

echo "▸ Emulador $AVD"
if ! "$ADB" devices | grep -q "emulator-.*device$"; then
  nohup "$SDK/emulator/emulator" -avd "$AVD" -no-snapshot-save >"${TMPDIR:-/tmp}/emulador-$AVD.log" 2>&1 &
  "$ADB" wait-for-device
  until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
fi

echo "▸ Instalar y abrir"
"$ADB" reverse tcp:8443 tcp:8443 >/dev/null
"$ADB" install -r "$APK" >/dev/null
"$ADB" shell am force-stop "$APP_ID"
"$ADB" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
echo "✓ $APP_ID en el emulador (origen $ORIGIN)"
