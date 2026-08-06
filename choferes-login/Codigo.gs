/**************************************************************************
 * SISTEMA DE LOGIN / CHOFERES  —  PROYECTO DE PRUEBAS (CUERDA SEPARADA)
 *
 * ⚠️ Esto NO es la app de producción. Es un proyecto de Apps Script NUEVO,
 * con su propia hoja de cálculo y su propio deployment. No comparte nada
 * con lo que los choferes usan hoy.
 *
 * Replica el patrón probado en la app hermana (ventas). El backend original
 * era Node/Express/SQLite; aquí se adapta a Apps Script + Google Sheets
 * MANTENIENDO IDÉNTICA la lógica de seguridad (ver "INVARIANTE" abajo).
 *
 * Equivalencias clave respecto al prompt original:
 *   - Tabla SQLite `choferes`      -> pestaña CHOFERES de una hoja
 *   - Headers x-device-id/x-token  -> parámetros del sobre { deviceId, sesionToken }
 *   - app.use(exigirMismoDispositivo) (middleware global) -> función api():
 *     UNA sola puerta de entrada que revalida el dispositivo en TODA request
 *     antes de despachar. No se puede "olvidar" en una ruta porque hay una
 *     sola ruta.
 *   - Resend/SendGrid              -> MailApp.sendEmail (nativo)
 *   - Panel /admin con ?clave=     -> doGet ?page=admin + gateway apiAdmin(clave)
 **************************************************************************/

// ============================================================
// CONFIGURACIÓN
// ============================================================
const PROPS = PropertiesService.getScriptProperties();

// La clave del panel admin y (opcionalmente) el ID de la hoja se guardan en
// Script Properties para no quemarlos en el código. Ver README para setearlos.
function CONFIG_() {
  return {
    ADMIN_KEY: PROPS.getProperty('ADMIN_KEY') || 'CAMBIA_ESTA_CLAVE',
    HOJA_ID:   PROPS.getProperty('CHOFERES_HOJA_ID') || '',      // vacío = usa la hoja contenedora
    OTP_MINUTOS: 10,
    REMITENTE_NOMBRE: 'Industria Alimenticia YES',
  };
}

const HOJA_NOMBRE = 'CHOFERES';

// Orden EXACTO de columnas en la hoja CHOFERES (1 = columna A).
const COLS = {
  id: 1,
  nombre: 2,
  token_acceso: 3,          // el "PIN" de 6 dígitos — es la sesión durable
  activo: 4,                // 1 / 0
  correo: 5,                // el ÚNICO correo autorizado (lo asigna el admin)
  correo_verificado: 6,     // 1 / 0
  cedula: 7,
  otp_codigo: 8,
  otp_expira_en: 9,         // ISO string
  dispositivo_id: 10,       // uuid de la instalación atada
  dispositivo_vinculado_en: 11,
  creado_en: 12,            // ISO string
  // --- campos propios del chofer ---
  placa: 13,
  vehiculo: 14,
  ruta_color: 15,
  notas: 16,
};
const TOTAL_COLS = 16;
const ENCABEZADOS = [
  'id', 'nombre', 'token_acceso', 'activo', 'correo', 'correo_verificado',
  'cedula', 'otp_codigo', 'otp_expira_en', 'dispositivo_id',
  'dispositivo_vinculado_en', 'creado_en', 'placa', 'vehiculo', 'ruta_color', 'notas'
];

// ============================================================
// SETUP — correr UNA vez desde el editor de Apps Script
// ============================================================

/**
 * Crea la pestaña CHOFERES con sus encabezados si no existe. Idempotente:
 * puedes correrla varias veces sin daño. Ejecuta esto una vez antes de probar.
 */
