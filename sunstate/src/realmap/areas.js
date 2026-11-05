/**
 * Neighbourhood names for the HUD on the real map: rough lon/lat boxes, checked in order
 * (first match wins). Good enough to tell you where you are, not survey-grade.
 */
const AREAS = [
  ['Marathon', -81.2, 24.65, -80.95, 24.8],
  ['Seven Mile Bridge', -81.25, 24.62, -81.12, 24.72],
  ['Islamorada', -80.75, 24.85, -80.55, 25.0],
  ['Key Largo', -80.55, 25.0, -80.3, 25.3],
  ['Florida Keys', -81.3, 24.5, -80.2, 25.3],
  ['Florida City', -80.52, 25.42, -80.45, 25.46],
  ['Homestead', -80.52, 25.46, -80.4, 25.52],
  ['Cutler Bay', -80.38, 25.55, -80.3, 25.6],
  ['Kendall', -80.4, 25.6, -80.3, 25.71],
  ['Key Biscayne', -80.18, 25.66, -80.14, 25.71],
  ['Virginia Key', -80.18, 25.71, -80.14, 25.755],
  ['South Beach', -80.15, 25.76, -80.115, 25.795],
  ['Mid-Beach', -80.15, 25.795, -80.115, 25.835],
  ['North Beach', -80.15, 25.835, -80.11, 25.9],
  ['Watson Island', -80.18, 25.775, -80.165, 25.79],
  ['Fisher Island', -80.16, 25.755, -80.135, 25.765],
  ['PortMiami', -80.185, 25.765, -80.15, 25.785],
  ['Downtown Miami', -80.2, 25.765, -80.18, 25.79],
  ['Brickell', -80.21, 25.75, -80.185, 25.765],
  ['Edgewater', -80.195, 25.79, -80.18, 25.815],
  ['Wynwood', -80.21, 25.79, -80.195, 25.81],
  ['Little Haiti', -80.21, 25.815, -80.18, 25.85],
  ['Allapattah', -80.235, 25.8, -80.21, 25.825],
  ['Little Havana', -80.245, 25.755, -80.205, 25.78],
  ['Coconut Grove', -80.26, 25.71, -80.215, 25.745],
  ['Coral Gables', -80.3, 25.695, -80.255, 25.76],
  ['Miami International Airport', -80.31, 25.78, -80.265, 25.81],
  ['Hialeah', -80.33, 25.81, -80.26, 25.9],
  ['Biscayne Bay', -80.2, 25.65, -80.1, 25.9],
];

export function areaName(index, x, z) {
  const o = index.origin, lon = o.lon + x / o.kx, lat = o.lat - z / o.kz;
  for (const [n, a, b, c, d] of AREAS) if (lon >= a && lon <= c && lat >= b && lat <= d) return n;
  return 'Miami-Dade';
}
