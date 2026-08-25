# Mapa + Navegación — módulo portable

Un solo archivo (`mapa-navegacion.html`) con **todo el mapa y la navegación** de
la app de choferes, aislado y listo para copiar a otra aplicación.
Ábrelo en el celular (o navegador con GPS) y funciona solo.

## Qué trae
- **MapLibre GL v4.7.1** (libre, sin token) + tiles **CartoDB**.
- **Seguimiento GPS** que rota como Waze, con el punto azul **abajo** (~81%).
- **Zoom close-up automático en los giros**.
- **Ruteo con giros** vía **OSRM** (línea azul + burbuja de maniobra).
- Botón "Centrar" y pausa al tocar el mapa.

## Cómo adaptarlo (solo la sección `CONFIG` de arriba)
```js
var CONFIG = {
  bodega:  { lat, lng },            // punto de partida
  paradas: [ { cliente, lat, lng }, ... ],  // en tu app vienen de la BD
  tiles:   [ ...urls de tiles... ],
  osrm:    'https://.../route/v1/driving/'
};
```
Todo lo demás (el "MOTOR") se copia igual.

## Piezas clave del motor (por si lo reescribes en otro framework)
| Función | Qué hace |
|---|---|
| `onPos` | recibe el GPS, calcula rumbo (método de ancla), descarta lecturas basura |
| `arrancarRAF` | seguimiento suave (interpola posición/rumbo/zoom con requestAnimationFrame) |
| `offsetSeg` | baja el punto azul (offset = alto × 0.31) |
| `zoomObjetivo` | 17.7 recta / 18.4–19 al acercarse a un giro |
| `fetchRuta` | pide la ruta a OSRM (`steps=true`) y saca la próxima maniobra |

## Para producción
- **CartoDB** y **OSRM** son servicios **públicos/demo** (sin garantía). Para uso
  serio: usa tus propios tiles y **tu propio servidor OSRM** (o un proveedor).
- **MapLibre** sí es libre y de producción.
- Si la otra app no es Apps Script, lo único que cambia es de dónde vienen las
  `paradas` (una llamada `fetch` a tu API en vez de `google.script.run`).
