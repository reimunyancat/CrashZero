// OSM Overpass road network loader for 영등포구.
// Builds segments with: link_id (synthetic, stable), highway, geometry, name.
import { request } from "undici";
import { env } from "../utils/env.js";
import { polylineLengthMeters } from "../utils/spatial.js";

const BBOX = "37.4915,126.8780,37.5470,126.9430"; // S,W,N,E  — 영등포구 전역

const QUERY = `[out:json][timeout:30];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|pedestrian|cycleway|footway|path|steps)$"](${BBOX});
out geom;`;

export const HIGHWAY_BASE_RISK = {
  motorway: 0.36,
  trunk: 0.34,
  primary: 0.32,
  secondary: 0.28,
  tertiary: 0.24,
  unclassified: 0.18,
  residential: 0.17,
  living_street: 0.16,
  service: 0.13,
  pedestrian: 0.12,
  cycleway: 0.11,
  footway: 0.1,
  path: 0.09,
  steps: 0.08,
};

export function scoreToBand(score) {
  if (score >= 0.75) return "very_high";
  if (score >= 0.55) return "high";
  if (score >= 0.35) return "medium";
  if (score >= 0.2) return "low";
  return "very_low";
}

/** Load Overpass result; returns null on network/disabled (so callers can fixture-fallback). */
export async function fetchSegments() {
  if (env.useFixtures) return null;
  try {
    const res = await request(env.overpassUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "CrashZero/1.0",
      },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
    if (res.statusCode >= 400) return null;
    const body = await res.body.json();
    const elements = body?.elements ?? [];
    return elements
      .filter((el) => el.type === "way" && Array.isArray(el.geometry))
      .map((el) => buildSegment(el));
  } catch (err) {
    console.warn("[overpass]", err.message);
    return null;
  }
}

function buildSegment(way) {
  const geometry = way.geometry.map((p) => [p.lon, p.lat]);
  const highway = way.tags?.highway ?? "unclassified";
  const name = way.tags?.name ?? "";
  const baseRisk = HIGHWAY_BASE_RISK[highway] ?? 0.18;
  // Synthetic ITS-style ID: 영등포(35) + OSM way id.
  const link_id = `35${way.id}`;
  return {
    link_id,
    osm_way_id: way.id,
    name,
    highway,
    risk: baseRisk,
    risk_band: scoreToBand(baseRisk),
    length_m: Math.round(polylineLengthMeters(geometry)),
    geometry,
  };
}
