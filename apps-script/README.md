# Apps Script centralizado: cierres de caja

El código de Apps Script de las 5 hojas de cierre vive aquí. Cada cambio en
`apps-script/src/` que llega a `main` se sube automáticamente a las 5 hojas.

| Hoja     | Spreadsheet |
|----------|-------------|
| AZUL     | [abrir](https://docs.google.com/spreadsheets/d/1qeMCdfZEW5F8lBxC2rwQ6fh8Zk61QM7wGDB2nOrpieg/edit) |
| ROSADO   | [abrir](https://docs.google.com/spreadsheets/d/1mu5ozBGH8WNW3gMO2kYlib0FUpQ-xvzhpjXc245CXrc/edit) |
| AMARILLO | [abrir](https://docs.google.com/spreadsheets/d/1u4uq9rnL44zWI1WX_sMr0u3vMTdyjAb6yIccZLkX3t0/edit) |
| VERDE    | [abrir](https://docs.google.com/spreadsheets/d/1NYM-U1TfzOF1zYMVw3z-VJC_eKeapa1RUz0M4qJ4KmQ/edit) |
| NARANJA  | [abrir](https://docs.google.com/spreadsheets/d/12rjhJNkPEHFQ6K732Zs_dojOqxrRXvb0TgdvqjkRzzg/edit) |

## Estructura

- `src/`: el código único (`.gs`, `.html`) y `appsscript.json`. Es lo que se sube a todas las hojas.
- `hojas.json`: nombre, ID de la hoja y **ID del script** de cada una.
- `importado/<HOJA>/`: copia del código que tiene hoy cada hoja (solo para comparar).
- `scripts/desplegar.sh` y `scripts/importar.sh`: los usa la GitHub Action.

Al desplegar se agrega un archivo `_hoja.gs` con la constante
`HOJA = { nombre, spreadsheetId }`, así el mismo código puede comportarse
distinto según la hoja si hace falta (`if (HOJA.nombre === 'AZUL') ...`).

> Importante: desplegar **reemplaza todo** el código del editor de Apps Script
> de cada hoja. Los cambios hechos a mano en el editor se pierden en el siguiente
> despliegue: edita siempre aquí.

## Configuración (una sola vez)

1. **Activar la API de Apps Script** en la cuenta dueña de las hojas:
   <https://script.google.com/home/usersettings> → "API de Google Apps Script" → Activada.
2. **ID de script de cada hoja**: en cada hoja, *Extensiones → Apps Script →
   ⚙️ Configuración del proyecto → ID de secuencia de comandos*. Pegarlo en
   `hojas.json` en lugar de `PEGAR_SCRIPT_ID_...`.
3. **Credencial para GitHub**: en una computadora con Node instalado:
   ```bash
   npm install -g @google/clasp@2.4.2
   clasp login            # iniciar sesión con yes.amazonas@gmail.com
   cat ~/.clasprc.json    # copiar todo el contenido
   ```
   En GitHub: *Settings → Secrets and variables → Actions → New repository secret*,
   nombre `CLASPRC_JSON`, valor = el contenido copiado.
4. **Traer el código actual**: en GitHub, *Actions → "Apps Script (5 hojas de cierre)"
   → Run workflow → accion: importar*. Esto guarda el código de cada hoja en
   `importado/` para compararlo.
5. **Unificar**: copiar la versión correcta (incluido `appsscript.json`) a `src/`.
   Desde ese momento, cada cambio en `src/` se replica a las 5 hojas.

## Desplegar a mano

*Actions → "Apps Script (5 hojas de cierre)" → Run workflow → accion: desplegar*.
Con el campo `hoja` (por ejemplo `AZUL`) se puede probar primero en una sola hoja.
