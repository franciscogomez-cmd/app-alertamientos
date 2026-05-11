/**
 * Utilidades geográficas compartidas.
 * Usadas en alertas.service.ts y notificaciones.service.ts para filtrado geográfico.
 */

type GeoRing = [number, number][];

function puntoDentroDeAnillo(lat: number, lon: number, anillo: GeoRing): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]; // GeoJSON: [lon, lat]
    const [xj, yj] = anillo[j];
    const cruza =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Ray-casting — soporta Polygon y MultiPolygon */
export function puntoDentroDePoligono(lat: number, lon: number, geojson: unknown): boolean {
  if (!geojson || typeof geojson !== 'object') return false;
  const g = geojson as { type?: unknown; coordinates?: unknown };

  if (g.type === 'Polygon') {
    const anillo = (g.coordinates as GeoRing[] | undefined)?.[0];
    if (!anillo?.length) return false;
    return puntoDentroDeAnillo(lat, lon, anillo);
  }

  if (g.type === 'MultiPolygon') {
    const polygons = g.coordinates as GeoRing[][] | undefined;
    if (!polygons?.length) return false;
    return polygons.some((polygon) => {
      const anillo = polygon[0];
      return !!anillo?.length && puntoDentroDeAnillo(lat, lon, anillo);
    });
  }

  return false;
}

/** Calcula el bounding box sobre todos los anillos exteriores del GeoJSON */
export function calcularBboxGeojson(
  geojson: unknown,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } | null {
  if (!geojson || typeof geojson !== 'object') return null;
  const g = geojson as { type?: unknown; coordinates?: unknown };

  let anillos: GeoRing[] = [];

  if (g.type === 'Polygon') {
    const coords = g.coordinates as GeoRing[] | undefined;
    if (coords?.[0]) anillos = [coords[0]];
  } else if (g.type === 'MultiPolygon') {
    const coords = g.coordinates as GeoRing[][] | undefined;
    if (coords) anillos = coords.map((p) => p[0]).filter(Boolean);
  }

  if (anillos.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const anillo of anillos) {
    for (const [lon, lat] of anillo) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }

  return { minLat, maxLat, minLon, maxLon };
}
