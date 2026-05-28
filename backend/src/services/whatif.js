// /whatif endpoint orchestration. Returns both Scenario A (model) and B (CMF)
// where available, otherwise B only.
import { applyScenarioBSegment } from './dualScenario.js';

/**
 * @param {Object} args
 * @param {Array} args.segments — hydrated road segments (with .risk and .ead_baseline)
 * @param {string[]} args.link_ids
 * @param {string[]} args.interventions
 * @param {'A'|'B'|'both'} args.scenario
 * @param {Function} [args.scenarioARunner] — async ({segment, interventions}) => number  (model risk)
 */
export async function runWhatIf({
  segments,
  link_ids,
  interventions,
  scenario = 'both',
  scenarioARunner,
}) {
  const results = [];
  const wantA = scenario === 'A' || scenario === 'both';
  const wantB = scenario === 'B' || scenario === 'both';
  for (const id of link_ids) {
    const seg = segments.find((s) => s.link_id === id);
    if (!seg) continue;
    const bPred = await applyScenarioBSegment(seg, interventions);
    let scenarioARisk;
    if (wantA && scenarioARunner) {
      try {
        scenarioARisk = await scenarioARunner({ segment: seg, interventions });
      } catch {
        scenarioARisk = undefined;
      }
    }
    results.push({
      link_id: id,
      baseline_risk: seg.risk,
      scenario_a_risk: wantA ? scenarioARisk : undefined,
      scenario_b_risk: wantB ? bPred.scenario_b_risk : undefined,
      applied: bPred.applied,
      reduction_pct: bPred.reduction_pct,
      cost_billion: bPred.cost_billion,
      ead_avoided: bPred.ead_avoided,
    });
  }
  return results;
}
