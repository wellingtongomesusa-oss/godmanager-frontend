import { setRequestLocale } from 'next-intl/server';
import SubscribeForm, { type SubscribeInitial } from '@/components/marketing/SubscribeForm';
import { SiteFooter } from '@/components/marketing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import type { BusinessSegment } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID: BusinessSegment[] = ['LONG_TERM', 'SHORT_TERM', 'HOSPITALITY', 'REALTOR', 'INSURANCE'];

function num(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export default function SubscribePage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  setRequestLocale(locale);

  const segRaw = String(
    (Array.isArray(searchParams.segment) ? searchParams.segment[0] : searchParams.segment) || '',
  ).toUpperCase();
  const initial: SubscribeInitial = {
    segment: VALID.includes(segRaw as BusinessSegment) ? (segRaw as BusinessSegment) : undefined,
    packageTier: num(searchParams.packageTier),
    avgRent: num(searchParams.avgRent),
    avgVgv: num(searchParams.avgVgv),
    unitCount: num(searchParams.unitCount),
    interval:
      String(
        (Array.isArray(searchParams.interval) ? searchParams.interval[0] : searchParams.interval) ||
          '',
      ).toUpperCase() === 'ANNUAL'
        ? 'ANNUAL'
        : undefined,
  };

  return (
    <>
      <SiteHeader active="savings" />
      <main style={{ paddingTop: 64 }}>
        <SubscribeForm initial={initial} />
      </main>
      <SiteFooter />
    </>
  );
}
