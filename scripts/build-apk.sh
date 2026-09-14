#!/usr/bin/env bash
# ============================================================
#  ContaVE — Generador de APK (Android)
#  Empaqueta la aplicación web en una app nativa con Capacitor.
#
#  Uso:
#     bash scripts/build-apk.sh                    # APK de depuración
#     bash scripts/build-apk.sh --release          # APK firmado (requiere keystore)
#     APP_URL=https://mi-dominio.com bash scripts/build-apk.sh
#
#  Requisitos en la máquina donde se ejecuta:
#     - Node.js 20+ y npm
#     - JDK 17  (java -version)
#     - Android SDK + variable ANDROID_HOME  (Android Studio o cmdline-tools)
#  El APK final queda en:  dist-apk/ContaVE.apk
# ============================================================
set -euo pipefail

APP_ID="${APP_ID:-ve.contave.app}"
APP_NAME="${APP_NAME:-ContaVE}"
APP_URL="${APP_URL:-https://seniat-sync-buddy.lovable.app}"
MODE="debug"
[[ "${1:-}" == "--release" ]] && MODE="release"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$ROOT/.android-shell"
OUT="$ROOT/dist-apk"

echo "==> App:  $APP_NAME ($APP_ID)"
echo "==> URL:  $APP_URL"
echo "==> Modo: $MODE"

command -v node >/dev/null || { echo "Falta Node.js 20+"; exit 1; }
command -v java >/dev/null || { echo "Falta JDK 17 (java)"; exit 1; }
[[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ]] || {
  echo "Falta ANDROID_HOME/ANDROID_SDK_ROOT (instala Android Studio o cmdline-tools)"; exit 1; }

# ---------- 1. Proyecto contenedor Capacitor ----------
mkdir -p "$WORK/www"
cd "$WORK"

if [[ ! -f package.json ]]; then
  npm init -y >/dev/null
  npm i @capacitor/core @capacitor/android @capacitor/cli @capacitor/splash-screen >/dev/null
fi

# ---------- 2. Pantalla puente (carga la web y muestra aviso sin conexión) ----------
cat > www/index.html <<HTML
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>$APP_NAME</title>
<style>
  html,body{margin:0;height:100%;background:#0A2540;color:#fff;
    font-family:system-ui,-apple-system,sans-serif}
  .c{height:100%;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:14px;text-align:center;padding:24px}
  b{font-size:22px} p{opacity:.75;font-size:14px;margin:0}
  button{margin-top:8px;padding:12px 20px;border:0;border-radius:10px;
    background:#F59E0B;color:#0A2540;font-weight:700;font-size:15px}
</style>
</head>
<body>
  <div class="c">
    <b>$APP_NAME</b>
    <p id="m">Conectando…</p>
    <button onclick="go()">Reintentar</button>
  </div>
<script>
  var URL_APP = "$APP_URL";
  function go(){
    document.getElementById('m').textContent = 'Conectando…';
    location.replace(URL_APP);
  }
  if (navigator.onLine) { go(); }
  else { document.getElementById('m').textContent = 'Sin conexión a internet.'; }
</script>
</body>
</html>
HTML

# ---------- 3. Configuración Capacitor ----------
cat > capacitor.config.json <<JSON
{
  "appId": "$APP_ID",
  "appName": "$APP_NAME",
  "webDir": "www",
  "server": { "url": "$APP_URL", "cleartext": false, "androidScheme": "https" },
  "android": { "allowMixedContent": false },
  "plugins": { "SplashScreen": { "backgroundColor": "#0A2540", "launchAutoHide": true } }
}
JSON

# ---------- 4. Plataforma Android ----------
[[ -d android ]] || npx cap add android
npx cap sync android

# ---------- 5. Compilar ----------
cd android
chmod +x gradlew
if [[ "$MODE" == "release" ]]; then
  # Firma: exporta KEYSTORE_PATH, KEYSTORE_PASS, KEY_ALIAS, KEY_PASS
  : "${KEYSTORE_PATH:?Define KEYSTORE_PATH para compilar en release}"
  ./gradlew assembleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password="${KEYSTORE_PASS:?}" \
    -Pandroid.injected.signing.key.alias="${KEY_ALIAS:?}" \
    -Pandroid.injected.signing.key.password="${KEY_PASS:?}"
  APK=$(find app/build/outputs/apk/release -name "*.apk" | head -1)
else
  ./gradlew assembleDebug
  APK=$(find app/build/outputs/apk/debug -name "*.apk" | head -1)
fi

mkdir -p "$OUT"
cp "$APK" "$OUT/$APP_NAME.apk"
echo ""
echo "✅ APK generado: $OUT/$APP_NAME.apk"
echo "   Instálalo en el teléfono con:  adb install -r \"$OUT/$APP_NAME.apk\""
