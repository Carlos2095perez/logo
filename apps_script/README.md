# CIERRE RUTA CHOFERES — código fuente (respaldo)

App de Google Apps Script para el cierre de ruta de los camiones de
INDUSTRIA ALIMENTICIA YES.

- `cierre_ruta_choferes/` contiene el proyecto de Apps Script
  (`Código.js`, `Index.html`, `_SeedUbicaciones.js`, `appsscript.json`).
- `scriptId`: ver `.clasp.json`.
- Para trabajar el proyecto: `clasp login` y luego `clasp pull` / `clasp push`
  dentro de esa carpeta.

Este respaldo existe porque el entorno de trabajo es efímero: si se reinicia
el contenedor se pierde la copia local, pero el proyecto vivo sigue en Apps
Script. Mantener este respaldo permite recuperar el código sin depender solo
del proyecto en la nube.
