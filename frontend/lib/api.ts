// Backend API client + fixture fallback.
//
// When `NEXT_PUBLIC_USE_FIXTURE=true` (or the backend is unreachable), the client
// returns committed fixture data so the UI keeps rendering. This is intentional
// for demo/offline scenarios documented in `docs/RUNBOOK.md`.

import type {
  BudgetRequest,
  BudgetResult,
  RiskHeatmap,
  SegmentDetail,
  WhatIfRequest,
  WhatIfResult,
} from './types';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/$/, '');
const USE_FIXTURE = process.env.NEXT_PUBLIC_USE_FIXTURE === 'true';

async function safeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function loadFixture<T>(name: string): Promise<T> {
  // Fixtures live in /public/fixtures/ so they are statically reachable.
  const res = await fetch(`/fixtures/${name}.json`, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`fixture ${name} missing`);
  return (await res.json()) as T;
}

export async function fetchHeatmap(): Promise<RiskHeatmap> {
  if (USE_FIXTURE) return loadFixture<RiskHeatmap>('heatmap_sample');
  try {
    return await safeFetch<RiskHeatmap>('/api/heatmap');
  } catch (err) {
    console.warn('[api.heatmap] backend unreachable, falling back to fixture', err);
    return loadFixture<RiskHeatmap>('heatmap_sample');
  }
}

export async function fetchSegmentDetail(linkId: string): Promise<SegmentDetail> {
  if (USE_FIXTURE) {
    const all = await loadFixture<{ segments: SegmentDetail[] }>('segment_details_sample');
    const hit = all.segments.find((s) => s.link_id === linkId);
    if (!hit) throw new Error(`fixture has no link ${linkId}`);
    return hit;
  }
  return safeFetch<SegmentDetail>(`/api/segments/${encodeURIComponent(linkId)}`);
}

export async function runWhatIf(req: WhatIfRequest): Promise<WhatIfResult[]> {
  if (USE_FIXTURE) return loadFixture<{ results: WhatIfResult[] }>('whatif_sample').then((r) => r.results);
  return safeFetch<{ results: WhatIfResult[] }>('/api/whatif', {
    method: 'POST',
    body: JSON.stringify(req),
  }).then((r) => r.results);
}

export async function runBudget(req: BudgetRequest): Promise<BudgetResult> {
  if (USE_FIXTURE) return loadFixture<BudgetResult>('budget_sample');
  return safeFetch<BudgetResult>('/api/budget', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export function isFixtureMode(): boolean {
  return USE_FIXTURE;
}
