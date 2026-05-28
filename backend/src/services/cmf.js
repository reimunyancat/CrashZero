// CMF catalog loader — shared by /whatif and /budget endpoints.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATALOG_PATH = resolve(__dirname, '../../data/cmf_catalog.json');

let _catalogCache = null;

export async function loadCatalog() {
  if (_catalogCache) return _catalogCache;
  const raw = await readFile(CATALOG_PATH, 'utf-8');
  _catalogCache = JSON.parse(raw);
  return _catalogCache;
}

export async function getInterventionMap() {
  const cat = await loadCatalog();
  const map = new Map();
  for (const it of cat.interventions) map.set(it.id, it);
  return map;
}

/** Mid-point of the published reduction range. */
export function midReduction(intervention) {
  const [lo, hi] = intervention.reduction_range;
  return (lo + hi) / 2;
}

/** Multiplicative combination with a hard cap (HSM convention). */
export function combineReductions(reductions, cap = 0.62) {
  if (!reductions.length) return 0;
  const survive = reductions.reduce((acc, r) => acc * (1 - r), 1);
  const total = 1 - survive;
  return Math.min(total, cap);
}
