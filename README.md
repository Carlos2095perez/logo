# logo

Repositorio para la Web App de Google Apps Script de **Industria Alimenticia YES**.

- **Web App (deploy actual):** https://script.google.com/macros/s/AKfycbwzzzdQkFLbJo1CCOno6jipsNXh_wOs6W2KFhCvLIMBv7TqisWUAKWmazEqKJBtudc/exec
- **Editor del proyecto:** https://script.google.com/u/0/home/projects/1z880zkVZbX2G4-pviQ46BqHj7VUkwDzMz_9ELBzbLSP58nZIqaSbejQ4/edit

Este script está **vinculado a un archivo contenedor** (Hoja de cálculo, Documento o
Formulario), por lo que su código no vive como un archivo independiente en Drive.
Para traer el código real a este repositorio se usa
[`clasp`](https://github.com/google/clasp), la CLI oficial de Google para Apps Script.

## Requisitos

- Node.js instalado
- Una cuenta de Google con acceso al proyecto de Apps Script

## Primer uso

```bash
npm install

# Inicia sesión con tu cuenta de Google (abre el navegador)
npm run login

# Descarga el código fuente real del proyecto (Code.gs, HTML, appsscript.json)
# hacia la carpeta src/
npm run pull
```

Después de `npm run pull`, la carpeta `src/` tendrá los archivos reales del proyecto.
Revísalos, haz commit y push a este repositorio.

## Flujo de trabajo

```bash
npm run pull    # trae los cambios hechos desde el editor de script.google.com
npm run push    # sube tus cambios locales al proyecto de Apps Script
npm run open    # abre el proyecto en el editor de Apps Script
npm run deploy  # crea una nueva versión de despliegue
```

## Notas

- El `scriptId` del proyecto ya está configurado en `.clasp.json`.
- `.clasprc.json` (credenciales de tu sesión de `clasp login`) nunca se sube al
  repositorio (ver `.gitignore`).
- Como el script está vinculado a un contenedor, `clasp push`/`clasp deploy`
  seguirán operando sobre ese mismo documento — no crean un proyecto nuevo.
