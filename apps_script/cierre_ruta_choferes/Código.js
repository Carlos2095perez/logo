// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================

const CONFIG = {
  hojaIngresos: '1Rpk2graTB6YBXMRXcWmQA2B3v1cpjwlOsjnbgW_-sRU',
  hojas: {
    'ROSADO':   '1mu5ozBGH8WNW3gMO2kYlib0FUpQ-xvzhpjXc245CXrc',
    'AZUL':     '1qeMCdfZEW5F8lBxC2rwQ6fh8Zk61QM7wGDB2nOrpieg',
    'AMARILLO': '1u4uq9rnL44zWI1WX_sMr0u3vMTdyjAb6yIccZLkX3t0',
    'VERDE':    '1NYM-U1TfzOF1zYMVw3z-VJC_eKeapa1RUz0M4qJ4KmQ',
    'NARANJA':  '12rjhJNkPEHFQ6K732Zs_dojOqxrRXvb0TgdvqjkRzzg',
    'BLANCO':   '1M8uJVb3OtfpNbPpzNBZRXeWHzEV3bICi4jVD2vb-LZU'
  },
  rutas: {
    'ROSADO':   'QUITO NORTE',
    'AZUL':     'QUITO NORTE',
    'VERDE':    'QUITO SUR',
    'AMARILLO': 'QUITO SUR',
    'NARANJA':  'QUITO VALLES',
    'BLANCO':   'QUITO VALLES'
  },
  parejasRutas: {
    'ROSADO':   'AZUL',
    'AZUL':     'ROSADO',
    'VERDE':    'AMARILLO',
    'AMARILLO': 'VERDE',
    'NARANJA':  'BLANCO',
    'BLANCO':   'NARANJA'
  },
  usuarios: {
    'CL359': 'CRISTIAN LOZA',
    'JR298': 'JOSSUE REGALADO',
    'DA375': 'DAVID AÑARUMBA',
    'NI195': 'NELSON INGA',
    'MC392': 'MARVIN CASTILLO',
    'CP156': 'CARLOS PEREZ'
  },
  correoDestino: 'bodega.yes@gmail.com',
  duracionSesionSegundos: 21600, // 6 horas (máximo permitido por CacheService)
  bodega: { lat: -0.271474, lng: -78.535354 },

  // ⚠️ ACTUALIZA ESTAS DOS URLs con los deployments reales
  urlRetiro: 'https://script.google.com/macros/s/AKfycbx139hASyFxkPUHINo0qicmaI7e-PJ4KDgk_l8-CyOEi72swfcBkbWJ_ImJQ53Dck7LCg/exec',
  urlRuta:   'https://script.google.com/macros/s/AKfycbx2g7umucn7QiWq-KsyIwV6T2hqlc9j97wiy6A17Dg8aVzdoLY0eS-uWj6-by2oJfbM/exec'
};

// ============================================
// doGet — sirve el Index.html unificado
// ============================================

