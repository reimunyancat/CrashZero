import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  /** Optional small caption shown below the value. */
  hint?: string;
  /** Trend arrow + delta text. */
  delta?: { value: string; positive?: boolean };
  icon?: ReactNode;
  emphasis?: 'default' | 'risk' | 'accent';
}

const EMPHASIS_RING: Record<NonNullable<Props['emphasis']>, string> = {
  default: 'shadow-glow',
  risk: 'shadow-[0_0_36px_rgba(211,64,55,0.22)]',
  accent: 'shadow-glow-strong',
};

export function MetricCard({ label, value, hint, delta, icon, emphasis = 'default' }: Props) {
  const deltaColor = delta?.positive ? 'text-risk-very-low' : 'text-risk-very-high';
  return (
    <div className={`glass-panel px-4 py-3.5 flex flex-col gap-1 ${EMPHASIS_RING[emphasis]}`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">{label}</div>
        {icon ? <div className="opacity-70">{icon}</div> : null}
      </div>
      <div className="text-2xl md:text-[26px] font-semibold tabular-nums leading-tight">
        {value}
      </div>
      <div className="flex items-center justify-between text-[11.5px] text-[var(--ink-muted)]">
        <span>{hint}</span>
        {delta ? (
          <span className={`font-semibold tabular-nums ${deltaColor}`}>
            {delta.positive ? '▲' : '▼'} {delta.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}
