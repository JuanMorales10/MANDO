#!/bin/bash
# MANDO · doble clic para arrancar todo en la notebook del proyector.
# Levanta el servidor con puntero (npm run sala:puntero) y abre la pantalla del proyector con el QR.
# Funciona aunque la Mac no tenga Node: usa el que traen Cursor o VS Code.

cd "$(dirname "$0")" || exit 1

if command -v node >/dev/null 2>&1; then
  NODE="node"
elif [ -x "/Applications/Cursor.app/Contents/MacOS/Cursor" ]; then
  export ELECTRON_RUN_AS_NODE=1
  NODE="/Applications/Cursor.app/Contents/MacOS/Cursor"
elif [ -x "/Applications/Visual Studio Code.app/Contents/MacOS/Electron" ]; then
  export ELECTRON_RUN_AS_NODE=1
  NODE="/Applications/Visual Studio Code.app/Contents/MacOS/Electron"
else
  echo "No encontré Node, Cursor ni VS Code. Instalá Node desde https://nodejs.org y volvé a abrir MANDO."
  read -r -p "Enter para cerrar…"
  exit 1
fi

PUERTO="${PUERTO_PANTALLA:-8090}"
# Abre la pantalla del proyector cuando el servidor ya está escuchando.
(
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "http://localhost:${PUERTO}/proyector.html"; then
      open "http://localhost:${PUERTO}/proyector.html"
      exit 0
    fi
    sleep 0.25
  done
) &

echo "MANDO arrancando… (cerrá esta ventana para apagarlo)"
exec "$NODE" server/con-puntero.mjs
