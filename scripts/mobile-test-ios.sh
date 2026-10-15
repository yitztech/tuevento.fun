#!/usr/bin/env bash
# SOLO PARA PRUEBAS. Compila la app de iOS para el SIMULADOR (sin firma, id
# com.tueventofun.app.pruebas), apuntada a https://localhost:8443 (servicio mobile-tls de
# compose.yml), confía en la CA de pruebas solo en ese simulador, la instala y la abre.
# No firma ni publica nada: el release sigue en mobile.yml.
#
#   bash scripts/mobile-test-ios.sh
#   SIMULATOR="iPhone 17" bash scripts/mobile-test-ios.sh
#   SKIP_BUILD=1 bash scripts/mobile-test-ios.sh      # reutiliza la app ya compilada
set -euo pipefail
cd "$(dirname "$0")/.."

ORIGIN="https://localhost:8443"
SIMULATOR="${SIMULATOR:-iPhone 17 Pro}"
APP_ID="com.tueventofun.app.pruebas"
BUILD=tests/mobile/.build/ios
APP="$BUILD/Build/Products/Debug-iphonesimulator/App.app"

UDID="$(xcrun simctl list devices available -j | node -e '
  const nombre = process.argv[1];
  const todos = Object.values(JSON.parse(require("fs").readFileSync(0, "utf8")).devices).flat();
  const d = todos.find((x) => x.name === nombre);
  if (!d) { console.error(`No hay un simulador llamado "${nombre}"`); process.exit(1); }
  console.log(d.udid);' "$SIMULATOR")"

if [ -z "${SKIP_BUILD:-}" ]; then
  echo "▸ HTTPS de pruebas y CA"
  docker compose --profile mobile up -d --wait gateway mobile-tls >/dev/null 2>&1 || docker compose --profile mobile up -d gateway mobile-tls
  bash scripts/mobile-test-ca.sh >/dev/null

  echo "▸ Web empaquetada contra $ORIGIN"
  export VITE_PUBLIC_ORIGIN="$ORIGIN" VITE_APP_VERSION="0.0.0-pruebas"
  npm run build -w @tuevento/contracts >/dev/null
  npm run build -w @tuevento/client >/dev/null
  (cd apps/web && npm run build >/dev/null && npx cap sync ios >/dev/null)

  echo "▸ App para el simulador (sin firma)"
  xcodebuild -project apps/web/ios/App/App.xcodeproj -scheme App -configuration Debug \
    -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath "$BUILD" \
    CODE_SIGNING_ALLOWED=NO PRODUCT_BUNDLE_IDENTIFIER="$APP_ID" APP_LINK_HOST=localhost \
    -quiet build
fi
[ -d "$APP" ] || { echo "No existe $APP" >&2; exit 1; }

echo "▸ Simulador $SIMULATOR"
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator --args -CurrentDeviceUDID "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null

echo "▸ CA de pruebas (solo en este simulador), instalar y abrir"
xcrun simctl keychain "$UDID" add-root-cert tests/mobile/.ca/root.crt
xcrun simctl install "$UDID" "$APP"
xcrun simctl terminate "$UDID" "$APP_ID" 2>/dev/null || true
xcrun simctl launch "$UDID" "$APP_ID" >/dev/null
echo "✓ $APP_ID en el simulador $SIMULATOR (origen $ORIGIN)"
