# Cierre Ruta — PWA (envoltura)

Cascarón PWA que hace **instalable** la app de cierre de ruta (que vive en
Google Apps Script) y la abre a **pantalla completa** como app nativa.

- `index.html` — pantalla de carga + iframe a pantalla completa de la app real.
- `manifest.webmanifest` — nombre, íconos, color, modo standalone.
- `service-worker.js` — cachea el cascarón (ícono abre al instante).
- `icons/` — íconos generados desde el logo de la empresa.

## Cómo activarla (GitHub Pages)

1. En el repo → **Settings → Pages**.
2. En **Build and deployment → Source**: *Deploy from a branch*.
3. Branch: elegir la rama y carpeta **`/docs`** → **Save**.
4. En 1-2 min queda en `https://<usuario>.github.io/logo/`.

## Instalar en el celular

- **Android/Chrome:** abrir el link → botón **Instalar app** (o menú ⋮ →
  *Instalar aplicación / Agregar a pantalla de inicio*).
- **iPhone/Safari:** abrir el link → **Compartir** → *Añadir a inicio*.

La app queda con su ícono en el celular y abre sin barra del navegador.

## Backend

La app real sigue en Apps Script (deployment estable). Este cascarón solo la
embebe; no cambia nada de la lógica actual.