function inicializarSistemaChoferes() {
  const hoja = _hoja_(true);
  const primera = hoja.getRange(1, 1, 1, TOTAL_COLS).getValues()[0];
  if (String(primera[0]).trim().toLowerCase() !== 'id') {
    hoja.clear();
    hoja.getRange(1, 1, 1, TOTAL_COLS).setValues([ENCABEZADOS]).setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return 'Listo. Hoja "' + HOJA_NOMBRE + '" preparada con ' + TOTAL_COLS + ' columnas.';
}

/**
 * Utilidad de pruebas: crea un chofer de ejemplo y devuelve su PIN.
 * (En el uso normal esto lo hace el admin desde el panel.)
 */
function crearChoferDePrueba() {
  const r = _crearChofer({ nombre: 'CHOFER PRUEBA', cedula: '0000000000', correo: '' });
  return r;
}

// ============================================================
// CAPA DE DATOS (Sheets)
// ============================================================

function _hoja_(crearSiFalta) {
  const cfg = CONFIG_();
  const ss = cfg.HOJA_ID ? SpreadsheetApp.openById(cfg.HOJA_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No hay hoja de cálculo. Setea CHOFERES_HOJA_ID en Script Properties o vincula el proyecto a una hoja.');
  let hoja = ss.getSheetByName(HOJA_NOMBRE);
  if (!hoja && crearSiFalta) hoja = ss.insertSheet(HOJA_NOMBRE);
  if (!hoja) throw new Error('No existe la pestaña ' + HOJA_NOMBRE + '. Corre inicializarSistemaChoferes() primero.');
  return hoja;
}

// Convierte una fila (array) en objeto {campo: valor} + su número de fila real.
function _filaAObjeto(valores, filaReal) {
  const o = { _fila: filaReal };
  Object.keys(COLS).forEach(function (campo) { o[campo] = valores[COLS[campo] - 1]; });
  return o;
}

function _leerTodos() {
  const hoja = _hoja_(false);
  const ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  const valores = hoja.getRange(2, 1, ultima - 1, TOTAL_COLS).getValues();
  const out = [];
  for (let i = 0; i < valores.length; i++) {
    if (String(valores[i][COLS.id - 1]).trim() === '') continue; // fila vacía
    out.push(_filaAObjeto(valores[i], i + 2));
  }
  return out;
}

function _buscarPorToken(pin) {
  pin = String(pin || '').trim();
  if (!pin) return null;
  return _leerTodos().filter(function (c) { return String(c.token_acceso).trim() === pin; })[0] || null;
}

function _buscarPorId(id) {
  id = String(id || '').trim();
  return _leerTodos().filter(function (c) { return String(c.id).trim() === id; })[0] || null;
}

function _buscarPorCorreo(correo) {
  correo = _normCorreo(correo);
  if (!correo) return null;
  return _leerTodos().filter(function (c) { return _normCorreo(c.correo) === correo; })[0] || null;
}

function _normCorreo(c) { return String(c || '').trim().toLowerCase(); }

// Escribe uno o varios campos de una fila. campos = { nombreCampo: valor, ... }
function _escribir(filaReal, campos) {
  const hoja = _hoja_(false);
  Object.keys(campos).forEach(function (campo) {
    hoja.getRange(filaReal, COLS[campo]).setValue(campos[campo]);
  });
  SpreadsheetApp.flush();
}

function _generarPinUnico() {
  const usados = {};
  _leerTodos().forEach(function (c) { usados[String(c.token_acceso).trim()] = true; });
  for (let intento = 0; intento < 50; intento++) {
    const pin = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    if (!usados[pin]) return pin;
  }
  throw new Error('No se pudo generar un PIN único.');
}

function _proximoId() {
  const todos = _leerTodos();
  let max = 0;
  todos.forEach(function (c) { const n = parseInt(c.id, 10); if (n > max) max = n; });
  return max + 1;
}

function _ahoraISO() { return new Date().toISOString(); }

// ============================================================
// ALTA DE CHOFER (la usa el admin)
// ============================================================

function _crearChofer(datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const nombre = String(datos.nombre || '').trim();
    if (!nombre) return _r(400, { error: 'El nombre es obligatorio.' });

    const correo = _normCorreo(datos.correo);
    if (correo && _buscarPorCorreo(correo)) {
      return _r(409, { error: 'Ese correo ya está asignado a otro chofer.' });
    }

    const hoja = _hoja_(true);
    const id = _proximoId();
    const pin = _generarPinUnico();
    const fila = new Array(TOTAL_COLS).fill('');
    fila[COLS.id - 1] = id;
    fila[COLS.nombre - 1] = nombre;
    fila[COLS.token_acceso - 1] = pin;
    fila[COLS.activo - 1] = 1;
    fila[COLS.correo - 1] = correo;
    fila[COLS.correo_verificado - 1] = 0;
    fila[COLS.cedula - 1] = String(datos.cedula || '').trim();
    fila[COLS.creado_en - 1] = _ahoraISO();
    fila[COLS.placa - 1] = String(datos.placa || '').trim();
    fila[COLS.vehiculo - 1] = String(datos.vehiculo || '').trim();
    fila[COLS.ruta_color - 1] = String(datos.ruta_color || '').trim();
    hoja.appendRow(fila);
    SpreadsheetApp.flush();
    return _r(200, { id: id, nombre: nombre, pin: pin });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// AUTENTICACIÓN
// ============================================================

/**
 * POST /choferes/login  — Body: { pin }  Header: x-device-id
 * Lógica idéntica al prompt (pasos 1..5).
 */
function _login(pin, deviceId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    pin = String(pin || '').trim();
    deviceId = String(deviceId || '').trim();

    const chofer = _buscarPorToken(pin);
    if (!chofer) return _r(401, { error: 'PIN inválido' });                                   // 1
    if (Number(chofer.activo) !== 1) {                                                        // 2
      return _r(403, { error: 'Tu acceso fue desactivado. Contacta al administrador.' });
    }
    const tieneCorreo = _normCorreo(chofer.correo) !== '';
    if (tieneCorreo && Number(chofer.correo_verificado) !== 1) {                               // 3
      return _r(403, {
        error: 'Debes verificar tu correo antes de entrar',
        requiereVerificacion: true,
        correo: chofer.correo,
      });
    }
    // 4) VÍNCULO DE DISPOSITIVO — solo para choferes CON correo asignado.
    if (tieneCorreo) {
      const dispGuardado = String(chofer.dispositivo_id || '').trim();
      if (!dispGuardado) {
        _escribir(chofer._fila, {
          dispositivo_id: deviceId,
          dispositivo_vinculado_en: _ahoraISO(),
        });
      } else if (dispGuardado !== deviceId) {
        return _r(403, {
          error: 'Este PIN ya está vinculado a otro dispositivo. Pídele a tu administrador que lo reinicie.',
          dispositivoDistinto: true,
        });
      }
    }
    return _r(200, { id: chofer.id, nombre: chofer.nombre, pin: pin });                        // 5
  } finally {
    lock.releaseLock();
  }
}

/**
 * INVARIANTE DE SEGURIDAD — equivale a app.use(exigirMismoDispositivo).
 * Corre en la única puerta api() ANTES de despachar cualquier acción, sobre
 * el sesionToken (el PIN guardado que viaja en cada request). Devuelve un
 * objeto de error para cortar, o null para continuar.
 */
function _exigirMismoDispositivo(sesionToken, deviceId) {
  sesionToken = String(sesionToken || '').trim();
  if (!sesionToken) return null;                       // ruta sin sesión de chofer
  const chofer = _buscarPorToken(sesionToken);
  if (!chofer || Number(chofer.activo) !== 1) return null; // sin chofer activo, no hay qué comparar (lo rechaza _sesionValida)
  const disp = String(chofer.dispositivo_id || '').trim();
  if (!disp) return null;                               // sin vínculo, nada que comparar
  if (String(deviceId || '').trim() !== disp) {
    return _r(401, {
      sesionInvalida: true,
      dispositivoDistinto: true,
      error: 'Esta sesión ya no es válida en este dispositivo — el acceso se reinició desde otro celular.',
    });
  }
  return null;
}

/**
 * Valida una sesión de chofer para acciones protegidas.
 * Para un chofer CON correo (el caso real), una sesión válida EXIGE:
 *   - correo verificado (=1)  -> si el admin reinicia el dispositivo, esto
 *     queda en 0 y el celular viejo se bloquea EN SU PRÓXIMA petición
 *     (no hay que esperar a que otro celular se vincule).
 *   - un dispositivo atado que COINCIDA con el de esta request.
 */
function _sesionValida(sesionToken, deviceId) {
  const chofer = _buscarPorToken(sesionToken);
  if (!chofer || Number(chofer.activo) !== 1) return null;
  const tieneCorreo = _normCorreo(chofer.correo) !== '';
  if (tieneCorreo) {
    if (Number(chofer.correo_verificado) !== 1) return null;   // reiniciado/no verificado -> fuera
    const disp = String(chofer.dispositivo_id || '').trim();
    if (!disp) return null;                                     // sin vínculo -> no es sesión válida
    if (String(deviceId || '').trim() !== disp) return null;   // otro celular -> fuera
  }
  return chofer;
}

// ============================================================
// OTP (verificación de correo por código, vía MailApp)
// ============================================================

function _solicitarOtp(params) {
  const correo = _normCorreo(params && params.correo);
  if (!correo) return _r(400, { error: 'Falta el correo.' });
  const chofer = _buscarPorCorreo(correo);
  if (!chofer || Number(chofer.activo) !== 1) {
    return _r(404, { error: 'Ese correo no está autorizado para ningún chofer' });
  }
  if (Number(chofer.correo_verificado) === 1) {
    // Ya está verificado y atado a un celular. El chofer no teclea códigos ni
    // PIN: entra solo. Si cambió de celular, el admin debe reiniciar su
    // dispositivo (eso vuelve a habilitar este flujo de correo+OTP).
    return _r(400, {
      yaVerificado: true,
      error: 'Tu acceso ya está activo en tu celular. Si cambiaste de teléfono, pídele a tu administrador que reinicie tu dispositivo.',
    });
  }
  const codigo = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  const expira = new Date(Date.now() + CONFIG_().OTP_MINUTOS * 60000).toISOString();
  _escribir(chofer._fila, { otp_codigo: codigo, otp_expira_en: expira });
  _enviarCorreoOtp(chofer.correo, codigo, chofer.nombre);
  return _r(200, { ok: true, mensaje: 'Código enviado' });
}

function _verificarOtp(params) {
  const correo = _normCorreo(params && params.correo);
  const codigo = String((params && params.codigo) || '').trim();
  if (!correo || !codigo) return _r(400, { error: 'Faltan datos.' });
  const chofer = _buscarPorCorreo(correo);
  if (!chofer || Number(chofer.activo) !== 1) return _r(404, { error: 'Correo no autorizado' });

  const guardado = String(chofer.otp_codigo || '').trim();
  const expira = chofer.otp_expira_en ? new Date(chofer.otp_expira_en).getTime() : 0;
  if (!guardado || guardado !== codigo) return _r(400, { error: 'Código incorrecto' });
  if (!expira || Date.now() > expira) return _r(400, { error: 'El código expiró, pide uno nuevo' });

  _escribir(chofer._fila, { correo_verificado: 1, otp_codigo: '', otp_expira_en: '' });
  // El frontend DEBE llamar de inmediato a login con este pin para completar
  // el vínculo de dispositivo (el vínculo SOLO ocurre en /login).
  return _r(200, { id: chofer.id, nombre: chofer.nombre, pin: chofer.token_acceso });
}

function _enviarCorreoOtp(correo, codigo, nombre) {
  const asunto = 'Tu código de acceso — ' + CONFIG_().REMITENTE_NOMBRE;
  const cuerpo =
    'Hola ' + (nombre || '') + ',\n\n' +
    'Tu código de verificación es: ' + codigo + '\n' +
    'Vence en ' + CONFIG_().OTP_MINUTOS + ' minutos.\n\n' +
    'Si no solicitaste este código, ignora este mensaje.';
  MailApp.sendEmail({ to: correo, subject: asunto, body: cuerpo, name: CONFIG_().REMITENTE_NOMBRE });
}

// ============================================================
// ADMIN (todas las acciones exigen la clave admin)
// ============================================================

function _adminOk(clave) { return String(clave || '') === String(CONFIG_().ADMIN_KEY); }

function _adminListado() {
  return _leerTodos().map(function (c) {
    return {
      id: c.id, nombre: c.nombre, cedula: c.cedula, correo: c.correo,
      correoVerificado: Number(c.correo_verificado) === 1,
      activo: Number(c.activo) === 1,
      dispositivoId: c.dispositivo_id, dispositivoVinculadoEn: c.dispositivo_vinculado_en,
      creadoEn: c.creado_en, placa: c.placa, vehiculo: c.vehiculo, rutaColor: c.ruta_color,
    };
  });
}

function _adminActualizar(id, cambios) {
  const chofer = _buscarPorId(id);
  if (!chofer) return _r(404, { error: 'Chofer no encontrado.' });
  const set = {};
  if (cambios.nombre !== undefined) set.nombre = String(cambios.nombre).trim();
  if (cambios.cedula !== undefined) set.cedula = String(cambios.cedula).trim();
  if (cambios.placa !== undefined) set.placa = String(cambios.placa).trim();
  if (cambios.vehiculo !== undefined) set.vehiculo = String(cambios.vehiculo).trim();
  if (cambios.ruta_color !== undefined) set.ruta_color = String(cambios.ruta_color).trim();
  if (cambios.correo !== undefined) {
    const nuevo = _normCorreo(cambios.correo);
    if (nuevo && _normCorreo(chofer.correo) !== nuevo) {
      const dueno = _buscarPorCorreo(nuevo);
      if (dueno && String(dueno.id) !== String(id)) return _r(409, { error: 'Ese correo ya está asignado a otro chofer.' });
    }
    set.correo = nuevo;
    // El correo nuevo todavía no probó ser suyo.
    set.correo_verificado = 0;
    set.otp_codigo = '';
    set.otp_expira_en = '';
  }
  _escribir(chofer._fila, set);
  return _r(200, { ok: true });
}

function _adminEstado(id, activo) {
  const chofer = _buscarPorId(id);
  if (!chofer) return _r(404, { error: 'Chofer no encontrado.' });
  const set = { activo: activo ? 1 : 0 };
  if (!activo) {
    // Al DESACTIVAR se libera el correo para poder reasignarlo de inmediato.
    set.correo = '';
    set.correo_verificado = 0;
    set.otp_codigo = '';
    set.otp_expira_en = '';
  }
  _escribir(chofer._fila, set);
  return _r(200, { ok: true });
}

/**
 * INVARIANTE (segunda mitad): reiniciar dispositivo NO puede limitarse a
 * borrar dispositivo_id. También borra correo_verificado/otp para forzar a
 * pasar de nuevo por el OTP (probar que controla el correo) antes de atar un
 * celular nuevo.
 */
function _adminReiniciarDispositivo(id) {
  const chofer = _buscarPorId(id);
  if (!chofer) return _r(404, { error: 'Chofer no encontrado.' });
  _escribir(chofer._fila, {
    dispositivo_id: '', dispositivo_vinculado_en: '',
    correo_verificado: 0, otp_codigo: '', otp_expira_en: '',
  });
  return _r(200, { ok: true });
}

function _adminVerificarCorreoManual(id) {
  const chofer = _buscarPorId(id);
  if (!chofer) return _r(404, { error: 'Chofer no encontrado.' });
  if (_normCorreo(chofer.correo) === '') return _r(400, { error: 'Este chofer no tiene correo asignado.' });
  _escribir(chofer._fila, { correo_verificado: 1, otp_codigo: '', otp_expira_en: '' });
  return _r(200, { ok: true });
}

function _adminEliminar(id) {
  const chofer = _buscarPorId(id);
  if (!chofer) return _r(404, { error: 'Chofer no encontrado.' });
  // TODO al integrar con producción: contar historial real (entregas,
  // ubicaciones, cierres) por chofer y responder 409 si existe. En el
  // proyecto de pruebas no hay historial atado todavía.
  const hoja = _hoja_(false);
  hoja.deleteRow(chofer._fila);
  SpreadsheetApp.flush();
  return _r(200, { ok: true });
}

// ============================================================
// GATEWAY — la ÚNICA puerta de entrada (equivale al middleware global)
// ============================================================

/**
 * Toda llamada del cliente entra por aquí.
 * sobre = { accion, deviceId, sesionToken, pin, params }
 *  - sesionToken: el PIN guardado que viaja en CADA request autenticada
 *  - pin: solo en 'login' (el PIN que se intenta)
 */
function api(sobre) {
  sobre = sobre || {};
  const accion = String(sobre.accion || '');
  const deviceId = String(sobre.deviceId || '').trim();
  const sesionToken = String(sobre.sesionToken || '').trim();

  // ENFORCEMENT GLOBAL: si trae sesión de chofer, revalida el dispositivo
  // SIEMPRE, pase lo que pase después.
  if (sesionToken) {
    const corte = _exigirMismoDispositivo(sesionToken, deviceId);
    if (corte) return corte;
  }

  switch (accion) {
    // --- públicas (no requieren sesión previa) ---
    case 'login':        return _login(sobre.pin, deviceId);
    case 'solicitarOtp': return _solicitarOtp(sobre.params);
    case 'verificarOtp': return _verificarOtp(sobre.params);

    // --- protegidas (requieren sesión de chofer válida) ---
    default: {
      const sesion = _sesionValida(sesionToken, deviceId);
      if (!sesion) return _r(401, { sesionInvalida: true, error: 'Sesión inválida. Vuelve a iniciar sesión.' });
      return _despacharProtegida(accion, sesion, sobre.params || {});
    }
  }
}

// Acciones que requieren estar logueado. Aquí, en producción, irían las
// funciones reales del chofer (facturas, entregas, cierre...). Por ahora una
// de prueba para verificar el enforcement.
function _despacharProtegida(accion, sesion, params) {
  switch (accion) {
    case 'miPerfil':
      return _r(200, {
        id: sesion.id, nombre: sesion.nombre, correo: sesion.correo,
        rutaColor: sesion.ruta_color, placa: sesion.placa,
      });
    case 'ping':
      return _r(200, { ok: true, cuando: _ahoraISO() });
    default:
      return _r(404, { error: 'Acción desconocida: ' + accion });
  }
}

/** Gateway del panel admin. Cada acción exige la clave admin. */
function apiAdmin(sobre) {
  sobre = sobre || {};
  if (!_adminOk(sobre.clave)) {
    return _r(401, { error: 'Clave incorrecta o faltante.' });
  }
  const p = sobre.params || {};
  switch (String(sobre.accion || '')) {
    case 'listado':               return _r(200, { choferes: _adminListado() });
    case 'crear':                 return _crearChofer(p);
    case 'actualizar':            return _adminActualizar(p.id, p);
    case 'estado':                return _adminEstado(p.id, !!p.activo);
    case 'reiniciarDispositivo':  return _adminReiniciarDispositivo(p.id);
    case 'verificarCorreoManual': return _adminVerificarCorreoManual(p.id);
    case 'eliminar':              return _adminEliminar(p.id);
    default:                      return _r(404, { error: 'Acción admin desconocida.' });
  }
}

// ============================================================
// doGet — sirve la pantalla de login o el panel admin
// ============================================================

function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  const archivo = (page === 'admin') ? 'Admin' : 'Index';
  return HtmlService.createHtmlOutputFromFile(archivo)
    .setTitle('Choferes — ' + (page === 'admin' ? 'Panel' : 'Acceso'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
}

// ============================================================
// Helper de respuesta tipo HTTP (google.script.run no da status codes)
// ============================================================
function _r(estado, obj) {
  obj = obj || {};
  obj.estado = estado;
  obj.ok = obj.ok !== undefined ? obj.ok : (estado >= 200 && estado < 300 && !obj.error);
  return obj;
}
