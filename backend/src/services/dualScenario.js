// Dual-Scenario engine on the backend.
// Scenario A: re-run the trained model with edited features (delegates to whatif.js).
// Scenario B: CMF-based reduction (deterministic, always available).
import { combineReductions, getInterventionMap, midReduction } from './cmf.js';

const EAD_PER_RISK = 0.18; // matches frontend constant

/** Apply Scenario B (CMF) on a single segment. */
export async function applyScenarioBSegment(segment, interventionIds) {
  const map = await getInterventionMap();
  const interventions = interventionIds
    .map((id) => map.get(id))
    .filter(Boolean);
  const reductions = interventions.map(midReduction);
  const totalReduction = combineReductions(reductions);
  const scenarioB = Math.max(0, segment.risk * (1 - totalReduction));
  const cost = interventions.reduce((acc, opt) => acc + opt.cost_billion, 0);
  const eadBase = segment.ead_baseline ?? segment.risk * EAD_PER_RISK;
  const eadAvoided = eadBase * totalReduction;
  return {
    link_id: segment.link_id,
    baseline_risk: segment.risk,
    scenario_b_risk: scenarioB,
    applied: interventions.map((i) => i.id),
    reduction_pct: totalReduction,
    cost_billion: cost,
    ead_avoided: eadAvoided,
  };
}

/** Rank candidate interventions for a single segment by EAD-per-billion. */
export async function rankInterventionsForSegment(segment, candidateIds) {
  const map = await getInterventionMap();
  const ids = candidateIds && candidateIds.length ? candidateIds : [...map.keys()];
  const rows = [];
  for (const id of ids) {
    const opt = map.get(id);
    if (!opt) continue;
    const pred = await applyScenarioBSegment(segment, [id]);
    const costPerEad = pred.ead_avoided > 0 ? opt.cost_billion / pred.ead_avoided : Infinity;
    rows.push({
      id,
      ead_avoided: pred.ead_avoided,
      cost: opt.cost_billion,
      cost_per_ead: costPerEad,
    });
  }
  rows.sort((a, b) => a.cost_per_ead - b.cost_per_ead);
  return rows;
}
