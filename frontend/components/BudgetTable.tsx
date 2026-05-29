"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { fetchHeatmap, runBudget } from "@/lib/api";
import { INTERVENTION_CATALOG } from "@/lib/cmf";
import { rankInterventionsForSegment } from "@/lib/dualScenario";
import type { BudgetResult, BudgetRow, RoadSegment } from "@/lib/types";
import { colorForScore } from "@/lib/risk";
import { formatBillion, formatNumber, formatPercent } from "@/lib/format";

function localGreedyBudget(
  segments: RoadSegment[],
  budgetBillion: number,
  topN: number,
): BudgetResult {
  const pool = [...segments].sort((a, b) => b.risk - a.risk).slice(0, topN);
  const candidates: Array<{
    segment: RoadSegment;
    intervention: ReturnType<typeof rankInterventionsForSegment>[number];
  }> = [];
  pool.forEach((segment) => {
    const ranked = rankInterventionsForSegment(segment);
    if (ranked[0]) candidates.push({ segment, intervention: ranked[0] });
  });
  candidates.sort(
    (a, b) => a.intervention.cost_per_ead - b.intervention.cost_per_ead,
  );

  const rows: BudgetRow[] = [];
  let spent = 0;
  let totalEad = 0;
  for (const c of candidates) {
    if (spent + c.intervention.cost > budgetBillion) continue;
    spent += c.intervention.cost;
    totalEad += c.intervention.ead_avoided;
    rows.push({
      rank: rows.length + 1,
      link_id: c.segment.link_id,
      link_name: c.segment.name ?? c.segment.highway,
      intervention: c.intervention.id,
      cost_billion: c.intervention.cost,
      ead_avoided: c.intervention.ead_avoided,
      cost_per_ead: c.intervention.cost_per_ead,
      cumulative_cost: spent,
      cumulative_avoided: totalEad,
      scenario_b_risk_after: Math.max(
        0,
        c.segment.risk - c.intervention.ead_avoided,
      ),
    });
    if (spent >= budgetBillion - 0.05) break;
  }
  return {
    total_budget_billion: budgetBillion,
    spent_billion: spent,
    total_avoided: totalEad,
    rows,
  } as BudgetResult;
}

