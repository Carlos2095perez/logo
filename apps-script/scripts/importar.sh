#!/usr/bin/env bash
# Descarga el código actual de cada hoja a apps-script/importado/<NOMBRE>/
# para poder compararlas antes de unificar el código en src/.
set -euo pipefail

BASE="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="$BASE/importado"
rm -rf "$DESTINO"
mkdir -p "$DESTINO"

while read -r hoja; do
  nombre=$(jq -r .nombre <<<"$hoja")
  script_id=$(jq -r .scriptId <<<"$hoja")
  if [[ "$script_id" == PEGAR_* ]]; then
    echo "-- $nombre: sin scriptId en hojas.json, se omite"
    continue
  fi

  dir="$DESTINO/$nombre"
  mkdir -p "$dir"
  echo "{\"scriptId\":\"$script_id\",\"rootDir\":\"$dir\"}" >"$dir/.clasp.json"
  echo "== $nombre ($script_id)"
  (cd "$dir" && clasp pull)
  rm -f "$dir/.clasp.json"
done < <(jq -c '.[]' "$BASE/hojas.json")
