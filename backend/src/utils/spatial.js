// Spatial helpers — no external deps beyond proj4.
// Used to snap accident points / facility points to ITS LinkIDs in EPSG:5179
// and to compute haversine distances for the UI.
import proj4 from "proj4";

// Korea 2000 / Unified Coordinate System (ITS / 국가표준)
proj4.defs(
  "EPSG:5179",
  "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs",
);

export function wgs84To5179(lng, lat) {
  return proj4("EPSG:4326", "EPSG:5179", [lng, lat]);
}

export function _5179ToWgs84(x, y) {
  return proj4("EPSG:5179", "EPSG:4326", [x, y]);
}

const R_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

/** Haversine distance in kilometers. */
export function haversineKm(aLng, aLat, bLng, bLat) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Distance from point P to segment AB in meters (planar EPSG:5179). */
export function pointToSegmentMeters(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Distance from a WGS84 point to a WGS84 polyline (returns meters). */
export function pointToPolylineMeters(lng, lat, polylineWgs84) {
  if (!polylineWgs84 || polylineWgs84.length < 2) return Infinity;
  const [px, py] = wgs84To5179(lng, lat);
  let best = Infinity;
  for (let i = 0; i < polylineWgs84.length - 1; i++) {
    const [ax, ay] = wgs84To5179(polylineWgs84[i][0], polylineWgs84[i][1]);
    const [bx, by] = wgs84To5179(
      polylineWgs84[i + 1][0],
      polylineWgs84[i + 1][1],
    );
    const d = pointToSegmentMeters(px, py, ax, ay, bx, by);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Snap a point to the nearest link within `tolMeters`. Returns { linkId, distance_m } or null.
 * `links` is an array of { link_id, geometry: [[lng,lat], ...] }.
 */
export function getLinksNearPoint(lng, lat, links, tolMeters = 100) {
  const matches = [];
  for (const link of links) {
    const d = pointToPolylineMeters(lng, lat, link.geometry);
    if (d <= tolMeters) {
      matches.push({ link_id: link.link_id, distance_m: d });
    }
  }
  return matches;
}

export function snapPointToLinks(lng, lat, links, tolMeters = 20) {
  let best = null;
  for (const link of links) {
    const d = pointToPolylineMeters(lng, lat, link.geometry);
    if (d <= tolMeters && (!best || d < best.distance_m)) {
      best = { link_id: link.link_id, distance_m: d };
    }
  }
  return best;
}

/** Approximate polyline length in meters. */
export function polylineLengthMeters(polyline) {
  if (!polyline || polyline.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = wgs84To5179(polyline[i][0], polyline[i][1]);
    const b = wgs84To5179(polyline[i + 1][0], polyline[i + 1][1]);
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}
