// Caches hydrated segment + blackspot arrays so /heatmap, /whatif, /budget share them.
// Falls back to fixtures when the network is offline or USE_FIXTURES=true.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { env } from "../utils/env.js";
import { fetchSegments, scoreToBand } from "./roadNetwork.js";
import { fetchBlackspots } from "./koroad.js";
import { getLinksNearPoint, snapPointToLinks } from "../utils/spatial.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let cache = null;
let cacheStamp = 0;
const TTL_MS = 1000 * 60 * 30;

async function loadFixture(name) {
  const dir = resolve(__dirname, "../../", env.fixturesDir);
  const path = resolve(dir, name);
  const text = await readFile(path, "utf-8");
  return JSON.parse(text);
}

function hydrateFromFixture(heatmap) {
  const features = heatmap.features.map((f) => ({
    ...f,
    ead_baseline: f.risk * 0.18,
  }));
  return {
    source: "fixture",
    features,
    blackspots: heatmap.blackspots ?? [],
    summary: heatmap.summary,
  };
}

function summarize(features) {
  const counts = { very_high: 0, high: 0, medium: 0, low: 0, very_low: 0 };
  for (const f of features)
    counts[f.risk_band] = (counts[f.risk_band] ?? 0) + 1;
  return counts;
}

function adjustRiskByBlackspots(segments, blackspots) {
  if (!blackspots.length) return segments;
  const links = segments.map((s) => ({
    link_id: s.link_id,
    geometry: s.geometry,
  }));
  // For each blackspot, find nearest link and boost risk.
  const boostMap = new Map();
  for (const bs of blackspots) {
    const snaps = getLinksNearPoint(bs.centroid[0], bs.centroid[1], links, 30);
    for (const snap of snaps) {
      // Calculate influence scaling it by severity and crash count so high risk areas actually get "very_high"
      const influence =
        influenceFromMeters(snap.distance_m) *
        bs.source_weight *
        (Math.max(1, bs.severity * 5) + bs.crash_count_3y / 15);
      boostMap.set(snap.link_id, (boostMap.get(snap.link_id) ?? 0) + influence);
    }
  }
  return segments.map((s) => {
    const boost = boostMap.get(s.link_id) ?? 0;
    const risk = Math.max(0, Math.min(1, s.risk + boost));
    return {
      ...s,
      risk,
      risk_band: scoreToBand(risk),
      ead_baseline: risk * 0.18,
    };
  });
}

function influenceFromMeters(m) {
  const km = m / 1000;
  if (km <= 0.12) return 0.7;
  if (km <= 0.3) return 0.48;
  if (km <= 0.65) return 0.24;
  if (km <= 1.1) return 0.1;
  return 0;
}

export async function getFeatures({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheStamp < TTL_MS) return cache;

  // Try live API first.
  if (!env.useFixtures) {
    const segments = await fetchSegments();
    if (segments && segments.length) {
      const blackspots = (await fetchBlackspots()) ?? [];
      const hydrated = adjustRiskByBlackspots(segments, blackspots);
      cache = {
        source: "live",
        features: hydrated,
        blackspots,
        summary: summarize(hydrated),
      };
      cacheStamp = Date.now();
      return cache;
    }
  }

  // Fallback.
  const heatmap = await loadFixture("heatmap_sample.json");
  cache = hydrateFromFixture(heatmap);
  cacheStamp = Date.now();
  return cache;
}

export function clearCache() {
  cache = null;
  cacheStamp = 0;
}