function doGet(e) {
  // Endpoint TEMPORAL de administración (carga por única vez un lote de
  // ubicaciones, fusiona por nombre). Protegido por token. Se retira luego.
  if (e && e.parameter && e.parameter.admin_seed) {
    var salida = { ok: false };
    try {
      if (typeof TOKEN_ADMIN_SEED === 'undefined' || e.parameter.admin_seed !== TOKEN_ADMIN_SEED) {
        salida = { ok: false, error: 'token invalido' };
      } else {
        var r = _Datos.agregarUbicaciones(UBICACIONES_SEED);
        salida = { ok: true, agregadas: r.agregadas, actualizadas: r.actualizadas, rechazadas: r.rechazadas, total_en_hoja: _Datos.cargarUbicaciones().length };
      }
    } catch (err) { salida = { ok: false, error: String(err && err.message || err) }; }
    return ContentService.createTextOutput(JSON.stringify(salida, null, 2)).setMimeType(ContentService.MimeType.JSON);
  }
  // Acción TEMPORAL de volcado: descarga la lista completa de UBICACIONES
  // como CSV (solo lectura de la hoja, sin tocar Drive) para auditarla.
  if (e && e.parameter && e.parameter.admin_dump) {
    if (typeof TOKEN_ADMIN_SEED === 'undefined' || e.parameter.admin_dump !== TOKEN_ADMIN_SEED) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'token invalido' })).setMimeType(ContentService.MimeType.JSON);
    }
    var ubic = _Datos.cargarUbicaciones();
    var csv = 'Cliente,Lat,Lng\n';
    ubic.forEach(function(u){ csv += '"' + String(u.cliente).replace(/"/g, '""') + '",' + u.lat + ',' + u.lng + '\n'; });
    return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV).downloadAsFile('ubicaciones_' + ubic.length + '.csv');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('INDUSTRIA ALIMENTICIA YES')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl('https://raw.githubusercontent.com/Carlos2095perez/logo/main/logo%20yes%20png.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
}

// ============================================
// getNavUrls — devuelve URLs de Ruta y Retiro
// (Cierre está embebido, no necesita URL)
// ============================================

function getNavUrls() {
  return {
    ruta:   CONFIG.urlRuta,
    retiro: CONFIG.urlRetiro
  };
}

// ============================================
// NORMALIZACIÓN DE NÚMEROS
// ============================================

function normalizarNumero(valor) {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  let v = String(valor).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (v.includes('.') && v.includes(',')) {
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (v.includes(',')) {
    v = v.replace(',', '.');
  } else if (v.includes('.')) {
    const p = v.split('.');
    if (!(p.length === 2 && p[1].length === 2)) v = v.replace(/\./g, '');
  }
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// ============================================
// AUTENTICACIÓN Y SESIÓN
//
// iniciarSesion es el único punto de entrada público que entrega un
// token. Toda función que lee o modifica datos exige ese token y lo
// valida en el servidor (validarSesion) antes de hacer nada — así el
// control de acceso ya no depende de la interfaz, sino del backend.
// ============================================

function obtenerRutaPorColor(color) {
  return CONFIG.rutas[color] || 'RUTA DESCONOCIDA';
}

const LOGIN_MAX_INTENTOS = 5;
const LOGIN_VENTANA_SEGUNDOS = 300;  // 5 minutos para acumular intentos fallidos
const LOGIN_BLOQUEO_SEGUNDOS = 300;  // 5 minutos de bloqueo tras exceder el máximo

function iniciarSesion(clave, dispositivoId) {
  const cache = CacheService.getScriptCache();
  if (cache.get('login_bloqueo')) {
    throw new Error('Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.');
  }

  const nombre = CONFIG.usuarios[String(clave || '').toUpperCase().trim()];
  if (!nombre) {
    const fallos = parseInt(cache.get('login_fallos') || '0', 10) + 1;
    if (fallos >= LOGIN_MAX_INTENTOS) {
      cache.put('login_bloqueo', '1', LOGIN_BLOQUEO_SEGUNDOS);
      cache.remove('login_fallos');
    } else {
      cache.put('login_fallos', String(fallos), LOGIN_VENTANA_SEGUNDOS);
    }
    return null;
  }

  cache.remove('login_fallos');
  const token = Utilities.getUuid();
  const dispositivo = String(dispositivoId || 'DESCONOCIDO').slice(0, 40);
  cache.put(
    'sesion_v2_' + token,
    JSON.stringify({ nombre: nombre, dispositivo: dispositivo, creado: Date.now() }),
    CONFIG.duracionSesionSegundos
  );
  // El dispositivo queda registrado en cada acción de este login (ver
  // _registrarAuditoria), así se puede ver si de repente una clave
  // empieza a entrar desde un dispositivo distinto al habitual.
  _registrarAuditoria('LOGIN', { nombre: nombre, dispositivo: dispositivo }, { clave: clave });
  return { token: token, nombre: nombre };
}

function validarSesion(token) {
  const raw = token && CacheService.getScriptCache().get('sesion_v2_' + token);
  if (!raw) throw new Error('Sesión inválida o expirada. Vuelve a ingresar tu clave.');
  return JSON.parse(raw);
}

// ============================================
// HOJA AUXILIAR — LOG_AUDITORIA y UBICACIONES viven en un archivo
// aparte (creado automáticamente la primera vez y recordado en
// PropertiesService), no en las hojas de facturación. La hoja
// principal (hojaIngresos) ya está en el límite de 10M celdas de
// Google Sheets, así que no se le puede seguir agregando contenido.
// ============================================

// ID FIJO de la hoja auxiliar que contiene TODAS las ubicaciones del
// KML (más de 100) además del LOG_AUDITORIA y el HISTORIAL_DESPACHO.
// Se fija aquí a propósito: el 22/07/2026 el PropertiesService quedó
// apuntando a una hoja nueva vacía y TODOS los clientes salieron "sin
// ubicación". Prefiriendo este ID conocido, la app nunca vuelve a
// perder las ubicaciones creando una hoja vacía en silencio.
const HOJA_AUXILIAR_ID_FIJO = '1PgLzXq2h4J01NXZWeNHVveougLo8CN0W5EAGMk8Vtfs';

function _obtenerHojaAuxiliar() {
  const props = PropertiesService.getScriptProperties();
  // 1) Preferir SIEMPRE la hoja fija conocida (la que tiene las ubicaciones).
  try {
    const ss = SpreadsheetApp.openById(HOJA_AUXILIAR_ID_FIJO);
    if (props.getProperty('HOJA_AUXILIAR_ID') !== HOJA_AUXILIAR_ID_FIJO) {
      props.setProperty('HOJA_AUXILIAR_ID', HOJA_AUXILIAR_ID_FIJO); // auto-sana la propiedad
    }
    return ss;
  } catch (e) { /* si por permisos no se puede abrir, cae al respaldo */ }
  // 2) Respaldo: el ID que esté guardado en propiedades.
  const id = props.getProperty('HOJA_AUXILIAR_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* ya no existe, se crea abajo */ }
  }
  // 3) Último recurso (no debería ocurrir): crear una nueva.
  const ss = SpreadsheetApp.create('CIERRE RUTA CHOFERES - Auditoría y Ubicaciones');
  props.setProperty('HOJA_AUXILIAR_ID', ss.getId());
  return ss;
}

function _obtenerCarpetaIncidencias() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_INCIDENCIAS_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* ya no existe, se crea una nueva abajo */ }
  }
  const folder = DriveApp.createFolder('CIERRE RUTA CHOFERES - Incidencias de Entrega');
  props.setProperty('CARPETA_INCIDENCIAS_ID', folder.getId());
  return folder;
}

// EJECUTAR UNA SOLA VEZ desde el editor de Apps Script (botón ▶ Ejecutar)
// para conceder los permisos de Drive y Hojas. Google pedirá autorización;
// tras aceptarla, las FOTOS de incidencias se guardarán correctamente.
function _autorizarTodo() {
  DriveApp.getRootFolder();                 // fuerza el permiso de Drive
  _obtenerCarpetaIncidencias();             // crea la carpeta de incidencias
  _obtenerHojaAuxiliar();                   // asegura la hoja auxiliar
  return 'Permisos concedidos (Drive + Hojas). Las fotos ya funcionan.';
}

// ============================================
// AUDITORÍA — registra quién hizo qué y cuándo en una hoja aparte.
// Nunca debe tumbar la operación principal si falla, por eso va en su
// propio try/catch.
// ============================================

function _registrarAuditoria(accion, sesion, detalle) {
  try {
    const ss = _obtenerHojaAuxiliar();
    let sheet = ss.getSheetByName('LOG_AUDITORIA');
    if (!sheet) {
      sheet = ss.insertSheet('LOG_AUDITORIA');
      sheet.appendRow(['Fecha', 'Usuario', 'Acción', 'Detalle', 'Dispositivo']);
    }
    const fecha = Utilities.formatDate(new Date(), 'America/Guayaquil', 'dd/MM/yyyy HH:mm:ss');
    sheet.appendRow([fecha, sesion.nombre, accion, JSON.stringify(detalle), sesion.dispositivo || '']);
  } catch (e) {
    console.error('Error registrando auditoría: ' + e.message);
  }
}

// ============================================
// DESPACHO — helpers de ubicación
// (funciones puras, sin acceso a datos sensibles, es inofensivo que
// alguien las llame directamente desde la consola)
// ============================================

function _normalizarNombreCliente(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Devuelve TODOS los candidatos posibles para un nombre de cliente
// (no solo el primero) — un mismo nombre puede tener varias
// sucursales con coordenadas distintas, y quien llama decide cómo
// desempatar (ver cargarDespacho, que usa cercanía a la ruta).
//
// Deliberadamente NO hay coincidencia "aproximada" por palabras
// sueltas: mandar a un chofer a la dirección equivocada es peor que
// no mostrarle ninguna. Solo se acepta una coincidencia exacta, que
// un nombre esté completamente contenido en el otro, o que compartan
// el mismo nombre comercial (la parte antes del guion) y esa parte
// esté concentrada en un solo punto del mapa — así se resuelve el
// caso real de "ALTA PEZCA -EDY PINTA" vs "ALTA PEZCA - VICENTE
// JIMENEZ": mismo negocio, el contacto cambió entre fuentes. Un
// nombre comercial genérico (p. ej. "TIENDA SN", que en los datos
// reales aparece repartido en más de 30 km) nunca pasa este filtro
// porque sus apariciones están dispersas, no concentradas.
const LARGO_MINIMO_CONTENCION = 8;
const DISPERSION_MAXIMA_MISMO_NEGOCIO_KM = 0.4;

function _prefijoNombreComercial(cliente) {
  return _normalizarNombreCliente(String(cliente || '').split(/[-–—]/)[0]);
}

// Artículos/preposiciones que no distinguen a un negocio. Se ignoran al
// comparar para que "LOS ENCEBOLLADOS DE SAN LUIS" case con "ENCEBOLLADOS
// SAN LUIS". No es coincidencia difusa: el resto de las palabras deben
// seguir coincidiendo en orden (por igualdad o contención).
const _ARTICULOS = { 'LOS': 1, 'LAS': 1, 'EL': 1, 'LA': 1, 'DE': 1, 'DEL': 1, 'Y': 1, 'DE LA': 1 };
function _canonSinArticulos(norm) {
  return String(norm || '').split(' ').filter(w => w && !_ARTICULOS[w]).join(' ');
}

function _matchUbicacion(clienteFactura, ubicaciones) {
  const norm = _normalizarNombreCliente(clienteFactura);
  if (!norm) return [];

  let candidatos = ubicaciones.filter(u => u._norm === norm);
  if (candidatos.length) return candidatos;

  if (norm.length >= LARGO_MINIMO_CONTENCION) {
    candidatos = ubicaciones.filter(u =>
      u._norm.length >= LARGO_MINIMO_CONTENCION &&
      (u._norm.indexOf(norm) !== -1 || norm.indexOf(u._norm) !== -1)
    );
    if (candidatos.length) return candidatos;
  }

  // Igual que arriba pero ignorando artículos/preposiciones (LOS, DE, LA…).
  const canon = _canonSinArticulos(norm);
  if (canon.length >= LARGO_MINIMO_CONTENCION) {
    candidatos = ubicaciones.filter(u => {
      const uc = _canonSinArticulos(u._norm);
      return uc.length >= LARGO_MINIMO_CONTENCION &&
        (uc === canon || uc.indexOf(canon) !== -1 || canon.indexOf(uc) !== -1);
    });
    if (candidatos.length) return candidatos;
  }

  const prefijo = _prefijoNombreComercial(clienteFactura);
  if (prefijo.length >= LARGO_MINIMO_CONTENCION) {
    const mismoNegocio = ubicaciones.filter(u => _prefijoNombreComercial(u.cliente) === prefijo);
    if (mismoNegocio.length) {
      const disperso = mismoNegocio.some((a, i) =>
        mismoNegocio.slice(i + 1).some(b =>
          _distanciaKm(a.lat, a.lng, b.lat, b.lng) > DISPERSION_MAXIMA_MISMO_NEGOCIO_KM
        )
      );
      if (!disperso) return mismoNegocio;
    }
  }

  return [];
}

function _distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _ordenarPorCercania(origen, paradas) {
  const restantes = paradas.slice();
  const ordenadas = [];
  let actual = origen;
  while (restantes.length) {
    let idx = 0, mejorDist = Infinity;
    restantes.forEach((p, i) => {
      const d = _distanciaKm(actual.lat, actual.lng, p.lat, p.lng);
      if (d < mejorDist) { mejorDist = d; idx = i; }
    });
    const siguiente = restantes.splice(idx, 1)[0];
    siguiente.distanciaKm = mejorDist;
    ordenadas.push(siguiente);
    actual = siguiente;
  }
  return ordenadas;
}

// ============================================
// LÓGICA INTERNA (no expuesta a google.script.run)
//
// Solo las funciones declaradas arriba en el nivel superior del
// archivo son invocables desde el navegador. Al vivir como métodos de
// este objeto, _Datos queda fuera de ese mecanismo: aunque alguien
// abra la consola y tenga el link, no puede llamarlas directamente ni
// saltarse la validación de sesión que hacen las funciones públicas.
// ============================================

const _Datos = {
  cargarFacturas: function(color) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO');
      if (!sheet) throw new Error('No se encontró la hoja INGRESO DIARIO');
      const data = sheet.getRange(6, 2, 100, 13).getValues();
      const facturas = [];
      for (let i = 0; i < data.length; i++) {
        const cliente = data[i][0], factura = data[i][1], valor = data[i][2];
        const estado = data[i][6], abono = data[i][11];
        if (cliente && factura) {
          facturas.push({
            fila: i + 6,
            cliente: String(cliente),
            factura: String(factura),
            valor: normalizarNumero(valor),
            estadoPago: estado ? String(estado).trim() : '',
            valorTransferencia: normalizarNumero(abono)
          });
        }
      }
      return facturas;
    } catch (e) { throw new Error('Error al cargar facturas: ' + e.message); }
  },

  cargarFacturasConBloqueos: function(color) {
    try {
      const pareja = CONFIG.parejasRutas[color];
      const propias = this.cargarFacturas(color);
      const dePareja = this.cargarFacturas(pareja);
      const bloqueadas = new Map();
      dePareja.forEach(f => { if (f.estadoPago) bloqueadas.set(f.factura, { estadoPago: f.estadoPago, color: pareja }); });
      propias.forEach(f => {
        const b = bloqueadas.get(f.factura);
        if (b && !f.estadoPago) { f.bloqueada = true; f.bloqueadaPor = b.color; f.estadoBloqueado = b.estadoPago; }
        else f.bloqueada = false;
      });
      return propias;
    } catch (e) { throw new Error('Error al cargar facturas con bloqueos: ' + e.message); }
  },

  actualizarSoloEstado: function(color, fila, estadoPago) {
    try {
      SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO').getRange(fila, 8).setValue(estadoPago);
      SpreadsheetApp.flush();
      return { success: true };
    } catch (e) { throw new Error('Error al actualizar estado: ' + e.message); }
  },

  actualizarSoloAbono: function(color, fila, valorTransferencia) {
    try {
      SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO').getRange(fila, 13).setValue(parseFloat(valorTransferencia) || 0);
      SpreadsheetApp.flush();
      return { success: true };
    } catch (e) { throw new Error('Error al actualizar abono: ' + e.message); }
  },

  actualizarEstadoFactura: function(color, fila, estadoPago, valorTransferencia) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO');
      if (estadoPago) sheet.getRange(fila, 8).setValue(estadoPago);
      if (valorTransferencia !== null && valorTransferencia !== undefined) sheet.getRange(fila, 13).setValue(valorTransferencia);
      SpreadsheetApp.flush();
      return { success: true };
    } catch (e) { throw new Error('Error al actualizar factura: ' + e.message); }
  },

  cargarEgresos: function(color) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO');
      const data = sheet.getRange(110, 2, 15, 10).getValues();
      const egresos = [];
      for (let i = 0; i < data.length; i++) {
        const ref = data[i][0], desc = data[i][1], monto = data[i][8];
        if (desc || monto) egresos.push({ fila: i + 110, facturaRef: ref || '', descripcion: desc || '', monto: normalizarNumero(monto) });
      }
      return egresos;
    } catch (e) { throw new Error('Error al cargar egresos: ' + e.message); }
  },

  registrarEgreso: function(color, facturaRef, descripcion, monto) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO');
      const data = sheet.getRange(110, 2, 15, 1).getValues();
      let filaVacia = -1;
      for (let i = 0; i < data.length; i++) {
        if (!data[i][0] && !sheet.getRange(110 + i, 3).getValue()) { filaVacia = 110 + i; break; }
      }
      if (filaVacia === -1) throw new Error('No hay espacio para más egresos');
      sheet.getRange(filaVacia, 2).setValue(facturaRef);
      sheet.getRange(filaVacia, 3).setValue(descripcion);
      sheet.getRange(filaVacia, 10).setValue(parseFloat(monto));
      SpreadsheetApp.flush();
      return { success: true, fila: filaVacia };
    } catch (e) { throw new Error('Error al registrar egreso: ' + e.message); }
  },

  cargarCobrosRuta: function(ruta) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojaIngresos).getSheetByName('INGRESO DIARIO COBROS');
      if (!sheet) throw new Error('No se encontró INGRESO DIARIO COBROS');
      const data = sheet.getRange(8, 2, 200, 8).getValues();
      const cobros = [];
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] && data[i][1] && data[i][5] === ruta) {
          cobros.push({ fila: i + 8, cliente: data[i][0], factura: data[i][1], valor: normalizarNumero(data[i][2]), ruta: data[i][5] });
        }
      }
      return cobros;
    } catch (e) { throw new Error('Error al cargar cobros: ' + e.message); }
  },

  registrarCobroRuta: function(fila, valorCobrado, formaPago, responsable, detallesPago) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojaIngresos).getSheetByName('INGRESO DIARIO COBROS');
      sheet.getRange(fila, 4).setValue(valorCobrado === 'NO COBRADO' ? 'NO COBRADO' : parseFloat(valorCobrado));
      let fp = formaPago;
      if (detallesPago) {
        if (formaPago === 'CHEQUE')        fp = 'CHEQUE ' + detallesPago.banco + ' #' + detallesPago.numero;
        if (formaPago === 'TRANSFERENCIA') fp = 'TRANSFERENCIA ' + detallesPago.banco + ' #' + detallesPago.comprobante;
      }
      sheet.getRange(fila, 8).setValue(fp);
      sheet.getRange(fila, 9).setValue(responsable);
      SpreadsheetApp.flush();
      return { success: true };
    } catch (e) { throw new Error('Error al registrar cobro: ' + e.message); }
  },

  validarCierreCruzado: function(color) {
    try {
      const pareja = CONFIG.parejasRutas[color];
      const fActual = this.cargarFacturas(color);
      const fPareja = this.cargarFacturas(pareja);
      const registradas = new Map();
      const duplicadas = [], sinRegistrar = [];
      fActual.forEach(f => {
        if (f.estadoPago) {
          if (registradas.has(f.factura)) duplicadas.push({ factura: f.factura, cliente: f.cliente, registradoEn: [registradas.get(f.factura), color] });
          else registradas.set(f.factura, color);
        }
      });
      fPareja.forEach(f => {
        if (f.estadoPago) {
          if (registradas.has(f.factura)) duplicadas.push({ factura: f.factura, cliente: f.cliente, registradoEn: [registradas.get(f.factura), pareja] });
          else registradas.set(f.factura, pareja);
        }
      });
      const todas = new Map();
      fActual.forEach(f => todas.set(f.factura, { cliente: f.cliente, factura: f.factura }));
      fPareja.forEach(f => { if (!todas.has(f.factura)) todas.set(f.factura, { cliente: f.cliente, factura: f.factura }); });
      todas.forEach((info, num) => { if (!registradas.has(num)) sinRegistrar.push(info); });
      return {
        valido: duplicadas.length === 0 && sinRegistrar.length === 0,
        duplicadas, sinRegistrar,
        totalRegistradas: registradas.size,
        totalFacturas: todas.size
      };
    } catch (e) { throw new Error('Error al validar cierre cruzado: ' + e.message); }
  },

  calcularResumenCierre: function(color, ruta) {
    try {
      const sheet = SpreadsheetApp.openById(CONFIG.hojas[color]).getSheetByName('INGRESO DIARIO');
      let fEntregadas = 0, fCredito = 0, montoEntregadas = 0, montoAbonos = 0;
      const data = sheet.getRange(6, 2, 100, 13).getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] && data[i][6]) {
          if (data[i][6] === 'PP') { fEntregadas++; montoEntregadas += normalizarNumero(data[i][2]); }
          if (data[i][6] === 'CC') fCredito++;
          if (data[i][11]) montoAbonos += normalizarNumero(data[i][11]);
        }
      }
      const egrData = sheet.getRange(110, 10, 15, 1).getValues();
      let totalEgresos = 0;
      egrData.forEach(r => { if (r[0]) totalEgresos += normalizarNumero(r[0]); });
      const sheetCob = SpreadsheetApp.openById(CONFIG.hojaIngresos).getSheetByName('INGRESO DIARIO COBROS');
      const dataCob = sheetCob.getRange(8, 2, 200, 8).getValues();
      let montoCobros = 0;
      dataCob.forEach(r => {
        if (r[5] === ruta && r[7] === color && r[2] && r[2] !== 'NO COBRADO') {
          if (r[6] && !r[6].includes('TRANSFERENCIA')) montoCobros += normalizarNumero(r[2]);
        }
      });
      const total = (montoEntregadas + montoAbonos + montoCobros) - totalEgresos;
      return {
        facturasEntregadas: fEntregadas, facturasCredito: fCredito,
        montoFacturasEntregadas: montoEntregadas.toFixed(2),
        montoAbonos: montoAbonos.toFixed(2),
        montoCobrosRuta: montoCobros.toFixed(2),
        totalEgresos: totalEgresos.toFixed(2),
        totalGlobal: total.toFixed(2)
      };
    } catch (e) { throw new Error('Error al calcular resumen: ' + e.message); }
  },

  cargarUbicaciones: function() {
    const ss = _obtenerHojaAuxiliar();
    const sheet = ss.getSheetByName('UBICACIONES');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const out = [];
    for (let i = 1; i < data.length; i++) {
      const cliente = data[i][0], lat = data[i][1], lng = data[i][2];
      if (cliente && lat !== '' && lng !== '') {
        out.push({ cliente: String(cliente), lat: parseFloat(lat), lng: parseFloat(lng), _norm: _normalizarNombreCliente(cliente) });
      }
    }
    return out;
  },

  agregarUbicaciones: function(datos) {
    const ss = _obtenerHojaAuxiliar();
    let sheet = ss.getSheetByName('UBICACIONES');
    if (!sheet) {
      sheet = ss.insertSheet('UBICACIONES');
      sheet.appendRow(['Cliente', 'Lat', 'Lng']);
    }
    const existentes = this.cargarUbicaciones();
    const filaPorNorm = {};
    existentes.forEach((u, i) => { filaPorNorm[u._norm] = i + 2; }); // +2: encabezado + índice base 1

    let agregadas = 0, actualizadas = 0, rechazadas = 0;
    datos.forEach(d => {
      const norm = _normalizarNombreCliente(d.cliente);
      const lat = parseFloat(d.lat), lng = parseFloat(d.lng);
      // Un nombre de negocio real no debería pasar de ~120 caracteres;
      // algo más largo suele ser texto pegado por error (captura de
      // pantalla completa, etc.) que rompería el emparejamiento por
      // substring con cualquier factura cuyo nombre quede contenido ahí.
      if (!norm || isNaN(lat) || isNaN(lng) || String(d.cliente).length > 120) { rechazadas++; return; }
      if (filaPorNorm[norm]) {
        sheet.getRange(filaPorNorm[norm], 2, 1, 2).setValues([[lat, lng]]);
        actualizadas++;
      } else {
        sheet.appendRow([d.cliente, lat, lng]);
        agregadas++;
      }
    });
    return { success: true, agregadas: agregadas, actualizadas: actualizadas, rechazadas: rechazadas };
  },

  limpiarUbicacionesInvalidas: function() {
    const ss = _obtenerHojaAuxiliar();
    const sheet = ss.getSheetByName('UBICACIONES');
    if (!sheet) return { eliminadas: 0 };
    const data = sheet.getDataRange().getValues();
    let eliminadas = 0;
    // de abajo hacia arriba para que borrar una fila no corra los índices
    // de las filas que faltan por revisar
    for (let i = data.length - 1; i >= 1; i--) {
      const cliente = data[i][0];
      if (!cliente || String(cliente).length > 120) {
        sheet.deleteRow(i + 1);
        eliminadas++;
      }
    }
    return { eliminadas: eliminadas };
  },

  cargarDespacho: function(color) {
    const facturas = this.cargarFacturasConBloqueos(color);
    const pendientes = facturas.filter(f => !f.estadoPago);
    const ubicaciones = this.cargarUbicaciones();

    const conCandidatos = [], sinUbicacion = [];
    pendientes.forEach(f => {
      const candidatos = _matchUbicacion(f.cliente, ubicaciones);
      if (candidatos.length) conCandidatos.push({ factura: f, candidatos: candidatos });
      else sinUbicacion.push({ fila: f.fila, cliente: f.cliente, factura: f.factura, valor: f.valor });
    });

    // Centro de gravedad de las facturas que matchearon sin ambigüedad,
    // para elegir la sucursal correcta cuando un cliente tiene varias
    // ubicaciones registradas (p. ej. cadenas con más de un punto).
    const inequivocas = conCandidatos.filter(c => c.candidatos.length === 1);
    let centro = CONFIG.bodega;
    if (inequivocas.length) {
      let sLat = 0, sLng = 0;
      inequivocas.forEach(c => { sLat += c.candidatos[0].lat; sLng += c.candidatos[0].lng; });
      centro = { lat: sLat / inequivocas.length, lng: sLng / inequivocas.length };
    }

    const conUbicacion = conCandidatos.map(c => {
      let mejor = c.candidatos[0];
      if (c.candidatos.length > 1) {
        let mejorDist = Infinity;
        c.candidatos.forEach(u => {
          const d = _distanciaKm(centro.lat, centro.lng, u.lat, u.lng);
          if (d < mejorDist) { mejorDist = d; mejor = u; }
        });
      }
      return { fila: c.factura.fila, cliente: c.factura.cliente, factura: c.factura.factura, valor: c.factura.valor, lat: mejor.lat, lng: mejor.lng };
    });

    const ordenBase = _ordenarPorCercania(CONFIG.bodega, conUbicacion);

    // Las paradas reagendadas o con una incidencia registrada hoy (local
    // cerrado, cambio de número) se mandan al final de la ruta en vez de
    // mantener su orden por cercanía — el chofer las retoma al terminar
    // las demás, tal como pide "reagendar visita al final".
    const estadoPorFila = this.obtenerEntregasHoy(color);
    ordenBase.forEach(p => {
      const estado = estadoPorFila[p.fila];
      p.entregado = estado === 'ENTREGADO';
      p.pospuesto = estado === 'REAGENDADO' || (!!estado && estado.indexOf('INCIDENCIA') === 0);
    });
    const paradas = ordenBase.filter(p => !p.pospuesto).concat(ordenBase.filter(p => p.pospuesto));
    paradas.forEach((p, i) => { p.orden = i + 1; });

    sinUbicacion.forEach(p => { p.entregado = estadoPorFila[p.fila] === 'ENTREGADO'; });

    return { bodega: CONFIG.bodega, paradas: paradas, sinUbicacion: sinUbicacion };
  },

  // Devuelve un objeto {fila: estado} con el último estado registrado hoy
  // en el historial, para ese color (permite corregir por error: el
  // último estado por fila es el que vale). Estados posibles: ENTREGADO,
  // PENDIENTE, REAGENDADO, o "INCIDENCIA: <motivo>".
  obtenerEntregasHoy: function(color) {
    const ss = _obtenerHojaAuxiliar();
    const sheet = ss.getSheetByName('HISTORIAL_DESPACHO');
    if (!sheet || sheet.getLastRow() < 2) return {};
    const hoy = Utilities.formatDate(new Date(), 'America/Guayaquil', 'dd/MM/yyyy');
    const data = sheet.getDataRange().getValues();
    const estadoPorFila = {};
    for (let i = 1; i < data.length; i++) {
      const [fechaCelda, , , colorFila, , , , fila, estado] = data[i];
      // Google Sheets a veces auto-detecta el texto de fecha que escribimos
      // y lo convierte en un valor Date real de la celda; al releerlo con
      // getValues() ya no es el mismo string que "hoy", así que la
      // comparación fallaba silenciosamente y el despacho parecía
      // "borrarse" al recargar la página aunque el historial seguía
      // intacto en la hoja. Se normaliza a texto antes de comparar.
      const fechaTxt = (fechaCelda instanceof Date)
        ? Utilities.formatDate(fechaCelda, 'America/Guayaquil', 'dd/MM/yyyy')
        : String(fechaCelda);
      if (fechaTxt === hoy && colorFila === color) estadoPorFila[fila] = estado;
    }
    return estadoPorFila;
  },

  registrarEntrega: function(color, ruta, fila, cliente, factura, entregado, responsable) {
    const ss = _obtenerHojaAuxiliar();
    let sheet = ss.getSheetByName('HISTORIAL_DESPACHO');
    if (!sheet) {
      sheet = ss.insertSheet('HISTORIAL_DESPACHO');
      sheet.appendRow(['Fecha', 'Hora', 'Responsable', 'Color', 'Ruta', 'Cliente', 'Factura', 'Fila', 'Estado', 'Foto']);
    }
    const ahora = new Date();
    sheet.appendRow([
      Utilities.formatDate(ahora, 'America/Guayaquil', 'dd/MM/yyyy'),
      Utilities.formatDate(ahora, 'America/Guayaquil', 'HH:mm:ss'),
      responsable, color, ruta, cliente, factura, fila,
      entregado ? 'ENTREGADO' : 'PENDIENTE'
    ]);
    return { success: true };
  },

  reagendarVisita: function(color, ruta, fila, cliente, factura, responsable) {
    const ss = _obtenerHojaAuxiliar();
    let sheet = ss.getSheetByName('HISTORIAL_DESPACHO');
    if (!sheet) {
      sheet = ss.insertSheet('HISTORIAL_DESPACHO');
      sheet.appendRow(['Fecha', 'Hora', 'Responsable', 'Color', 'Ruta', 'Cliente', 'Factura', 'Fila', 'Estado', 'Foto']);
    }
    const ahora = new Date();
    sheet.appendRow([
      Utilities.formatDate(ahora, 'America/Guayaquil', 'dd/MM/yyyy'),
      Utilities.formatDate(ahora, 'America/Guayaquil', 'HH:mm:ss'),
      responsable, color, ruta, cliente, factura, fila, 'REAGENDADO', ''
    ]);
    return { success: true };
  },

  registrarIncidencia: function(color, ruta, fila, cliente, factura, motivo, fotoBase64, responsable) {
    const ss = _obtenerHojaAuxiliar();
    let sheet = ss.getSheetByName('HISTORIAL_DESPACHO');
    if (!sheet) {
      sheet = ss.insertSheet('HISTORIAL_DESPACHO');
      sheet.appendRow(['Fecha', 'Hora', 'Responsable', 'Color', 'Ruta', 'Cliente', 'Factura', 'Fila', 'Estado', 'Foto']);
    }
    const ahora = new Date();
    const fechaTxt = Utilities.formatDate(ahora, 'America/Guayaquil', 'dd/MM/yyyy');
    const horaTxt = Utilities.formatDate(ahora, 'America/Guayaquil', 'HH:mm:ss');

    let urlFoto = '';
    let fotoError = '';
    if (fotoBase64) {
      // La foto va a Drive. Si el permiso de Drive aún no está autorizado,
      // NO se cae toda la incidencia: se registra igual sin la foto y se
      // avisa. (Para habilitar fotos, correr _autorizarTodo una vez.)
      try {
        const carpetaBase = _obtenerCarpetaIncidencias();
        const nombreSubcarpeta = fechaTxt.replace(/\//g, '-');
        const it = carpetaBase.getFoldersByName(nombreSubcarpeta);
        const carpetaDia = it.hasNext() ? it.next() : carpetaBase.createFolder(nombreSubcarpeta);
        const partes = String(fotoBase64).split(',');
        const blob = Utilities.newBlob(
          Utilities.base64Decode(partes.length > 1 ? partes[1] : partes[0]),
          'image/jpeg',
          'Incidencia_' + color + '_fila' + fila + '_' + horaTxt.replace(/:/g, '-') + '.jpg'
        );
        const archivo = carpetaDia.createFile(blob);
        urlFoto = archivo.getUrl();
      } catch (e) {
        fotoError = String(e && e.message || e);
      }
    }

    sheet.appendRow([fechaTxt, horaTxt, responsable, color, ruta, cliente, factura, fila, 'INCIDENCIA: ' + motivo, urlFoto || (fotoError ? 'SIN FOTO (permiso Drive pendiente)' : '')]);
    return { success: true, url: urlFoto, fotoError: fotoError };
  },

  finalizarCierre: function(color, ruta, usuario, resumen, denominaciones, firmaBase64) {
    try {
      const fecha = new Date();
      const fechaTexto = Utilities.formatDate(fecha, 'America/Guayaquil', 'dd/MM/yyyy HH:mm:ss');
      let tablaDenom = '', totalDenom = 0;
      Object.entries(denominaciones).forEach(([d, cant]) => {
        if (cant > 0) {
          const val = parseFloat(d.replace('_', '.')), sub = val * cant;
          totalDenom += sub;
          tablaDenom += '<tr><td style="padding:8px;border:1px solid #ddd;">$' + d.replace('_', '.') + '</td>' +
            '<td style="padding:8px;border:1px solid #ddd;text-align:center;">' + cant + '</td>' +
            '<td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;">$' + sub.toFixed(2) + '</td></tr>';
        }
      });
      const html =
        '<html><body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">' +
        '<div style="max-width:650px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;">' +
        '<div style="background:#2c3e50;color:white;padding:30px;text-align:center;">' +
        '<h1 style="margin:0;font-size:24px;">INDUSTRIA ALIMENTICIA YES</h1>' +
        '<p style="margin:8px 0 0;opacity:0.9;">Reporte de Cierre de Ruta</p></div>' +
        '<div style="padding:30px;">' +
        '<div style="background:#ecf0f1;padding:20px;border-radius:8px;border-left:4px solid #3498db;margin-bottom:20px;">' +
        '<p style="margin:6px 0;"><strong>Fecha:</strong> ' + fechaTexto + '</p>' +
        '<p style="margin:6px 0;"><strong>Ruta:</strong> ' + ruta + '</p>' +
        '<p style="margin:6px 0;"><strong>Color:</strong> ' + color + '</p>' +
        '<p style="margin:6px 0;"><strong>Responsable:</strong> ' + usuario + '</p></div>' +
        '<h3 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:8px;">Resumen Financiero</h3>' +
        '<table style="width:100%;border-collapse:collapse;margin:10px 0;">' +
        '<tr><td style="padding:10px;border:1px solid #eee;">Facturas PP</td><td style="padding:10px;border:1px solid #eee;">' + resumen.facturasEntregadas + '</td><td style="padding:10px;border:1px solid #eee;color:#27ae60;font-weight:bold;">$' + resumen.montoFacturasEntregadas + '</td></tr>' +
        '<tr><td style="padding:10px;border:1px solid #eee;">Facturas CC</td><td style="padding:10px;border:1px solid #eee;">' + resumen.facturasCredito + '</td><td style="padding:10px;border:1px solid #eee;">-</td></tr>' +
        '<tr><td style="padding:10px;border:1px solid #eee;">Abonos</td><td style="padding:10px;border:1px solid #eee;">-</td><td style="padding:10px;border:1px solid #eee;color:#3498db;font-weight:bold;">$' + resumen.montoAbonos + '</td></tr>' +
        '<tr><td style="padding:10px;border:1px solid #eee;">Cobros Ruta</td><td style="padding:10px;border:1px solid #eee;">-</td><td style="padding:10px;border:1px solid #eee;color:#f39c12;font-weight:bold;">$' + resumen.montoCobrosRuta + '</td></tr>' +
        '<tr><td style="padding:10px;border:1px solid #eee;">Egresos</td><td style="padding:10px;border:1px solid #eee;">-</td><td style="padding:10px;border:1px solid #eee;color:#e74c3c;font-weight:bold;">-$' + resumen.totalEgresos + '</td></tr>' +
        '<tr style="background:#d5f4e6;"><td colspan="2" style="padding:12px;font-weight:bold;color:#27ae60;">TOTAL A ENTREGAR</td>' +
        '<td style="padding:12px;font-weight:bold;color:#27ae60;">$' + resumen.totalGlobal + '</td></tr></table>' +
        '<h3 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:8px;margin-top:24px;">Denominaciones</h3>' +
        '<table style="width:100%;border-collapse:collapse;margin:10px 0;">' +
        '<thead><tr style="background:#3498db;color:white;">' +
        '<th style="padding:10px;text-align:left;">Denominacion</th>' +
        '<th style="padding:10px;">Cantidad</th>' +
        '<th style="padding:10px;text-align:right;">Subtotal</th></tr></thead>' +
        '<tbody>' + tablaDenom +
        '<tr style="background:#d5f4e6;"><td colspan="2" style="padding:12px;font-weight:bold;color:#27ae60;">TOTAL CONTADO</td>' +
        '<td style="padding:12px;font-weight:bold;color:#27ae60;text-align:right;">$' + totalDenom.toFixed(2) + '</td></tr>' +
        '</tbody></table></div>' +
        '<div style="background:#34495e;color:white;padding:20px;text-align:center;font-size:12px;">' +
        '<p><strong>INDUSTRIA ALIMENTICIA YES</strong></p>' +
        '<p>Sistema de Cierre de Ruta Automatizado</p></div></div></body></html>';

      const firmaBlob = Utilities.newBlob(
        Utilities.base64Decode(firmaBase64.split(',')[1]),
        'image/png',
        'Firma_' + color + '_' + fechaTexto.replace(/[\/:\s]/g, '_') + '.png'
      );
      MailApp.sendEmail({
        to: CONFIG.correoDestino,
        subject: 'CIERRE DE RUTA - ' + ruta + ' - ' + color + ' - ' + fechaTexto,
        htmlBody: html,
        attachments: [firmaBlob]
      });
      return { success: true, mensaje: 'Cierre finalizado exitosamente' };
    } catch (e) { throw new Error('Error al finalizar cierre: ' + e.message); }
  }
};

