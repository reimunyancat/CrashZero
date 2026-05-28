// Formatting helpers (currency, percent, dates) — keep locale fixed to ko-KR.

const KRW_BILLION = new Intl.NumberFormat('ko-KR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const KRW_WHOLE = new Intl.NumberFormat('ko-KR');

const PERCENT_1DP = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const DATE_KST = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatBillion(value: number): string {
  return `${KRW_BILLION.format(value)}억`;
}

export function formatWon(value: number): string {
  return `${KRW_WHOLE.format(Math.round(value))}원`;
}

export function formatPercent(ratio: number, dp = 1): string {
  if (Number.isNaN(ratio)) return '–';
  if (dp === 1) return PERCENT_1DP.format(ratio);
  return `${(ratio * 100).toFixed(dp)}%`;
}

export function formatNumber(value: number, dp = 0): string {
  if (Number.isNaN(value)) return '–';
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '–';
  return DATE_KST.format(date);
}

/** Compact KRW (“1.2억” / “350만”). */
export function formatCompactKRW(value: number): string {
  if (value >= 1) return `${value.toFixed(2)}억`;
  if (value >= 0.0001) return `${KRW_WHOLE.format(Math.round(value * 10000))}만`;
  return formatWon(value * 100_000_000);
}

/** Ratio of A to B, safe against zero division. */
export function safeRatio(a: number, b: number): number {
  if (!b || Number.isNaN(b)) return 0;
  return a / b;
}
