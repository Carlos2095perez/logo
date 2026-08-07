#!/usr/bin/env python3
"""
Genera _SeedUbicaciones.js para la app CIERRE RUTA CHOFERES a partir de
archivos KML/KMZ (exportados de Google Earth/My Maps).

Uso:
    python3 seed_ubicaciones_from_kml.py <carpeta_con_kml> [ruta_salida.js]

- Lee TODOS los .kml y .kmz de la carpeta.
- Extrae cada Placemark: nombre + Point/coordinates (KML viene lng,lat -> se
  guarda lat,lng, que es lo que usa la app).
- Deduplica por nombre normalizado (sin acentos, mayúsculas, espacios colapsados).
- Escribe el archivo con un TOKEN_ADMIN_SEED NUEVO (aleatorio) cada vez.

El cargador de la app (agregarUbicaciones) FUSIONA por nombre (actualiza
existentes, agrega nuevos) y rechaza nombres de más de 120 caracteres.
"""
import zipfile, re, json, glob, os, sys, unicodedata, datetime, secrets
import xml.etree.ElementTree as ET


def leer(path):
    if path.endswith(".kmz"):
        with zipfile.ZipFile(path) as z:
            nombre = [x for x in z.namelist() if x.endswith(".kml")][0]
            return z.read(nombre).decode("utf-8", "replace")
    return open(path, encoding="utf-8", errors="replace").read()


def placemarks(xml):
    xml = re.sub(r'xmlns(:\w+)?="[^"]+"', '', xml)
    xml = re.sub(r'<(/?)\w+:', r'<\1', xml)
    root = ET.fromstring(xml)
    out = []
    for pm in root.iter("Placemark"):
        nom = (pm.findtext("name") or "").strip()
        c = pm.find(".//Point/coordinates")
        if c is not None and c.text:
            p = c.text.strip().split(",")
            if len(p) >= 2:
                try:
                    out.append((nom, float(p[1]), float(p[0])))  # lat, lng
                except ValueError:
                    pass
    return out


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r'\s+', ' ', s).strip().upper()


def main():
    carpeta = sys.argv[1] if len(sys.argv) > 1 else "."
    salida = sys.argv[2] if len(sys.argv) > 2 else "_SeedUbicaciones.js"
    files = sorted(glob.glob(os.path.join(carpeta, "*.kml")) +
                   glob.glob(os.path.join(carpeta, "*.kmz")))
    if not files:
        print("No se encontraron .kml/.kmz en", carpeta); sys.exit(1)

    todos = []
    for f in files:
        pts = placemarks(leer(f))
        todos += pts
        print(f"  {len(pts):5}  {os.path.basename(f)}")

    vistos, unicos, dup = {}, [], 0
    for nom, lat, lng in todos:
        k = norm(nom)
        if k in vistos:
            dup += 1; continue
        vistos[k] = True
        unicos.append({"cliente": nom, "lat": lat, "lng": lng})
    unicos.sort(key=lambda x: x["cliente"].upper())

    largos = [u for u in unicos if len(u["cliente"]) > 120]
    token = secrets.token_hex(16)
    hoy = datetime.date.today().isoformat()
    js = (f'// Archivo TEMPORAL de carga (lote MAESTRO KML, {hoy}). Se elimina tras usarlo.\n'
          f'// {len(unicos)} clientes unicos consolidados de {len(files)} exportaciones KML/KMZ (fusiona por nombre).\n'
          f'var TOKEN_ADMIN_SEED = "{token}";\n\n'
          f'var UBICACIONES_SEED = ' + json.dumps(unicos, ensure_ascii=False, separators=(',', ':')) + ';\n')
    open(salida, "w", encoding="utf-8").write(js)

    print(f"\nArchivos: {len(files)} | bruto: {len(todos)} | duplicados: {dup} | UNICOS: {len(unicos)}")
    print(f"Nombres >120 chars (se rechazarian): {len(largos)}")
    print(f"TOKEN NUEVO: {token}")
    print(f"Escrito en: {salida}")


if __name__ == "__main__":
    main()
