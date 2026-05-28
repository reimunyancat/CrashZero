// Budget allocation — greedy on cost-per-EAD.
// Picks the single best intervention per top-N segment, then sorts globally.
import { rankInterventionsForSegment } from './dualScenario.js';
import { getInterventionMap } from './cmf.js';

/**
 * @param {Object} args
 * @param {Array} args.segments
 * @param {number} args.budget_billion
 * @param {number} [args.top_n=60]
 * @param {'A'|'B'} [args.scenario='B']
 */
export async function runBudget({ segments, budget_billion, top_n = 60, scenario = 'B' }) {
  const interventions = await getInterventionMap();
  const pool = [...segments].sort((a, b) => b.risk - a.risk).slice(0, top_n);
  const candidates = [];
  for (const seg of pool) {
    const ranked = await rankInterventionsForSegment(seg);
    if (ranked[0]) candidates.push({ segment: seg, pick: ranked[0] });
  }
  candidates.sort((a, b) => a.pick.cost_per_ead - b.pick.cost_per_ead);

  const rows = [];
  let spent = 0;
  let totalEad = 0;
  for (const c of candidates) {
    if (spent + c.pick.cost > budget_billion + 1e-6) continue;
    spent += c.pick.cost;
    totalEad += c.pick.ead_avoided;
    const opt = interventions.get(c.pick.id);
    rows.push({
      link_id: c.segment.link_id,
      name: c.segment.name ?? c.segment.highway,
      baseline_risk: c.segment.risk,
      intervention_id: c.pick.id,
      intervention_label: opt?.label ?? c.pick.id,
      cost_billion: c.pick.cost,
      ead_avoided: c.pick.ead_avoided,
      cost_per_ead: c.pick.cost_per_ead,
      cumulative_cost: spent,
      cumulative_ead: totalEad,
    });
    if (spent >= budget_billion - 0.05) break;
  }
  return {
    budget_billion,
    spent_billion: spent,
    remaining_billion: Math.max(0, budget_billion - spent),
    total_ead_avoided: totalEad,
    rows,
    scenario,
    source: 'backend-greedy',
  };
}
