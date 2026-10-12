#!/usr/bin/env bash
# Sube el código de apps-script/src/ a las 5 hojas listadas en hojas.json.
# Uso: desplegar.sh [NOMBRE]   (sin argumento = todas las hojas)
set -euo pipefail

BASE="$(cd "$(dirname "$0")/.." && pwd)"
SOLO="${1:-}"

# Protección: clasp push reemplaza TODO el proyecto remoto. Si src/ no tiene
# código real, un push borraría los scripts de las hojas.
if ! ls "$BASE"/src/*.gs "$BASE"/src/*.js >/dev/null 2>&1; then
  echo "AVISO: apps-script/src/ todavía no tiene archivos .gs/.js. No se despliega nada."
  exit 0
fi
if [ ! -f "$BASE/src/appsscript.json" ]; then
  echo "ERROR: falta apps-script/src/appsscript.json. No se despliega nada." >&2
  exit 1
fi

fallos=0
desplegadas=0
while read -r hoja; do
  nombre=$(jq -r .nombre <<<"$hoja")
  script_id=$(jq -r .scriptId <<<"$hoja")
  spreadsheet_id=$(jq -r .spreadsheetId <<<"$hoja")

  if [ -n "$SOLO" ] && [ "$SOLO" != "$nombre" ]; then continue; fi
  if [[ "$script_id" == PEGAR_* ]]; then
    echo "-- $nombre: sin scriptId en hojas.json, se omite"
    continue
  fi

  tmp=$(mktemp -d)
  cp -r "$BASE"/src/. "$tmp"/
  # Constante disponible en el código para diferenciar cada hoja (HOJA.nombre).
  cat >"$tmp/_hoja.gs" <<EOF
// Archivo generado al desplegar. No editar en el editor de Apps Script.
var HOJA = { nombre: '$nombre', spreadsheetId: '$spreadsheet_id' };
EOF
  echo "{\"scriptId\":\"$script_id\",\"rootDir\":\"$tmp\"}" >"$tmp/.clasp.json"

  echo "== $nombre ($script_id)"
  if (cd "$tmp" && clasp push --force); then
    desplegadas=$((desplegadas + 1))
  else
    echo "!! Falló el despliegue en $nombre" >&2
    fallos=$((fallos + 1))
  fi
  rm -rf "$tmp"
done < <(jq -c '.[]' "$BASE/hojas.json")

echo "Desplegadas: $desplegadas  Fallos: $fallos"
[ "$fallos" -eq 0 ]
