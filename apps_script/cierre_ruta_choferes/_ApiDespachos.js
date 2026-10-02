// ============================================================
// API de DESPACHOS (consumido por la app nueva "despachos-choferes-movil").
//
// Expone -- SOLO por token de servicio -- la MISMA logica de cierre que ya
// usa esta app de Apps Script (objeto _Datos y funciones de registro), para
// que la app nueva lea/escriba las mismas hojas de Google SIN reimplementar
// nada ni arriesgar las celdas de produccion. No toca el flujo existente:
// doGet solo deriva aca cuando viene ?api=... (ver la linea agregada en
// Codigo.js). Todo lo demas (la PWA, el login de choferes, google.script.run)
// sigue igual.
//
// Seguridad: cada llamada exige token === TOKEN_API_DESPACHOS. Ese token lo
// conoce SOLO el backend de la app nueva (variable de entorno en Railway),
// nunca el navegador del chofer. La app nueva ya autentica al chofer por su
// lado (correo+OTP, un dispositivo); aca el token es "confio en ese backend".
// ============================================================

var TOKEN_API_DESPACHOS = 'da911f268fc340c00714ed3e8c0d2df0538cab9f11d28d11';

function _apiRespuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Resuelve el nombre de ruta a partir del color (QUITO NORTE/SUR/VALLES).
function _apiRuta(color) {
  return CONFIG.rutas[color] || obtenerRutaPorColor(color);
}

function _apiDespachos(e) {
  var p = (e && e.parameter) || {};
  try {
    if (!TOKEN_API_DESPACHOS || p.token !== TOKEN_API_DESPACHOS) {
      return _apiRespuesta({ ok: false, error: 'token invalido' });
    }
    var color = String(p.color || '').toUpperCase().trim();
    var exigeColor = function () {
      if (!color || !CONFIG.hojas[color]) throw new Error('color de ruta invalido: ' + color);
    };

    var datos;
    switch (String(p.api)) {
      // ---- LECTURA ----
      case 'rutas': // catalogo de colores/rutas (para el panel admin)
        datos = { colores: Object.keys(CONFIG.hojas), rutas: CONFIG.rutas, parejas: CONFIG.parejasRutas };
        break;
      case 'despacho': // paradas del dia (facturas emparejadas + orden aprendido)
        exigeColor();
        datos = _Datos.cargarDespacho(color);
        break;
      case 'facturas':
        exigeColor();
        datos = _Datos.cargarFacturasConBloqueos(color);
        break;
      case 'resumen': // resumen de cierre (igual al actual)
        exigeColor();
        datos = _Datos.calcularResumenCierre(color, _apiRuta(color));
        break;
      case 'egresos':
        exigeColor();
        datos = _Datos.cargarEgresos(color);
        break;
      case 'cobros':
        datos = _Datos.cargarCobrosRuta(_apiRuta(color));
        break;
      case 'validarCruzado':
        exigeColor();
        datos = _Datos.validarCierreCruzado(color);
        break;

      // ---- ESCRITURA ----
      case 'marcarEstado': {
        exigeColor();
        var vt = (p.valorTransferencia === undefined || p.valorTransferencia === '') ? null : normalizarNumero(p.valorTransferencia);
        datos = _Datos.actualizarEstadoFactura(color, parseInt(p.fila, 10), p.estadoPago || '', vt);
        break;
      }
      case 'registrarEntrega':
        exigeColor();
        datos = registrarEntrega(color, _apiRuta(color), parseInt(p.fila, 10), p.cliente || '', p.factura || '', String(p.entregado) === 'true', p.responsable || '');
        break;
      case 'reagendar':
        exigeColor();
        datos = reagendarVisita(color, _apiRuta(color), parseInt(p.fila, 10), p.cliente || '', p.factura || '', p.responsable || '');
        break;
      case 'incidencia':
        exigeColor();
        datos = registrarIncidencia(color, _apiRuta(color), parseInt(p.fila, 10), p.cliente || '', p.factura || '', p.motivo || '', p.fotoBase64 || '', p.responsable || '');
        break;
      case 'egreso':
        exigeColor();
        datos = _Datos.registrarEgreso(color, p.facturaRef || '', p.descripcion || '', normalizarNumero(p.monto));
        break;
      case 'cobro': {
        var detalles = null;
        if (p.banco || p.comprobante || p.numero) detalles = { banco: p.banco || '', comprobante: p.comprobante || '', numero: p.numero || '' };
        datos = _Datos.registrarCobroRuta(parseInt(p.fila, 10), p.valor, p.formaPago || '', p.responsable || '', detalles);
        break;
      }
      default:
        return _apiRespuesta({ ok: false, error: 'accion desconocida: ' + p.api });
    }
    return _apiRespuesta({ ok: true, datos: datos });
  } catch (err) {
    return _apiRespuesta({ ok: false, error: String((err && err.message) || err) });
  }
}
