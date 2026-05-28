import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrashZero · 영등포구 도로 위험 예측',
  description:
    '공공데이터 기반 영등포구 교통사고 위험도 예측·시뮬레이션·예산 배분 대시보드',
  applicationName: 'CrashZero',
  authors: [{ name: 'reimunyancat' }],
  icons: { icon: '/icons/road-risk.svg' },
};

export const viewport: Viewport = {
  themeColor: '#070b12',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen text-ink">{children}</body>
    </html>
  );
}
