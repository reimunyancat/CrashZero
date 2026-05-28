// Dual-scenario engine — a key concept in the redesigned plan.
//
//   Scenario A: "모델 재예측" — backend re-runs the trained model with edited features.
//                Captures interaction effects but depends on backend availability.
//   Scenario B: "CMF 근거" — HSM/FHWA reduction factors applied multiplicatively
//                with a 0.62 ceiling. Always available client-side, even offline.
//
// Both numbers are surfaced together in the UI so reviewers can see whether the
// data-driven and policy-driven estimates agree.

import { combineReductions, INTERVENTION_CATALOG, midReduction } from './cmf';
import type {
  InterventionId,
  RoadSegment,
  WhatIfResult,
} from './types';

export interface DualPrediction {
  link_id: string;
  baseline_risk: number;
  scenario_b_risk: number;
  reduction_pct: number;
  cost_billion: number;
  applied: InterventionId[];
  ead_avoided: number;
}

const EAD_PER_RISK = 0.18; // Heuristic: 1.0 risk ≈ 0.18 expected crashes / year / link.

/** Apply CMF-based intervention package to a baseline segment risk. */
export function applyScenarioB(
  segment: RoadSegment,
  interventionIds: InterventionId[],
): DualPrediction {
  const baseline = segment.risk;
  const interventions = interventionIds
    .map((id) => INTERVENTION_CATALOG[id])
    .filter(Boolean);
  const reductions = interventions.map(midReduction);
  const totalReduction = combineReductions(reductions);
  const scenarioB = Math.max(0, baseline * (1 - totalReduction));
  const cost = interventions.reduce((acc, opt) => acc + opt.cost_billion, 0);
  const eadBase = segment.ead_baseline ?? baseline * EAD_PER_RISK;
  const eadAvoided = eadBase * totalReduction;
  return {
    link_id: segment.link_id,
    baseline_risk: baseline,
    scenario_b_risk: scenarioB,
    reduction_pct: totalReduction,
    cost_billion: cost,
    applied: interventions.map((i) => i.id),
    ead_avoided: eadAvoided,
  };
}

/** Build a synthetic WhatIfResult from a Scenario B prediction (used when backend is offline). */
export function toWhatIfResult(prediction: DualPrediction): WhatIfResult {
  return {
    link_id: prediction.link_id,
    baseline_risk: prediction.baseline_risk,
    scenario_b_risk: prediction.scenario_b_risk,
    applied: prediction.applied,
    reduction_pct: prediction.reduction_pct,
    cost_billion: prediction.cost_billion,
    ead_avoided: prediction.ead_avoided,
  };
}

/** Rank interventions for a single segment by cost-effectiveness. */
export function rankInterventionsForSegment(
  segment: RoadSegment,
  candidateIds: InterventionId[] = Object.keys(INTERVENTION_CATALOG) as InterventionId[],
): Array<{ id: InterventionId; ead_avoided: number; cost: number; cost_per_ead: number }> {
  const rows = candidateIds
    .map((id) => INTERVENTION_CATALOG[id])
    .filter(Boolean)
    .map((opt) => {
      const prediction = applyScenarioB(segment, [opt.id]);
      const eadAvoided = prediction.ead_avoided;
      const costPerEad = eadAvoided > 0 ? opt.cost_billion / eadAvoided : Number.POSITIVE_INFINITY;
      return {
        id: opt.id,
        ead_avoided: eadAvoided,
        cost: opt.cost_billion,
        cost_per_ead: costPerEad,
      };
    });
  rows.sort((a, b) => a.cost_per_ead - b.cost_per_ead);
  return rows;
}
