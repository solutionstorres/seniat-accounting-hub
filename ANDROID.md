# ContaVE — App para Android (APK)

La aplicación web queda envuelta en una app nativa con Capacitor. La app abre
directamente el sitio publicado, así que siempre muestra la última versión sin
tener que reinstalar el APK.

## Opción A — Generar el APK desde GitHub (sin instalar nada)

El repositorio incluye el workflow `.github/workflows/build-apk.yml`:

1. Conecta el proyecto a GitHub (menú **+** → GitHub → Connect project).
2. En GitHub abre **Actions → Build APK (ContaVE) → Run workflow**.
3. Elige modo `debug` o `release` y espera unos minutos.
4. Descarga el APK desde **Artifacts** del run terminado.

Para `release` define los secrets `KEYSTORE_BASE64`, `KEYSTORE_PASS`,
`KEY_ALIAS` y `KEY_PASS` en Settings → Secrets and variables → Actions.

## Opción B — Generarlo en tu computadora

1. **Node.js 20 o superior** — https://nodejs.org
2. **JDK 17** (Temurin/Adoptium) — comprueba con `java -version`
3. **Android Studio** (incluye el SDK) y la variable `ANDROID_HOME` apuntando al SDK

> El entorno de Lovable no tiene el SDK de Android, por eso el APK se compila
> en tu máquina con el script incluido o en GitHub con el workflow.

## Generar el APK de prueba

```bash
bash scripts/build-apk.sh
```

Resultado: `dist-apk/ContaVE.apk`. Instálalo con `adb install -r dist-apk/ContaVE.apk`
o copiándolo al teléfono.

## Generar el APK firmado (para Play Store o distribución)

```bash
keytool -genkey -v -keystore contave.keystore -alias contave \
  -keyalg RSA -keysize 2048 -validity 10000

KEYSTORE_PATH=$PWD/contave.keystore KEYSTORE_PASS=tuclave \
KEY_ALIAS=contave KEY_PASS=tuclave \
bash scripts/build-apk.sh --release
```

## Opciones

| Variable   | Valor por defecto                          | Para qué sirve            |
|------------|--------------------------------------------|---------------------------|
| `APP_URL`  | `https://seniat-sync-buddy.lovable.app`     | Dirección web que abre    |
| `APP_NAME` | `ContaVE`                                   | Nombre visible del ícono  |
| `APP_ID`   | `ve.contave.app`                            | Identificador de la app   |

Ejemplo con dominio propio:

```bash
APP_URL=https://contabilidad.miempresa.com bash scripts/build-apk.sh
```