// ============================================
// FACTURAS CON VALIDACIÓN CRUZADA (públicas, exigen token)
// ============================================

function cargarFacturas(token, color) {
  validarSesion(token);
  return _Datos.cargarFacturas(color);
}

function cargarFacturasConBloqueos(token, color) {
  validarSesion(token);
  return _Datos.cargarFacturasConBloqueos(color);
}

function actualizarSoloEstado(token, color, fila, estadoPago) {
  const sesion = validarSesion(token);
  const r = _Datos.actualizarSoloEstado(color, fila, estadoPago);
  _registrarAuditoria('ESTADO_FACTURA', sesion, { color, fila, estadoPago });
  return r;
}

function actualizarSoloAbono(token, color, fila, valorTransferencia) {
  const sesion = validarSesion(token);
  const r = _Datos.actualizarSoloAbono(color, fila, valorTransferencia);
  _registrarAuditoria('ABONO_FACTURA', sesion, { color, fila, valorTransferencia });
  return r;
}

function actualizarEstadoFactura(token, color, fila, estadoPago, valorTransferencia) {
  const sesion = validarSesion(token);
  const r = _Datos.actualizarEstadoFactura(color, fila, estadoPago, valorTransferencia);
  _registrarAuditoria('ESTADO_Y_ABONO_FACTURA', sesion, { color, fila, estadoPago, valorTransferencia });
  return r;
}

