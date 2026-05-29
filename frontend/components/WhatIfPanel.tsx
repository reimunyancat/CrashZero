'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { fetchHeatmap, runWhatIf } from '@/lib/api';
import { ALL_INTERVENTIONS, INTERVENTION_CATALOG } from '@/lib/cmf';
import { applyScenarioB } from '@/lib/dualScenario';
import type {
  InterventionId,
  RoadSegment,
  WhatIfResult,
} from '@/lib/types';
import { colorForScore, RISK_BAND_COLOR, scoreToBand } from '@/lib/risk';
import { formatBillion, formatNumber, formatPercent } from '@/lib/format';
import { iconDimensions } from '@/lib/iconDimensions';

export function WhatIfPanel() {
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [picks, setPicks] = useState<Set<InterventionId>>(new Set());
  const [serverResult, setServerResult] = useState<WhatIfResult | null>(null);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHeatmap()
      .then((heat) => {
        if (cancelled) return;
        const top = [...heat.features].sort((a, b) => b.risk - a.risk).slice(0, 200);
        setSegments(top);
        if (top[0]) setSelectedLink(top[0].link_id);
      })
      .catch(() => setErrorMsg('데이터를 불러올 수 없어요.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const segment = useMemo(
    () => segments.find((s) => s.link_id === selectedLink) ?? null,
    [segments, selectedLink],
  );

  const localPrediction = useMemo(() => {
    if (!segment) return null;
    return applyScenarioB(segment, [...picks]);
  }, [segment, picks]);

  function togglePick(id: InterventionId) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setServerResult(null);
  }

  async function runOnServer() {
    if (!segment || picks.size === 0) return;
    setRunning(true);
    setErrorMsg(null);
    try {
      const results = await runWhatIf({
        link_ids: [segment.link_id],
        interventions: [...picks],
        scenario: 'both',
      });
      setServerResult(results[0] ?? null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '서버 요청 실패');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-panel-strong p-10 text-center text-[var(--ink-muted)]">
        데이터 불러오는 중…
      </div>
    );
  }

  const baselineStyle: CSSProperties | undefined = segment
    ? { color: RISK_BAND_COLOR[segment.risk_band] }
    : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <aside className="glass-panel px-3 py-3 flex flex-col gap-2 max-h-[640px] overflow-y-auto scrollbar-thin">
        <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] px-1">
          고위험 구간 상위 200
        </div>
        {segments.map((s) => {
          const active = s.link_id === selectedLink;
          const dotStyle: CSSProperties = { backgroundColor: colorForScore(s.risk) };
          return (
            <button
              key={s.link_id}
              type="button"
              onClick={() => setSelectedLink(s.link_id)}
              className={
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12.5px] transition-colors ' +
                (active
                  ? 'bg-[rgba(125,162,255,0.16)] text-ink shadow-glow'
                  : 'hover:bg-[rgba(125,162,255,0.08)] text-[var(--ink-muted)]')
              }
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={dotStyle} />
              <span className="flex-1 truncate">
                <span className="text-[var(--ink-soft)]">L{s.link_id}</span>{' '}
                {s.name || s.highway}
              </span>
              <span className="tabular-nums text-[var(--ink)]">{(s.risk * 100).toFixed(0)}%</span>
            </button>
          );
        })}
      </aside>

      <section className="flex flex-col gap-4">
        {segment ? (
          <>
            <header className="glass-panel px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
                  LINK {segment.link_id}
                </div>
                <div className="text-[16px] font-semibold mt-0.5">
                  {segment.name || `${segment.highway} 구간`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">기준 위험도</div>
                <div className="text-2xl font-semibold tabular-nums" style={baselineStyle}>
                  {(segment.risk * 100).toFixed(1)}%
                </div>
              </div>
            </header>

            <div className="glass-panel px-4 py-4">
              <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] mb-2">
                개선 입력 (중복 선택 가능)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ALL_INTERVENTIONS.map((opt) => {
                  const checked = picks.has(opt.id);
                  const iconSize = iconDimensions(opt.icon);
                  return (
                    <label
                      key={opt.id}
                      className={
                        'flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ' +
                        (checked
                          ? 'border-[var(--accent)] bg-[rgba(125,162,255,0.10)]'
                          : 'border-[var(--border)] hover:bg-[rgba(125,162,255,0.05)]')
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-[var(--accent)]"
                        checked={checked}
                        onChange={() => togglePick(opt.id)}
                      />
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                        <Image src={opt.icon ?? '/icons/road-risk.svg'} alt="" {...iconSize} />
                      </span>
                      <div className="flex-1">
                        <div className="font-semibold text-[13px]">{opt.label}</div>
                        <div className="text-[11.5px] text-[var(--ink-muted)]">
                          {opt.description}
                        </div>
                        <div className="text-[11px] text-[var(--ink-soft)] mt-1">
                          CMF {formatPercent(opt.reduction_range[0], 0)}–{formatPercent(opt.reduction_range[1], 0)} · {formatBillion(opt.cost_billion)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {localPrediction ? (
              <ScenarioComparison
                baseline={segment.risk}
                scenarioB={localPrediction.scenario_b_risk}
                scenarioA={serverResult?.scenario_a_risk}
                reduction={localPrediction.reduction_pct}
                cost={localPrediction.cost_billion}
                eadAvoided={localPrediction.ead_avoided}
              />
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={runOnServer}
                disabled={running || picks.size === 0}
                className="glass-panel px-4 py-2 text-[13px] hover:bg-[rgba(125,162,255,0.12)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? '모델 재예측 중…' : 'Scenario A (모델) 함께 돌리기'}
              </button>
              <span className="text-[11.5px] text-[var(--ink-soft)]">
                Scenario B(CMF 근거)는 자동으로 계산되고, Scenario A는 백엔드 모델이 필요해요.
              </span>
            </div>
            {errorMsg ? <div className="text-risk-very-high text-[12px]">{errorMsg}</div> : null}
          </>
        ) : (
          <div className="glass-panel-strong p-10 text-center text-[var(--ink-muted)]">
            구간을 선택해주세요.
          </div>
        )}
      </section>
    </div>
  );
}

function ScenarioComparison({
  baseline,
  scenarioB,
  scenarioA,
  reduction,
  cost,
  eadAvoided,
}: {
  baseline: number;
  scenarioB: number;
  scenarioA?: number;
  reduction: number;
  cost: number;
  eadAvoided: number;
}) {
  const baselineBar: CSSProperties = {
    width: `${(baseline * 100).toFixed(1)}%`,
    backgroundColor: RISK_BAND_COLOR[scoreToBand(baseline)],
  };
  const scenarioBBar: CSSProperties = {
    width: `${(scenarioB * 100).toFixed(1)}%`,
    backgroundColor: RISK_BAND_COLOR[scoreToBand(scenarioB)],
  };
  const scenarioABar: CSSProperties | null = scenarioA !== undefined
    ? { width: `${(scenarioA * 100).toFixed(1)}%`, backgroundColor: RISK_BAND_COLOR[scoreToBand(scenarioA)] }
    : null;
  return (
    <div className="glass-panel px-4 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
          이중 시나리오 비교
        </div>
        <div className="text-[12.5px] text-[var(--ink-muted)]">
          감소률 <span className="text-ink font-semibold">{formatPercent(reduction)}</span> · 소요비 <span className="text-ink font-semibold">{formatBillion(cost)}</span> · EAD 절감 <span className="text-ink font-semibold">{formatNumber(eadAvoided, 2)}</span>
        </div>
      </div>
      <ScenarioRow label="기준" value={baseline} barStyle={baselineBar} />
      <ScenarioRow label="Scenario B · CMF" value={scenarioB} barStyle={scenarioBBar} />
      {scenarioABar && scenarioA !== undefined ? (
        <ScenarioRow label="Scenario A · 모델" value={scenarioA} barStyle={scenarioABar} />
      ) : null}
    </div>
  );
}

function ScenarioRow({
  label,
  value,
  barStyle,
}: {
  label: string;
  value: number;
  barStyle: CSSProperties;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12.5px] mb-1">
        <span className="text-[var(--ink-muted)]">{label}</span>
        <span className="tabular-nums">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[rgba(148,163,184,0.18)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={barStyle} />
      </div>
    </div>
  );
}
