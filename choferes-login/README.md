# Sistema de Login / Choferes — PROYECTO DE PRUEBAS (cuerda separada)

> ⚠️ **Esto NO toca la app de producción.** Es un proyecto de Apps Script
> **nuevo**, con su **propia hoja** y su **propio deployment**. Los choferes
> siguen entregando con la app actual sin enterarse. Solo cuando esto esté
> probado al 100% migramos, uno por uno.

Replica el patrón probado en la app hermana (ventas): login por PIN, correo
autorizado + OTP, **vínculo de dispositivo**, y panel admin. El backend
original era Node/Express/SQLite; aquí está adaptado a Apps Script + Google
Sheets **manteniendo idéntica la lógica de seguridad**.

## Archivos

| Archivo | Qué es |
|---|---|
| `Codigo.gs` | Backend: gateway único, login, OTP, admin, enforcement de dispositivo |
| `Index.html` | Pantalla de acceso (3 modos: pin / correo / otp) + home de prueba |
| `Admin.html` | Panel admin (crear/editar/activar/reiniciar/borrar) |

## Montaje (una sola vez, ~10 min)

1. **Crea una hoja de cálculo nueva** en Google Sheets, ej. `CHOFERES - PRUEBAS`.
   (Va a ser la base de datos de pruebas; no reutilices ninguna de producción.)
2. Desde esa hoja: **Extensiones → Apps Script**. Se abre un proyecto nuevo,
   ya vinculado a esa hoja.
3. En el editor, crea los 3 archivos y pega el contenido:
   - `Codigo.gs` (borra el `Código.gs` de ejemplo y pega el nuestro)
   - Archivo → Nuevo → HTML → `Index` → pega `Index.html`
   - Archivo → Nuevo → HTML → `Admin` → pega `Admin.html`
4. **Configura la clave admin** (Configuración del proyecto ⚙ → Propiedades
   del script → Agregar propiedad):
   - `ADMIN_KEY` = una clave secreta tuya (ej. `yes-admin-2026`)
   - *(opcional)* `CHOFERES_HOJA_ID` = solo si quieres apuntar a otra hoja;
     si dejas el proyecto vinculado a la hoja del paso 1, no hace falta.
5. En el editor, **ejecuta una vez** la función `inicializarSistemaChoferes`
   (menú de funciones → Ejecutar). Autoriza los permisos que pida. Esto crea
   la pestaña `CHOFERES` con sus columnas.
6. **Deploy de pruebas:** Implementar → Nueva implementación → tipo
   **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario** (para que los choferes entren
     sin cuenta Google)
   - Copia la **URL /exec de PRUEBAS**.

## Cómo probar

> El chofer **nunca teclea un PIN ni una clave**. El acceso es uno solo:
> correo → código (una vez) → dentro para siempre en ese celular. El PIN que
> ves en el panel es interno/respaldo del admin; no se usa para entrar.

- **Panel admin:** abre `TU_URL_EXEC?page=admin`, ingresa tu `ADMIN_KEY`,
  crea un chofer con **tu** correo (así te llega el OTP a ti para probar).
- **Acceso del chofer (primera vez):** abre `TU_URL_EXEC` (sin `?page=admin`)
  → escribe ese correo → **Recibir mi código** → llega por Gmail → lo ingresas
  → entras. Si escribes un correo distinto al configurado, no entra.
- **Acceso siguiente:** vuelve a abrir la URL → **entra directo**, sin código.
- **Prueba de la invariante (lo importante):**
  1. Entra (correo+OTP) en un celular/navegador → queda atado.
  2. En el panel, pulsa **Reiniciar dispositivo** en ese chofer.
  3. En el celular viejo, la siguiente acción debe **expulsarlo de inmediato**
     (vuelve a la pantalla de correo con "sesión terminó"). Ese es el bloqueo
     "al primer descargar contenido".
  4. Para volver a entrar en un celular nuevo: correo+OTP otra vez (el reinicio
     lo dejó pendiente de verificar).

## Notas de seguridad (idénticas al prompt)

- **Enforcement global:** toda llamada entra por `api()`; el chequeo de
  dispositivo corre ahí, antes de despachar. No hay forma de "olvidarlo" en
  una acción porque hay **una sola puerta**.
- **Reiniciar dispositivo** borra `dispositivo_id` **y** `correo_verificado`
  + OTP: obliga a re-probar el correo antes de atar un celular nuevo.
- **Desactivar** libera el correo (para reasignarlo) y el próximo request del
  PIN ya lo rechaza.
- El **correo** es único: se valida en código + `LockService` (Sheets no
  tiene índice UNIQUE).
- El frontend se **autoexpulsa** ante cualquier respuesta `sesionInvalida`.

## Correo (OTP)

Usa `MailApp.sendEmail` desde la cuenta dueña del script (la que autorizó en
el paso 5). Cuota: ~100 correos/día en Gmail normal, 1500 en Workspace —
más que suficiente para unos choferes.

## Cuando esté probado (migración futura)

- Cablear las acciones reales del chofer (facturas, entregas, cierre) dentro
  de `_despacharProtegida()` — hoy solo hay `miPerfil` y `ping` de prueba.
- En `_adminEliminar`, contar historial real antes de borrar (hoy no aplica).
- Apuntar la PWA (GitHub Pages) a esta URL cuando reemplace a la de producción.
- Dar de alta a los 6 choferes reales, uno por uno, con calma.