// ============================================
// EGRESOS (públicas, exigen token)
// ============================================

function cargarEgresos(token, color) {
  validarSesion(token);
  return _Datos.cargarEgresos(color);
}

function registrarEgreso(token, color, facturaRef, descripcion, monto) {
  const sesion = validarSesion(token);
  const r = _Datos.registrarEgreso(color, facturaRef, descripcion, monto);
  _registrarAuditoria('EGRESO', sesion, { color, facturaRef, descripcion, monto });
  return r;
}

// ============================================
// COBROS DE RUTA (públicas, exigen token)
// ============================================

function cargarCobrosRuta(token, ruta) {
  validarSesion(token);
  return _Datos.cargarCobrosRuta(ruta);
}

function registrarCobroRuta(token, fila, valorCobrado, formaPago, responsable, detallesPago) {
  const sesion = validarSesion(token);
  const r = _Datos.registrarCobroRuta(fila, valorCobrado, formaPago, responsable, detallesPago);
  _registrarAuditoria('COBRO_RUTA', sesion, { fila, valorCobrado, formaPago, responsable });
  return r;
}

// ============================================
// VALIDACIÓN Y CIERRE (públicas, exigen token)
// ============================================

function validarCierreCruzado(token, color) {
  validarSesion(token);
  return _Datos.validarCierreCruzado(color);
}

