// Scenario A runner — uses the ML pipeline's frozen predictions (artifacts/predictions.json).
// Each link_id is mapped to its model risk. Interventions adjust the risk
// using the same CMF mid-point reduction, but the *baseline* comes from the
// real GradientBoosting model, not the heuristic in featureCache.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { combineReductions, getInterventionMap, midReduction } from './cmf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let table = null;
let manifest = null;
let loadStamp = 0;
const TTL_MS = 1000 * 60 * 60;

async function readJson(path) {
  const text = await readFile(path, 'utf-8');
  return JSON.parse(text);
}

async function loadOnce() {
  if (table && Date.now() - loadStamp < TTL_MS) return;
  const base = resolve(__dirname, '../../data');
  try {
    const preds = await readJson(resolve(base, 'predictions.json'));
    table = new Map(preds.map((p) => [p.link_id, p]));
    try {
      manifest = await readJson(resolve(base, 'manifest.json'));
    } catch {
      manifest = null;
    }
    loadStamp = Date.now();
  } catch {
    table = null;
    manifest = null;
  }
}

export async function hasModel() {
  await loadOnce();
  return Boolean(table && table.size);
}

export async function getModelManifest() {
  await loadOnce();
  return manifest;
}

export async function getModelRiskTable() {
  await loadOnce();
  return table;
}

/**
 * Scenario A runner signature matches whatif.js expectation.
 * Returns the model risk reduced by the CMF combined mid-point reduction.
 * If the segment has no model prediction, returns undefined so whatif.js
 * keeps the heuristic baseline.
 */
export async function scenarioARunner({ segment, interventions }) {
  await loadOnce();
  if (!table) return undefined;
  const row = table.get(segment.link_id);
  if (!row) return undefined;
  const baseline = row.risk;
  if (!interventions || !interventions.length) return baseline;
  const map = await getInterventionMap();
  const opts = interventions
    .map((id) => map.get(id))
    .filter(Boolean);
  if (!opts.length) return baseline;
  const reductions = opts.map(midReduction);
  const total = combineReductions(reductions);
  return Math.max(0, baseline * (1 - total));
}
