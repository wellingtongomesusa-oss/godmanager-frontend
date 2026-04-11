'use client';

import Link from 'next/link';
import { MiniDonut } from './MiniDonut';
import type { MasterOneLocale } from '@/lib/manager-pro/masterOneLocale';
import { tMasterOne } from '@/lib/manager-pro/masterOneStrings';

export type MasterOneKpiCardProps = {
  label: string;
  value: string;
  moduleName: string;
  /** Texto curto: posição no menu / sub-módulos (ex. Properties › Rent Roll) */
  detail?: string;
  href: string;
  barColor: string;
  donutData: number[];
  donutColors?: string[];
  /** Donut cinza quando não há dados (ex. Cards = 0) */
  emptyDonut?: boolean;
  latestUpdate: string;
  locale: MasterOneLocale;
};

export function MasterOneKpiCard({
  label,
  value,
  moduleName,
  detail,
  href,
  barColor,
  donutData,
  donutColors,
  emptyDonut = false,
  latestUpdate,
  locale,
}: MasterOneKpiCardProps) {
  const viewLabel = `${tMasterOne(locale, 'kpi.view')} ${moduleName}`;

  return (
    <div
      className="mp-card mp-card--outlined flex min-h-[180px] flex-col p-4 [--bar-color:var(--kpi-bar)]"
      style={{ ['--kpi-bar' as string]: barColor } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="mp-label">{label}</p>
          {detail ? (
            <p className="mt-1 line-clamp-3 text-[9px] font-medium leading-snug text-[var(--ink2)]">{detail}</p>
          ) : null}
        </div>
        <div className="shrink-0 bg-transparent">
          <MiniDonut data={donutData} colors={donutColors} empty={emptyDonut} />
        </div>
      </div>
      <p className="mp-value mt-2">{value}</p>
      <Link href={href} className="mt-2 text-xs font-semibold text-[var(--blue)] hover:underline">
        {viewLabel}
      </Link>
      <p className="mp-card-sub1 mt-auto pt-3 text-[10px] text-[var(--ink3)]">
        {tMasterOne(locale, 'kpi.latest')} {latestUpdate}
      </p>
    </div>
  );
}