function calcularResumenCierre(token, color, ruta) {
  validarSesion(token);
  return _Datos.calcularResumenCierre(color, ruta);
}

function finalizarCierre(token, color, ruta, usuario, resumen, denominaciones, firmaBase64) {
  // El nombre del responsable se toma de la sesión validada en el
  // servidor, no del parámetro que manda el cliente, para que el
  // reporte no se pueda firmar a nombre de otro chofer.
  const sesion = validarSesion(token);
  const cache = CacheService.getScriptCache();
  const cierreKey = 'cierre_hecho_' + token;
  if (cache.get(cierreKey)) {
    throw new Error('Esta sesión ya registró un cierre. Si necesitas otro, vuelve a ingresar tu clave.');
  }
  const r = _Datos.finalizarCierre(color, ruta, sesion.nombre, resumen, denominaciones, firmaBase64);
  cache.put(cierreKey, '1', CONFIG.duracionSesionSegundos);
  _registrarAuditoria('CIERRE_RUTA', sesion, { color, ruta, totalGlobal: resumen && resumen.totalGlobal });
  return r;
}

// ============================================
// DESPACHO (públicas, exigen token)
// ============================================

function cargarDespacho(token, color) {
  validarSesion(token);
  return _Datos.cargarDespacho(color);
}

