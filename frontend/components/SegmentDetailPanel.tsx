'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import type { Blackspot, RoadSegment } from '@/lib/types';
import {
  RISK_BAND_COLOR,
  RISK_BAND_LABEL,
  HIGHWAY_BASE_RISK,
} from '@/lib/risk';
import { rankInterventionsForSegment } from '@/lib/dualScenario';
import { INTERVENTION_CATALOG } from '@/lib/cmf';
import { formatBillion, formatNumber, formatPercent } from '@/lib/format';

interface Props {
  segment: RoadSegment | null;
  blackspots: Blackspot[];
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function nearestBlackspots(segment: RoadSegment, blackspots: Blackspot[], k = 2) {
  if (!segment.geometry.length || !blackspots.length) return [];
  const head = segment.geometry[Math.floor(segment.geometry.length / 2)];
  const ranked = blackspots
    .map((b) => ({ b, d: haversineKm(head, b.centroid) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  return ranked;
}

export function SegmentDetailPanel({ segment, blackspots }: Props) {
  if (!segment) {
    return (
      <div className="glass-panel px-4 py-6 text-center text-[var(--ink-muted)] text-[13px]">
        <Image
          src="/icons/road-risk.svg"
          alt=""
          width={32}
          height={32}
          className="mx-auto opacity-60 mb-2"
        />
        지도에서 구간을 클릭하면<br />세부 위험도 분석이 여기 나와요.
      </div>
    );
  }

  const bandColorStyle: CSSProperties = { color: RISK_BAND_COLOR[segment.risk_band] };
  const barFillStyle: CSSProperties = {
    width: `${Math.round(segment.risk * 100)}%`,
    backgroundColor: RISK_BAND_COLOR[segment.risk_band],
  };
  const ranked = rankInterventionsForSegment(segment).slice(0, 3);
  const near = nearestBlackspots(segment, blackspots);
  const baselineHighway = HIGHWAY_BASE_RISK[segment.highway] ?? 0.18;

  return (
    <div className="glass-panel px-4 py-4 flex flex-col gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
          LINK {segment.link_id}
        </div>
        <div className="text-[15px] font-semibold mt-0.5 leading-tight">
          {segment.name || `${segment.highway} 구간`}
        </div>
        <div className="text-[11.5px] text-[var(--ink-muted)] mt-0.5">
          도로유형: {segment.highway} · 기준 리스크 {formatPercent(baselineHighway, 1)}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
            종합 위험도
          </span>
          <span className="text-xl font-semibold tabular-nums" style={bandColorStyle}>
            {(segment.risk * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[rgba(148,163,184,0.18)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={barFillStyle} />
        </div>
        <div className="text-[11.5px] mt-1" style={bandColorStyle}>
          {RISK_BAND_LABEL[segment.risk_band]}
        </div>
      </div>

      {segment.contributions && segment.contributions.length > 0 ? (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] mb-1">
            주요 요인
          </div>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {segment.contributions.slice(0, 4).map((c) => (
              <li key={c.feature} className="flex items-center justify-between gap-2">
                <span className="text-[var(--ink)]">{c.feature}</span>
                <span className="text-[var(--ink-muted)] tabular-nums">
                  {c.value >= 0 ? '+' : ''}
                  {(c.value * 100).toFixed(1)}%p
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {near.length ? (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] mb-1">
            인근 사고다발구역
          </div>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {near.map(({ b, d }) => (
              <li key={b.id} className="flex items-center justify-between">
                <span className="text-[var(--ink)] truncate mr-2">{b.label}</span>
                <span className="text-[var(--ink-muted)] tabular-nums">{formatNumber(d, 2)} km</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] mb-1">
          추천 개선안 (Scenario B 기준)
        </div>
        <ul className="flex flex-col gap-1 text-[12.5px]">
          {ranked.map((row) => {
            const opt = INTERVENTION_CATALOG[row.id];
            return (
              <li key={row.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 truncate">
                  <Image src={opt.icon ?? '/icons/road-risk.svg'} alt="" width={14} height={14} />
                  <span className="truncate">{opt.label}</span>
                </span>
                <span className="text-[var(--ink-muted)] tabular-nums whitespace-nowrap">
                  {formatBillion(row.cost)} · EAD {formatNumber(row.ead_avoided, 2)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
