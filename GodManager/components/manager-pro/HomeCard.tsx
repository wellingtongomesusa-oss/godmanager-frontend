'use client';

import Link from 'next/link';
import { MiniDonut } from './MiniDonut';

export type HomeCardProps = {
  label: string;
  badge: string;
  value: string;
  sub1: string;
  sub2: string;
  /** Donut Chart.js 80×80 · cutout 70% · sem legenda (MiniDonut) */
  donutData?: number[];
  donutColors?: string[];
  pills?: string[];
  barColor?: string;
  href?: string;
  /** Estado vazio: valor '—' · donut cinza · botão disabled (mesma anatomia) */
  empty?: boolean;
  /** Texto do botão quando vazio */
  emptyCtaLabel?: string;
};

/** Pills semânticas alinhadas à cor da barra do módulo */
function pillToneClass(barColor: string, neutral: boolean): string {
  if (neutral) return 'mp-pill mp-pill--neutral';
  const b = barColor.toLowerCase();
  if (b.includes('green')) return 'mp-pill mp-pill--green';
  if (b.includes('blue')) return 'mp-pill mp-pill--blue';
  if (b.includes('slate')) return 'mp-pill mp-pill--slate';
  if (b.includes('ink')) return 'mp-pill mp-pill--ink';
  return 'mp-pill mp-pill--amber';
}

export function HomeCard({
  label,
  badge,
  value,
  sub1,
  sub2,
  donutData = [60, 40],
  donutColors,
  pills = [],
  barColor = 'var(--amber)',
  href,
  empty = false,
  emptyCtaLabel = 'Abrir módulo',
}: HomeCardProps) {
  const pillBase = pillToneClass(barColor, empty);

  const inner = (
    <div
      className={`mp-card flex h-full min-h-[200px] flex-col p-4 ${empty ? 'opacity-90' : ''}`}
      style={{ ['--bar-color' as string]: barColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mp-label">{label}</p>
          <span className="mp-badge mt-1 inline-block align-middle">{badge}</span>
        </div>
        <MiniDonut data={empty ? [0, 0] : donutData} colors={donutColors} empty={empty} />
      </div>
      <p className="mp-value mt-3">{empty ? '—' : value}</p>
      <p className="mp-card-sub1 mt-1">{sub1}</p>
      <p className="mp-card-sub2 mt-0.5">{sub2}</p>
      {(pills.length > 0 || empty) && (
        <div className="mt-auto space-y-3 pt-3">
          {pills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pills.map((p) => (
                <span key={p} className={pillBase}>
                  {p}
                </span>
              ))}
            </div>
          )}
          {empty && (
            <button type="button" disabled className="mp-card-cta mp-card-cta--disabled">
              {emptyCtaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (href && !empty) {
    return (
      <Link href={href} className="block h-full transition hover:opacity-[0.97]">
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
}