function registrarEntrega(token, color, ruta, fila, cliente, factura, entregado) {
  const sesion = validarSesion(token);
  return _Datos.registrarEntrega(color, ruta, fila, cliente, factura, entregado, sesion.nombre);
}

function reagendarVisita(token, color, ruta, fila, cliente, factura) {
  const sesion = validarSesion(token);
  const r = _Datos.reagendarVisita(color, ruta, fila, cliente, factura, sesion.nombre);
  _registrarAuditoria('REAGENDAR_VISITA', sesion, { color, fila, cliente });
  return r;
}

function registrarIncidencia(token, color, ruta, fila, cliente, factura, motivo, fotoBase64) {
  const sesion = validarSesion(token);
  const r = _Datos.registrarIncidencia(color, ruta, fila, cliente, factura, motivo, fotoBase64, sesion.nombre);
  _registrarAuditoria('INCIDENCIA_ENTREGA', sesion, { color, fila, cliente, motivo });
  return r;
}

function agregarUbicaciones(token, datosJSON) {
  const sesion = validarSesion(token);
  const datos = typeof datosJSON === 'string' ? JSON.parse(datosJSON) : datosJSON;
  const r = _Datos.agregarUbicaciones(datos);
  _registrarAuditoria('UBICACIONES_ACTUALIZADAS', sesion, { agregadas: r.agregadas, actualizadas: r.actualizadas });
  return r;
}

