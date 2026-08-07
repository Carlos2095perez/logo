# Notas para Claude — proyecto CIERRE RUTA CHOFERES

## ⭐ RUNBOOK: cargar ubicaciones desde archivos KML/KMZ

**Cuando el usuario envíe archivos `.kml` / `.kmz` con ubicaciones de clientes,
haz TODO esto tú mismo y entrégale UN link listo. NO le pidas que pegue código
ni que despliegue — eso lo haces tú por `clasp`.** (Así se hizo siempre; el
usuario lo pidió explícitamente.)

### Contexto del proyecto Apps Script (producción)
- Código local + clasp: **`/workspace/cierre_ruta_choferes`**
- `scriptId`: `1Hs5Ne5iiLy15QFCwCh0jGYz7lmBjmrSsq3x5fEcIQj8GT5PUtl9GOE0g`
- Credenciales clasp: `~/.clasprc.json` (ya autenticado)
- **Deployment de PRODUCCIÓN** (el `/exec` que usan los choferes y la PWA):
  `AKfycbzNNsRS5dbZYWDEbzzsleO0Z9CPiYmedMTWjivhebEBmHWMs5aEZYex4A9vhsa8-aOvng`
- Hay otro deployment `@HEAD` aparte; **NO** es el de producción.
- El seed vive en `_SeedUbicaciones.js` (`TOKEN_ADMIN_SEED` + `UBICACIONES_SEED`).
- `doGet` tiene el endpoint `?admin_seed=<token>` → llama `agregarUbicaciones`,
  que **fusiona por nombre** (actualiza existentes, agrega nuevos) y **rechaza
  nombres > 120 caracteres**. Coordenadas en la app: **lat, lng**.

### Pasos exactos
1. Genera el seed con el script reutilizable (parsea kml/kmz, dedup por nombre,
   token nuevo aleatorio):
   ```bash
   python3 /home/user/logo/scripts/seed_ubicaciones_from_kml.py \
     "<carpeta_de_los_uploads>" /workspace/cierre_ruta_choferes/_SeedUbicaciones.js
   ```
   Anota el **TOKEN NUEVO** que imprime.
2. **Seguridad (no pisar producción):** sincroniza y verifica que SOLO cambie
   el seed:
   ```bash
   cd /workspace/cierre_ruta_choferes
   cp "Código.js" Index.html /tmp/bak_/    # respaldo
   clasp pull                               # trae lo vivo
   diff /tmp/bak_/Código.js Código.js       # debe ser IGUAL
   diff /tmp/bak_/Index.html Index.html     # debe ser IGUAL
   # (si cambiaron, investiga antes de seguir; re-escribe el seed tras el pull)
   ```
   Nota: `clasp pull` sobrescribe el seed con el vivo; vuelve a correr el paso 1
   DESPUÉS del pull para dejar el seed nuevo.
3. Publica en el **mismo** deployment de producción (mismo link):
   ```bash
   clasp push -f
   clasp deploy -i AKfycbzNNsRS5dbZYWDEbzzsleO0Z9CPiYmedMTWjivhebEBmHWMs5aEZYex4A9vhsa8-aOvng -d "seed NNN ubicaciones"
   ```
4. Entrégale al usuario el link listo (con el token nuevo):
   ```
   https://script.google.com/macros/s/AKfycbzNNsRS5dbZYWDEbzzsleO0Z9CPiYmedMTWjivhebEBmHWMs5aEZYex4A9vhsa8-aOvng/exec?admin_seed=<TOKEN_NUEVO>
   ```
   Le da `{ ok:true, agregadas, actualizadas, rechazadas }`. Si sale
   "token invalido", es propagación: esperar ~30 s y recargar.

### Notas
- El proxy de este entorno **bloquea `curl` a `script.google.com`** (403), así
  que no puedes disparar el link tú; el usuario lo abre una vez.
- El orden en el seed no importa (fusiona por nombre). Un token nuevo por lote
  sirve para confirmar que el link corre la versión recién desplegada.

---

## Otros trabajos en curso (cuerda separada)

- **`choferes-login/`** — sistema de login nuevo "Chóferes INDUYES" (proyecto de
  Apps Script SEPARADO, aún en pruebas). Login por correo + OTP, sin PIN
  tecleado, con vínculo de dispositivo y panel admin. **No tocar producción.**
- **`docs/`** — cascarón PWA (GitHub Pages) para instalar la app en el celular.

## Regla general
- **Nunca** modificar ni desplegar el código de producción salvo la carga de
  ubicaciones descrita arriba (que el usuario ya aprobó como rutina).
