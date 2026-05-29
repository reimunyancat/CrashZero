// Shared types for the CrashZero frontend.
// Backend and ML pipelines emit the same shapes (see docs/ARCHITECTURE.md).

export type RiskBand = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';

export type RoadHighway =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'unclassified'
  | 'residential'
  | 'living_street'
  | 'service'
  | 'pedestrian'
  | 'cycleway'
  | 'footway'
  | 'path'
  | 'steps'
  | 'other';

export type LngLat = [number, number];

export interface RoadSegment {
  link_id: string;
  name?: string;
  highway: RoadHighway;
  geometry: LngLat[];
  /** Composite risk score in [0,1]; produced by ML model or fallback heuristics. */
  risk: number;
  risk_band: RiskBand;
  /** Annualized expected crashes derived from baseline rate * exposure. */
  ead_baseline?: number;
  /** True if within 100m of an annotated blackspot. */
  near_blackspot?: boolean;
  /** Distance (km) to nearest blackspot centroid. */
  blackspot_distance_km?: number;
  /** Optional feature contributions surfaced by the model (SHAP-like). */
  contributions?: Array<{ feature: string; value: number }>;
}

export interface Blackspot {
  id: string;
  type: 'frequentzone_general' | 'frequentzone_child' | 'frequentzone_elderly' | 'frequentzone_vulnerable';
  centroid: LngLat;
  radius_m: number;
  source_year: number;
  fatalities?: number;
  injuries?: number;
  crashes?: number;
  vulnerable_weight: number;
  label: string;
}

export interface RiskHeatmap {
  generated_at: string;
  bbox: [number, number, number, number];
  features: RoadSegment[];
  blackspots: Blackspot[];
  source_year: number;
  meta?: {
    model_version?: string;
    sample_size?: number;
    network?: string;
  };
}

export type InterventionId =
  | 'traffic_signal'
  | 'crosswalk'
  | 'median_barrier'
  | 'speed_bump'
  | 'school_zone'
  | 'led_streetlight'
  | 'protected_left_turn';

export interface InterventionOption {
  id: InterventionId;
  label: string;
  description: string;
  reduction_range: [number, number];
  cost_billion: number;
  cmf_source: string;
  icon?: string;
}

export interface WhatIfRequest {
  link_ids: string[];
  interventions: InterventionId[];
  scenario?: 'A' | 'B' | 'both';
}

export interface WhatIfResult {
  link_id: string;
  baseline_risk: number;
  /** Scenario A — model counterfactual (re-predict with edited features). */
  scenario_a_risk?: number;
  /** Scenario B — CMF-grounded reduction (HSM-style multiplicative caps). */
  scenario_b_risk: number;
  applied: InterventionId[];
  reduction_pct: number;
  cost_billion: number;
  ead_avoided: number;
}

export interface BudgetRequest {
  total_budget_billion: number;
  candidates: Array<{ link_id: string; interventions: InterventionId[] }>;
  strategy?: 'greedy' | 'ilp';
}

export interface BudgetRow {
  rank: number;
  link_id: string;
  link_name?: string;
  intervention: InterventionId;
  cost_billion: number;
  ead_avoided: number;
  cost_per_ead: number;
  cumulative_cost: number;
  cumulative_avoided: number;
  scenario_b_risk_after: number;
}

export interface BudgetResult {
  total_budget_billion: number;
  spent_billion: number;
  total_avoided: number;
  rows: BudgetRow[];
  strategy: 'greedy' | 'ilp';
  generated_at: string;
}

export interface SegmentDetail extends RoadSegment {
  features?: Record<string, number>;
  history?: Array<{ year: number; crashes: number; fatalities: number }>;
  suggested?: InterventionId[];
}

export interface WeatherFilter {
  condition: 'all' | 'clear' | 'rain' | 'snow' | 'fog';
  time_of_day: 'all' | 'morning' | 'day' | 'evening' | 'night';
}

export interface MetricSummary {
  total_segments: number;
  high_risk_count: number;
  blackspot_count: number;
  predicted_crashes_year: number;
  fatalities_year: number;
}
