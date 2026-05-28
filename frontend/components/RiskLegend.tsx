import type { CSSProperties } from 'react';
import { RISK_BAND_COLOR, RISK_BAND_LABEL, RISK_BANDS } from '@/lib/risk';

interface Props {
  /** When provided, segments-per-band counts are rendered next to the swatch. */
  counts?: Record<string, number>;
  /** Layout direction. */
  orientation?: 'horizontal' | 'vertical';
}

export function RiskLegend({ counts, orientation = 'horizontal' }: Props) {
  const wrap =
    orientation === 'horizontal'
      ? 'flex flex-wrap items-center gap-x-4 gap-y-2'
      : 'flex flex-col gap-2';

  return (
    <div className={wrap}>
      <span className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
        위험도 밴드
      </span>
      {RISK_BANDS.map((band) => {
        const swatchStyle: CSSProperties = { backgroundColor: RISK_BAND_COLOR[band] };
        return (
          <div key={band} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="inline-block h-2 w-5 rounded-sm"
              style={swatchStyle}
              aria-hidden
            />
            <span className="text-[var(--ink)]">{RISK_BAND_LABEL[band]}</span>
            {counts ? (
              <span className="text-[var(--ink-soft)] tabular-nums">
                {counts[band]?.toLocaleString('ko-KR') ?? 0}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