function contarUbicaciones(token) {
  validarSesion(token);
  const ubicaciones = _Datos.cargarUbicaciones();
  return { total: ubicaciones.length, nombres: ubicaciones.map(u => u.cliente) };
}

function limpiarUbicacionesInvalidas(token) {
  const sesion = validarSesion(token);
  const r = _Datos.limpiarUbicacionesInvalidas();
  _registrarAuditoria('LIMPIEZA_UBICACIONES', sesion, r);
  return r;
}

function _reinicializarLogAuditoria() {
  try {
    const ss = _obtenerHojaAuxiliar();
    let sheet = ss.getSheetByName('LOG_AUDITORIA');
    if (sheet) {
      ss.deleteSheet(sheet);
    }
    sheet = ss.insertSheet('LOG_AUDITORIA');
    sheet.appendRow(['Fecha', 'Usuario', 'Acción', 'Detalle', 'Dispositivo']);
    Logger.log('Log de auditoría reinicializado correctamente');
    return { éxito: true, mensaje: 'Log limpiado y reinicializado' };
  } catch (e) {
    Logger.log('Error reinicializando log: ' + e.message);
    return { éxito: false, error: e.message };
  }
}

// Diagnóstico del estado de la hoja auxiliar y las ubicaciones.
// Se ejecuta manualmente (clasp run o desde el editor) para ver si
// las ubicaciones siguen guardadas o si la hoja auxiliar se desconectó.
function _diagnosticoUbicaciones() {
  const props = PropertiesService.getScriptProperties();
  const idGuardado = props.getProperty('HOJA_AUXILIAR_ID');
  const out = {
    HOJA_AUXILIAR_ID_guardado: idGuardado || '(vacío)',
    auxiliar: null,
    ubicaciones: null,
    otrasHojasEnDrive: [],
  };
  try {
    const ss = _obtenerHojaAuxiliar();
    out.auxiliar = { nombre: ss.getName(), id: ss.getId(), url: ss.getUrl() };
    const sheet = ss.getSheetByName('UBICACIONES');
    if (!sheet) {
      out.ubicaciones = { existe: false, filas: 0 };
    } else {
      out.ubicaciones = { existe: true, filas: Math.max(0, sheet.getLastRow() - 1) };
    }
  } catch (e) {
    out.auxiliar = { error: e.message };
  }
  // Busca en Drive todas las hojas auxiliares con ese nombre, por si
  // hay varias y el ID quedó apuntando a una vacía.
  try {
    const it = DriveApp.getFilesByName('CIERRE RUTA CHOFERES - Auditoría y Ubicaciones');
    while (it.hasNext()) {
      const f = it.next();
      let filas = '?';
      try {
        const s = SpreadsheetApp.openById(f.getId()).getSheetByName('UBICACIONES');
        filas = s ? Math.max(0, s.getLastRow() - 1) : 'sin hoja UBICACIONES';
      } catch (e2) { filas = 'error: ' + e2.message; }
      out.otrasHojasEnDrive.push({ id: f.getId(), creado: f.getDateCreated(), ubicaciones: filas, url: f.getUrl() });
    }
  } catch (e) {
    out.otrasHojasEnDrive.push({ error: e.message });
  }
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
