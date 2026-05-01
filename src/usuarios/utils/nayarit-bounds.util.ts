/**
 * Polígono simplificado del estado de Nayarit (longitud, latitud).
 * Puntos clave del límite estatal en sentido antihorario.
 */
const NAYARIT_POLYGON: [number, number][] = [
  [-105.70, 23.10],
  [-104.85, 23.14],
  [-104.35, 23.09],
  [-103.72, 23.00],
  [-103.73, 22.35],
  [-103.76, 21.56],
  [-104.10, 21.20],
  [-104.48, 20.99],
  [-105.00, 20.59],
  [-105.25, 20.75],
  [-105.50, 21.10],
  [-105.77, 21.50],
  [-105.82, 22.00],
  [-105.85, 22.50],
  [-105.78, 22.90],
  [-105.70, 23.10],
];

/**
 * Algoritmo ray casting: determina si un punto está dentro de un polígono.
 * @param lon longitud del punto
 * @param lat latitud del punto
 * @param polygon arreglo de vértices [lon, lat]
 */
function pointInPolygon(lon: number, lat: number, polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

/**
 * Retorna true si las coordenadas se encuentran dentro del estado de Nayarit.
 */
export function isWithinNayarit(latitud: number, longitud: number): boolean {
  return pointInPolygon(longitud, latitud, NAYARIT_POLYGON);
}
