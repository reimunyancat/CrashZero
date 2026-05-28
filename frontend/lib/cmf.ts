// CMF (Crash Modification Factor) catalog — used by Scenario B engine.
// Numbers cite FHWA CMF Clearinghouse (cmfclearinghouse.org) and AASHTO HSM (2010, 2nd ed.).
// Each option keeps a (low, high) range so the UI can render uncertainty bands.
//
// IMPORTANT: A CMF of 0.78 means "after this treatment, expected crashes = 78% of baseline".
// We expose `reduction = 1 - CMF` to keep the UI math intuitive ("31% ↓").
//
// Combined reductions follow HSM multiplicative rule with a 0.62 ceiling so we never
// claim implausible >62% reduction stacking from heterogeneous countermeasures.

import type { InterventionOption, InterventionId } from './types';

export const INTERVENTION_CATALOG: Record<InterventionId, InterventionOption> = {
  traffic_signal: {
    id: 'traffic_signal',
    label: '신호기 설치/개선',
    description: '비신호교차로의 신호기 설치 또는 활용도 개선(보행자 보호형 포함).',
    reduction_range: [0.08, 0.22],
    cost_billion: 0.55,
    cmf_source: 'FHWA CMF Clearinghouse #228, #303 (signalization at unsignalized intersections)',
    icon: '/icons/traffic-signal.svg',
  },
  crosswalk: {
    id: 'crosswalk',
    label: '고화조·스마트 횡단보도',
    description: '노면 도색 재정비 + 보행자 감지 LED 연동 시스템.',
    reduction_range: [0.05, 0.16],
    cost_billion: 0.28,
    cmf_source: 'AASHTO HSM Vol.3 Ch.14 §14.6 (high-visibility crosswalks)',
    icon: '/icons/crosswalk.svg',
  },
  median_barrier: {
    id: 'median_barrier',
    label: '중앙분리대',
    description: '양방향 차로 분리. 정면충돌·세그먼트 이탈 사고를 주로 줄임.',
    reduction_range: [0.12, 0.31],
    cost_billion: 0.72,
    cmf_source: 'FHWA CMF Clearinghouse #168 (median barriers, urban arterials)',
    icon: '/icons/median-barrier.svg',
  },
  speed_bump: {
    id: 'speed_bump',
    label: '과속 방지턱',
    description: '주택가·이면도로 차량 속도 강제 억제.',
    reduction_range: [0.04, 0.14],
    cost_billion: 0.18,
    cmf_source: 'FHWA CMF Clearinghouse #423 (speed humps, low-volume streets)',
    icon: '/icons/traffic-cone.svg',
  },
  school_zone: {
    id: 'school_zone',
    label: '어린이 보호구역 강화',
    description: '과속단속·보행 시설·속도 30 적용 패키지.',
    reduction_range: [0.10, 0.28],
    cost_billion: 0.65,
    cmf_source: 'KOROAD 어린이보호구역 행동변화 보고서(2022) + FHWA #4612',
    icon: '/icons/child-zone.svg',
  },
  led_streetlight: {
    id: 'led_streetlight',
    label: 'LED 가로등 강화',
    description: '야간 조도 단수 클래스 상향 (교차로·횡단보도 이근).',
    reduction_range: [0.06, 0.18],
    cost_billion: 0.22,
    cmf_source: 'FHWA CMF Clearinghouse #2240 (overhead lighting upgrade)',
    icon: '/icons/road-risk.svg',
  },
  protected_left_turn: {
    id: 'protected_left_turn',
    label: '보호되는 좌회전',
    description: '좌회전 전용 시제 신설 + 도색 개선.',
    reduction_range: [0.10, 0.24],
    cost_billion: 0.42,
    cmf_source: 'FHWA CMF Clearinghouse #3823 (protected-only left turn phase)',
    icon: '/icons/traffic-signal.svg',
  },
};

export const ALL_INTERVENTIONS = Object.values(INTERVENTION_CATALOG);

/**
 * HSM-style multiplicative combination with a soft cap.
 * cap=0.62 keeps stacked claims plausible vs. published meta-analyses
 * (Elvik 2017, Highway Safety Manual Part D commentary).
 */
export function combineReductions(
  reductions: number[],
  cap = 0.62,
): number {
  if (reductions.length === 0) return 0;
  const product = reductions.reduce((acc, r) => acc * (1 - clamp01(r)), 1);
  return Math.min(cap, 1 - product);
}

export function midReduction(option: InterventionOption): number {
  const [lo, hi] = option.reduction_range;
  return (lo + hi) / 2;
}

export function lowReduction(option: InterventionOption): number {
  return option.reduction_range[0];
}

export function highReduction(option: InterventionOption): number {
  return option.reduction_range[1];
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