export function BudgetTable() {
  const [budget, setBudget] = useState<number>(48);
  const [topN, setTopN] = useState<number>(60);
  const [segments, setSegments] = useState<RoadSegment[]>([]);
  const [result, setResult] = useState<BudgetResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverSourced, setServerSourced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHeatmap()
      .then((heat) => {
        if (cancelled) return;
        setSegments(heat.features);
        // Initial local greedy plan so the table is never empty.
        setResult(localGreedyBudget(heat.features, 48, 60));
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "데이터 로드 실패"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function recomputeLocal(nextBudget = budget, nextTop = topN) {
    if (!segments.length) return;
    setResult(localGreedyBudget(segments, nextBudget, nextTop));
    setServerSourced(false);
  }

  async function runOnServer() {
    if (!segments.length) return;
    setRunning(true);
    setError(null);
    try {
      const candidates = segments.map((s) => ({
        link_id: s.link_id,
        interventions: [],
      })); // mock candidates to satisfy type
      const res = await runBudget({
        total_budget_billion: budget,
        candidates,
        strategy: "greedy",
      });
      setResult(res);
      setServerSourced(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "서버 요청 실패");
    } finally {
      setRunning(false);
    }
  }

  const reductionRate = useMemo(() => {
    if (!result || !result.spent_billion) return 0;
    return result.total_avoided / Math.max(0.0001, result.spent_billion);
  }, [result]);

  if (loading) {
    return (
      <div className="glass-panel-strong p-10 text-center text-[var(--ink-muted)]">
        데이터 불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel px-4 py-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[12.5px] text-[var(--ink-muted)]">
          <span className="uppercase tracking-widest text-[11px] text-[var(--ink-soft)]">
            예산 (억원)
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value) || 0)}
            onBlur={() => recomputeLocal()}
            className="glass-panel px-3 py-1.5 w-32 text-[15px] tabular-nums focus:outline-none focus:shadow-glow"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-[var(--ink-muted)]">
          <span className="uppercase tracking-widest text-[11px] text-[var(--ink-soft)]">
            고려 구간 수
          </span>
          <input
            type="number"
            min={10}
            max={500}
            step={10}
            value={topN}
            onChange={(e) => setTopN(Number(e.target.value) || 0)}
            onBlur={() => recomputeLocal()}
            className="glass-panel px-3 py-1.5 w-32 text-[15px] tabular-nums focus:outline-none focus:shadow-glow"
          />
        </label>
        <button
          type="button"
          onClick={() => recomputeLocal()}
          className="glass-panel px-4 py-2 text-[13px] hover:bg-[rgba(125,162,255,0.12)]"
        >
          로컬 재산친
        </button>
        <button
          type="button"
          onClick={runOnServer}
          disabled={running}
          className="glass-panel px-4 py-2 text-[13px] hover:bg-[rgba(125,162,255,0.12)] disabled:opacity-40"
        >
          {running ? "모델 재계산 중…" : "Scenario A (모델) 결과로 교체"}
        </button>
        <div className="ml-auto text-[11.5px] text-[var(--ink-soft)]">
          결과 소스:{" "}
          {serverSourced ? "백엔드 모델" : "클라이언트 greedy (Scenario B)"}
        </div>
      </div>

      {error ? (
        <div className="glass-panel-strong px-4 py-3 text-risk-very-high text-[12.5px]">
          {error}
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="집행 예산"
              value={formatBillion(result.spent_billion)}
              hint={`잔여 ${formatBillion(result.total_budget_billion - result.spent_billion)}`}
            />
            <SummaryCard
              label="구간 수"
              value={formatNumber(result.rows.length)}
              hint={`고려 ${topN}구간 중 선정`}
            />
            <SummaryCard
              label="연간 EAD 절감"
              value={formatNumber(result.total_avoided, 2)}
              hint="Expected Annual Damage"
            />
            <SummaryCard
              label="EAD / 1억원"
              value={formatNumber(reductionRate, 3)}
              hint="투자 효율"
            />
          </div>

          <div className="glass-panel overflow-x-auto scrollbar-thin">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] border-b border-[var(--border)]">
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">구간</th>
                  <th className="text-left px-3 py-2">개선안</th>
                  <th className="text-right px-3 py-2">기준 위험</th>
                  <th className="text-right px-3 py-2">비용</th>
                  <th className="text-right px-3 py-2">EAD 절감</th>
                  <th className="text-right px-3 py-2">누적 비용</th>
                  <th className="text-right px-3 py-2">누적 EAD</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => {
                  const opt = INTERVENTION_CATALOG[row.intervention];
                  const dot: CSSProperties = {
                    backgroundColor: colorForScore(row.scenario_b_risk_after),
                  };
                  return (
                    <tr
                      key={`${row.link_id}-${row.intervention}`}
                      className="border-b border-[rgba(148,163,184,0.06)] hover:bg-[rgba(125,162,255,0.04)]"
                    >
                      <td className="px-3 py-2 text-[var(--ink-soft)] tabular-nums">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={dot}
                          />
                          <div>
                            <div className="text-[var(--ink)]">
                              {row.link_name}
                            </div>
                            <div className="text-[11px] text-[var(--ink-soft)]">
                              L{row.link_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          {opt?.icon ? (
                            <Image
                              src={opt.icon}
                              alt=""
                              width={14}
                              height={14}
                            />
                          ) : null}
                          {opt?.label ?? row.intervention}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(row.scenario_b_risk_after)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatBillion(row.cost_billion)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-risk-very-low">
                        {formatNumber(row.ead_avoided, 2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-muted)]">
                        {formatBillion(row.cumulative_cost)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--ink-muted)]">
                        {formatNumber(row.cumulative_avoided, 2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-panel px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-widest text-[var(--ink-soft)]">
        {label}
      </div>
      <div className="text-[20px] font-semibold tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[11px] text-[var(--ink-muted)]">{hint}</div>
    </div>
  );
}
