// Risk scoring + filtering helpers.
// Pure functions only — safe to call from server components and client alike.

import type {
  RiskBand,
  RoadSegment,
  RoadHighway,
  WeatherFilter,
} from './types';

export const RISK_BANDS: RiskBand[] = ['very_high', 'high', 'medium', 'low', 'very_low'];

export const RISK_BAND_LABEL: Record<RiskBand, string> = {
  very_high: '매우 높음',
  high: '높음',
  medium: '중간',
  low: '낮음',
  very_low: '매우 낮음',
};

export const RISK_BAND_COLOR: Record<RiskBand, string> = {
  very_high: '#D34037',
  high: '#E6A14A',
  medium: '#EAE065',
  low: '#9ACA83',
  very_low: '#80B971',
};

export const RISK_BAND_SOFT: Record<RiskBand, string> = {
  very_high: 'rgba(211, 64, 55, 0.16)',
  high: 'rgba(230, 161, 74, 0.16)',
  medium: 'rgba(234, 224, 101, 0.18)',
  low: 'rgba(154, 202, 131, 0.18)',
  very_low: 'rgba(128, 185, 113, 0.18)',
};

/** Map a raw risk score [0,1] to a categorical band. */
export function scoreToBand(score: number): RiskBand {
  if (score >= 0.72) return 'very_high';
  if (score >= 0.55) return 'high';
  if (score >= 0.38) return 'medium';
  if (score >= 0.22) return 'low';
  return 'very_low';
}

export function colorForScore(score: number): string {
  return RISK_BAND_COLOR[scoreToBand(score)];
}

/** Baseline highway-type risk priors (mirrors backend src/services/roadNetwork.js). */
export const HIGHWAY_BASE_RISK: Record<RoadHighway, number> = {
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
  footway: 0.10,
  path: 0.09,
  steps: 0.08,
  other: 0.15,
};

/** Multiplicative environmental modifiers used when re-applying weather/time filters. */
const WEATHER_FACTOR: Record<WeatherFilter['condition'], number> = {
  all: 1.0,
  clear: 0.95,
  rain: 1.18,
  snow: 1.42,
  fog: 1.25,
};

const TIME_FACTOR: Record<WeatherFilter['time_of_day'], number> = {
  all: 1.0,
  morning: 1.08,
  day: 0.94,
  evening: 1.16,
  night: 1.22,
};

export function applyEnvironmentalFilter(
  segments: RoadSegment[],
  filter: WeatherFilter,
): RoadSegment[] {
  const wf = WEATHER_FACTOR[filter.condition] ?? 1;
  const tf = TIME_FACTOR[filter.time_of_day] ?? 1;
  const multiplier = wf * tf;
  if (Math.abs(multiplier - 1) < 1e-6) return segments;
  return segments.map((s) => {
    const next = Math.min(1, s.risk * multiplier);
    return { ...s, risk: next, risk_band: scoreToBand(next) };
  });
}

export function filterByBand(
  segments: RoadSegment[],
  allowedBands: Set<RiskBand>,
): RoadSegment[] {
  if (allowedBands.size === 0) return segments;
  return segments.filter((s) => allowedBands.has(s.risk_band));
}

export function topNByRisk(segments: RoadSegment[], n = 50): RoadSegment[] {
  return [...segments].sort((a, b) => b.risk - a.risk).slice(0, n);
}

export function countByBand(segments: RoadSegment[]): Record<RiskBand, number> {
  const counts: Record<RiskBand, number> = {
    very_high: 0,
    high: 0,
    medium: 0,
    low: 0,
    very_low: 0,
  };
  for (const s of segments) counts[s.risk_band]++;
  return counts;
}

export function estimateAnnualCrashes(segments: RoadSegment[]): number {
  return segments.reduce((acc, s) => acc + (s.ead_baseline ?? s.risk * 0.18), 0);
}
