'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: string;
  matches: (pathname: string) => boolean;
}> = [
  {
    href: '/',
    label: '위험도 지도',
    icon: '/icons/road-risk.svg',
    matches: (p) => p === '/',
  },
  {
    href: '/whatif',
    label: 'What-if 시뮬레이션',
    icon: '/icons/traffic-cone.svg',
    matches: (p) => p.startsWith('/whatif'),
  },
  {
    href: '/budget',
    label: '예산 배분',
    icon: '/icons/median-barrier.svg',
    matches: (p) => p.startsWith('/budget'),
  },
];

const SECONDARY_NAV: Array<{ href: string; label: string; icon: string }> = [
  { href: '/?layer=crosswalks', label: '표지/횡단보도 점검', icon: '/icons/crosswalk.svg' },
  { href: '/?layer=child', label: '어린이 보호구역', icon: '/icons/child-zone.svg' },
  { href: '/?layer=signal', label: '신호교차로', icon: '/icons/traffic-signal.svg' },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';

  return (
    <div className="flex min-h-screen text-ink">
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-6 px-5 py-7 border-r border-[rgba(148,163,184,0.10)] bg-[rgba(7,11,18,0.6)] backdrop-blur-md">
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(125,162,255,0.18)] shadow-glow">
            <Image src="/icons/road-risk.svg" alt="CrashZero" width={20} height={18} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide">CrashZero</div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
              Yeongdeungpo Lab
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.matches(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                className={
                  'nav-pill flex items-center gap-2.5 ' +
                  (active ? '' : 'hover:bg-[rgba(125,162,255,0.10)] hover:text-ink')
                }
              >
                <Image src={item.icon} alt="" width={18} height={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-2">
          <div className="px-2 text-[11px] uppercase tracking-widest text-[var(--ink-soft)] mb-2">
            세부 레이어
          </div>
          <nav className="flex flex-col gap-1">
            {SECONDARY_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="nav-pill flex items-center gap-2.5 hover:bg-[rgba(125,162,255,0.10)] hover:text-ink"
              >
                <Image src={item.icon} alt="" width={18} height={18} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto glass-panel-strong px-3 py-3 text-[11.5px] leading-relaxed text-[var(--ink-muted)]">
          <div className="font-semibold text-ink mb-1">데이터 소스</div>
          KOROAD · V-World · KMA · OpenStreetMap·
          <span className="text-[var(--accent)]"> docs/DATA_SOURCES.md</span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between gap-4 px-6 md:px-10 py-5 border-b border-[rgba(148,163,184,0.10)] bg-[rgba(7,11,18,0.55)] backdrop-blur-md">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[var(--ink-soft)]">
              Seoul · Yeongdeungpo-gu
            </div>
            <h1 className="text-xl md:text-2xl font-semibold mt-0.5">
              {NAV_ITEMS.find((n) => n.matches(pathname))?.label ?? '위험도 지도'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 glass-panel px-3 py-1.5 text-[12.5px] text-[var(--ink-muted)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-glow" />
              실시간 예측 v1.0
            </div>
            <Link
              href="/?refresh=1"
              className="glass-panel px-3 py-1.5 text-[12.5px] hover:bg-[rgba(125,162,255,0.10)]"
            >
              새로고침
            </Link>
          </div>
        </header>

        <section className="flex-1 px-4 md:px-8 py-6 md:py-8 scrollbar-thin overflow-x-hidden">
          {children}
        </section>
      </main>
    </div>
  );
}
