"use client";

import { useEffect, useMemo, useState } from "react";
import { MapRiskView } from "./MapRiskView";
import { MetricCard } from "./MetricCard";
import { RiskLegend } from "./RiskLegend";
import { SegmentDetailPanel } from "./SegmentDetailPanel";
import { fetchHeatmap, isFixtureMode } from "@/lib/api";
import type {
  RiskBand,
  RiskHeatmap,
  RoadSegment,
  WeatherFilter,
} from "@/lib/types";
import {
  applyEnvironmentalFilter,
  countByBand,
  estimateAnnualCrashes,
  filterByBand,
  RISK_BAND_LABEL,
  RISK_BANDS,
} from "@/lib/risk";
import { formatNumber, formatPercent } from "@/lib/format";

const WEATHER_LABELS: Array<{
  key: WeatherFilter["condition"];
  label: string;
}> = [
  { key: "all", label: "전체" },
  { key: "clear", label: "맑음" },
  { key: "rain", label: "비" },
  { key: "snow", label: "눈" },
  { key: "fog", label: "안개" },
];

const TIME_LABELS: Array<{ key: WeatherFilter["time_of_day"]; label: string }> =
  [
    { key: "all", label: "전체" },
    { key: "morning", label: "아침 (07–10)" },
    { key: "day", label: "낮 (10–17)" },
    { key: "evening", label: "저녁 (17–20)" },
    { key: "night", label: "야간 (20–07)" },
  ];

export function SimulatorWorkspace() {
  const [data, setData] = useState<RiskHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bandFilter, setBandFilter] = useState<Set<RiskBand>>(
    () => new Set<RiskBand>(["very_high", "high", "medium"]),
  );
  const [envFilter, setEnvFilter] = useState<WeatherFilter>({
    condition: "all",
    time_of_day: "all",
  });
  const [selected, setSelected] = useState<RoadSegment | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchHeatmap()
      .then((heat) => {
        if (cancelled) return;
        setData(heat);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // === Filter pipeline (env multiplier → band gate) ===
  const adjustedSegments: RoadSegment[] = useMemo(() => {
    if (!data) return [];
    return applyEnvironmentalFilter(data.features, envFilter);
  }, [data, envFilter]);

  const visibleSegments = useMemo(
    () => filterByBand(adjustedSegments, bandFilter),
    [adjustedSegments, bandFilter],
  );

  const counts = useMemo(
    () => countByBand(adjustedSegments),
    [adjustedSegments],
  );
  const predictedCrashes = useMemo(
    () => estimateAnnualCrashes(adjustedSegments),
    [adjustedSegments],
  );
  const highRiskShare = adjustedSegments.length
    ? (counts.very_high + counts.high) / adjustedSegments.length
    : 0;

  function toggleBand(band: RiskBand) {
    setBandFilter((prev) => {
      const next = new Set(prev);
      if (next.has(band)) next.delete(band);
      else next.add(band);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="분석 구간"
          value={formatNumber(adjustedSegments.length)}
          hint={`영등포구 전체 도로 로드`}
        />
        <MetricCard
          label="고위험 구간"
          value={formatNumber(counts.very_high + counts.high)}
          hint={`전체 대비 ${formatPercent(highRiskShare)}`}
          emphasis="risk"
        />
        <MetricCard
          label="사고다발구역"
          value={formatNumber(data?.blackspots.length ?? 0)}
          hint={`KOROAD ${data?.source_year ?? "–"} 기준`}
        />
        <MetricCard
          label="연간 예측 사고"
          value={formatNumber(predictedCrashes, 1)}
          hint={`EAD 기반 집계`}
          emphasis="accent"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 flex-1 min-h-0">
        {/* Map column */}
        <div className="flex flex-col gap-3 min-h-[520px]">
          <div className="glass-panel px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-muted)]">
              <span className="uppercase tracking-widest text-[11px] text-[var(--ink-soft)]">
                날씨
              </span>
              {WEATHER_LABELS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() =>
                    setEnvFilter((p) => ({ ...p, condition: w.key }))
                  }
                  className={
                    "px-2.5 py-1 rounded-md text-[12.5px] transition-colors " +
                    (envFilter.condition === w.key
                      ? "bg-[rgba(125,162,255,0.18)] text-ink shadow-glow"
                      : "hover:bg-[rgba(125,162,255,0.08)]")
                  }
                >
                  {w.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-muted)] ml-auto">
              <span className="uppercase tracking-widest text-[11px] text-[var(--ink-soft)]">
                시간대
              </span>
              {TIME_LABELS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() =>
                    setEnvFilter((p) => ({ ...p, time_of_day: t.key }))
                  }
                  className={
                    "px-2.5 py-1 rounded-md text-[12.5px] transition-colors " +
                    (envFilter.time_of_day === t.key
                      ? "bg-[rgba(125,162,255,0.18)] text-ink shadow-glow"
                      : "hover:bg-[rgba(125,162,255,0.08)]")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 relative min-h-[420px]">
            {loading ? (
              <div className="absolute inset-0 grid place-items-center glass-panel-strong">
                <span className="text-[var(--ink-muted)]">
                  지도 데이터 불러오는 중…
                </span>
              </div>
            ) : error ? (
              <div className="absolute inset-0 grid place-items-center glass-panel-strong">
                <div className="text-center px-6">
                  <div className="text-risk-very-high font-semibold mb-1">
                    데이터 연결 실패
                  </div>
                  <div className="text-[12.5px] text-[var(--ink-muted)]">
                    {error}
                  </div>
                  <div className="text-[12px] text-[var(--ink-soft)] mt-2">
                    `NEXT_PUBLIC_USE_FIXTURE=true`로 행을 대체해 데모 모드로
                    이탈하세요.
                  </div>
                </div>
              </div>
            ) : (
              <MapRiskView
                segments={visibleSegments}
                selectedLinkId={selected?.link_id ?? null}
                onSelect={setSelected}
              />
            )}
          </div>

          <div className="glass-panel px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {RISK_BANDS.map((band) => {
                const active = bandFilter.has(band);
                return (
                  <button
                    key={band}
                    type="button"
                    onClick={() => toggleBand(band)}
                    className={
                      "risk-pill " +
                      (active ? "" : "opacity-40 hover:opacity-70")
                    }
                    style={{
                      backgroundColor: active
                        ? "rgba(125,162,255,0.10)"
                        : "transparent",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          band === "very_high"
                            ? "#D34037"
                            : band === "high"
                              ? "#E6A14A"
                              : band === "medium"
                                ? "#EAE065"
                                : band === "low"
                                  ? "#9ACA83"
                                  : "#80B971",
                      }}
                    />
                    {RISK_BAND_LABEL[band]}
                    <span className="text-[var(--ink-soft)] tabular-nums">
                      {counts[band].toLocaleString("ko-KR")}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="ml-auto text-[11.5px] text-[var(--ink-soft)]">
              {isFixtureMode() ? "fixture 모드 · " : ""}
              날씨·시간대 필터는 곱셈적으로 적용돼요.
            </div>
          </div>
        </div>

        {/* Side panel */}
        <aside className="flex flex-col gap-3 min-w-0">
          <SegmentDetailPanel
            segment={selected}
            blackspots={data?.blackspots ?? []}
          />
          <div className="glass-panel px-4 py-4">
            <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)] mb-2">
              클래스 분포
            </div>
            <RiskLegend counts={counts} orientation="vertical" />
          </div>
        </aside>
      </div>
    </div>
  );
}
