'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { MasterOneKpiCard } from '@/components/manager-pro/MasterOneKpiCard';
import { useMasterOneLocale } from '@/components/manager-pro/MasterOneContext';
import type { MasterOneLocale } from '@/lib/manager-pro/masterOneLocale';

type Bilingual = { en: string; pt: string };

type KpiDef = {
  label: Bilingual;
  value: string;
  moduleName: Bilingual;
  /** Onde aparece no menu lateral + sub-itens */
  detail: Bilingual;
  href: string;
  barColor: string;
  donutData: number[];
  donutColors?: string[];
  emptyDonut?: boolean;
};

type KpiSection = { title: Bilingual; items: KpiDef[] };

/** Um cartão por destino do menu (inclui sub-rotas), alinhado a `MASTER_ONE_NAV` */
const HOME_KPI_SECTIONS: KpiSection[] = [
  {
    title: { en: 'Main', pt: 'Principal' },
    items: [
      {
        label: { en: 'NEWS', pt: 'NEWS' },
        value: '12',
        moduleName: { en: 'News', pt: 'Notícias' },
        detail: {
          en: 'Sidebar: NEWS · News panel on GodManager.One',
          pt: 'Menu: NEWS · Painel de Notícias no GodManager.One',
        },
        href: '/manager-pro/news',
        barColor: '#22558c',
        donutData: [12, 4],
        donutColors: ['#22558c', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Properties', pt: 'Properties' },
    items: [
      {
        label: { en: 'All properties', pt: 'Todas as propriedades' },
        value: '975',
        moduleName: { en: 'Properties', pt: 'Propriedades' },
        detail: {
          en: 'Menu: Properties ▸ All properties · /properties',
          pt: 'Menu: Properties ▸ Todas as propriedades · /properties',
        },
        href: '/manager-pro/properties',
        barColor: '#1e160c',
        donutData: [975, 120],
        donutColors: ['#1e160c', '#e2d9cc'],
      },
      {
        label: { en: 'Managed amount', pt: 'Valor gerenciado' },
        value: '$0',
        moduleName: { en: 'Portfolio', pt: 'Portfólio' },
        detail: {
          en: 'KPI linked to Properties module · CSV / grid',
          pt: 'KPI ligado ao módulo Properties · CSV / grelha',
        },
        href: '/manager-pro/properties',
        barColor: '#22558c',
        donutData: [1, 99],
        donutColors: ['#22558c', '#e2d9cc'],
      },
      {
        label: { en: 'DP / DP+', pt: 'DP / DP+' },
        value: '240',
        moduleName: { en: 'DP', pt: 'DP' },
        detail: {
          en: 'Menu: Properties ▸ DP / DP+',
          pt: 'Menu: Properties ▸ DP / DP+',
        },
        href: '/manager-pro/dp',
        barColor: '#c47b28',
        donutData: [240, 60],
        donutColors: ['#c47b28', '#e2d9cc'],
      },
      {
        label: { en: 'Long Term', pt: 'Long Term' },
        value: '1.248',
        moduleName: { en: 'Long Term', pt: 'Long Term' },
        detail: {
          en: 'Menu: Properties ▸ Long Term (Rent Roll route) · units & tenants',
          pt: 'Menu: Properties ▸ Long Term (rota Rent Roll) · unidades e inquilinos',
        },
        href: '/manager-pro/rent-roll',
        barColor: '#4a5568',
        donutData: [1248, 200],
        donutColors: ['#4a5568', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Operations', pt: 'Operações' },
    items: [
      {
        label: { en: 'Renovations', pt: 'Renovations' },
        value: '23',
        moduleName: { en: 'Renovations', pt: 'Renovations' },
        detail: {
          en: 'Menu: Renovations · 5 in progress (sub-KPI)',
          pt: 'Menu: Renovations · 5 em progresso (sub-KPI)',
        },
        href: '/manager-pro/renovations',
        barColor: '#c47b28',
        donutData: [23, 8],
        donutColors: ['#c47b28', '#e2d9cc'],
      },
      {
        label: { en: 'Housekeeper / Cleaners', pt: 'Housekeeper / Cleaners' },
        value: '1.959',
        moduleName: { en: 'Cleaners', pt: 'Cleaners' },
        detail: {
          en: 'Menu: Cleaners ▸ Housekeeper / Cleaners',
          pt: 'Menu: Cleaners ▸ Housekeeper / Cleaners',
        },
        href: '/manager-pro/housekeeper',
        barColor: '#2d7252',
        donutData: [1959, 400],
        donutColors: ['#2d7252', '#e2d9cc'],
      },
      {
        label: { en: 'RACI Finance', pt: 'RACI Financeiro' },
        value: '48',
        moduleName: { en: 'RACI', pt: 'RACI' },
        detail: {
          en: 'Menu: Cleaners ▸ RACI Finance',
          pt: 'Menu: Cleaners ▸ RACI Financeiro',
        },
        href: '/manager-pro/raci',
        barColor: '#b5601a',
        donutData: [48, 12],
        donutColors: ['#b5601a', '#e2d9cc'],
      },
      {
        label: { en: 'Contractors', pt: 'Contractors' },
        value: '106',
        moduleName: { en: 'Contractors', pt: 'Contractors' },
        detail: {
          en: 'Menu: Contractors ▸ Contractors',
          pt: 'Menu: Contractors ▸ Contractors',
        },
        href: '/manager-pro/extra/contractors',
        barColor: '#4a5568',
        donutData: [106, 40],
        donutColors: ['#4a5568', '#e2d9cc'],
      },
      {
        label: { en: '1099 / IRS', pt: '1099 / IRS' },
        value: '88',
        moduleName: { en: '1099 / IRS', pt: '1099 / IRS' },
        detail: {
          en: 'Menu: Contractors ▸ 1099 / IRS',
          pt: 'Menu: Contractors ▸ 1099 / IRS',
        },
        href: '/manager-pro/irs1099',
        barColor: '#b83030',
        donutData: [88, 20],
        donutColors: ['#b83030', '#e2d9cc'],
      },
      {
        label: { en: '(Loans)', pt: '(Loans)' },
        value: '$1.2M',
        moduleName: { en: 'Loans', pt: 'Loans' },
        detail: {
          en: 'Menu: (Loans) · /extra/loans',
          pt: 'Menu: (Loans) · /extra/loans',
        },
        href: '/manager-pro/extra/loans',
        barColor: '#22558c',
        donutData: [72, 28],
        donutColors: ['#22558c', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Payroll & payouts', pt: 'Payroll e payouts' },
    items: [
      {
        label: { en: 'Payroll', pt: 'Payroll' },
        value: '32',
        moduleName: { en: 'Payroll', pt: 'Payroll' },
        detail: {
          en: 'Menu: Payroll ▸ Payroll',
          pt: 'Menu: Payroll ▸ Payroll',
        },
        href: '/manager-pro/extra/payroll',
        barColor: '#c47b28',
        donutData: [32, 18],
        donutColors: ['#c47b28', '#e2d9cc'],
      },
      {
        label: { en: 'Upcoming Payouts', pt: 'Próximos Payouts' },
        value: '14',
        moduleName: { en: 'Payouts', pt: 'Payouts' },
        detail: {
          en: 'Menu: Payroll ▸ Payouts · also under Agencies',
          pt: 'Menu: Payroll ▸ Payouts · também em Agencies',
        },
        href: '/manager-pro/payouts',
        barColor: '#2d7252',
        donutData: [14, 6],
        donutColors: ['#2d7252', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Licenses & stock', pt: 'Licenças e stock' },
    items: [
      {
        label: { en: 'Licenses', pt: 'Licenses' },
        value: '712',
        moduleName: { en: 'Licenses', pt: 'Licenças' },
        detail: {
          en: 'Menu: Licenses ▸ Licenses · corporate registry',
          pt: 'Menu: Licenses ▸ Licenses · registo empresarial',
        },
        href: '/manager-pro/licenses',
        barColor: '#2d7252',
        donutData: [520, 120, 72],
        donutColors: ['#2d7252', '#c47b28', '#b83030'],
      },
      {
        label: { en: 'Stock', pt: 'Stock' },
        value: '342',
        moduleName: { en: 'Stock', pt: 'Stock' },
        detail: {
          en: 'Menu: Stock ▸ Stock · /extra/stock',
          pt: 'Menu: Stock ▸ Stock · /extra/stock',
        },
        href: '/manager-pro/extra/stock',
        barColor: '#4a5568',
        donutData: [342, 80],
        donutColors: ['#4a5568', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Cards & logs', pt: 'Cartões e logs' },
    items: [
      {
        label: { en: 'Divvy', pt: 'Divvy' },
        value: '1.773',
        moduleName: { en: 'Divvy', pt: 'Divvy' },
        detail: {
          en: 'Menu: Divvy · expenses',
          pt: 'Menu: Divvy · despesas',
        },
        href: '/manager-pro/extra/divvy',
        barColor: '#c47b28',
        donutData: [1773, 300],
        donutColors: ['#c47b28', '#e2d9cc'],
      },
      {
        label: { en: 'MonthLog', pt: 'MonthLog' },
        value: '4.165',
        moduleName: { en: 'Month Log', pt: 'Month Log' },
        detail: {
          en: 'Menu: MonthLog · monthly operations',
          pt: 'Menu: MonthLog · operações mensais',
        },
        href: '/manager-pro/extra/month-log',
        barColor: '#4a5568',
        donutData: [4165, 800],
        donutColors: ['#4a5568', '#e2d9cc'],
      },
      {
        label: { en: 'Cards', pt: 'Cards' },
        value: '0',
        moduleName: { en: 'Cards', pt: 'Cards' },
        detail: {
          en: 'Menu: Cards · corporate cards',
          pt: 'Menu: Cards · cartões corporativos',
        },
        href: '/manager-pro/extra/cards',
        barColor: '#22558c',
        donutData: [0, 0],
        emptyDonut: true,
      },
    ],
  },
  {
    title: { en: 'Fleet', pt: 'Frota' },
    items: [
      {
        label: { en: 'Cars', pt: 'Cars' },
        value: '65',
        moduleName: { en: 'Cars', pt: 'Cars' },
        detail: {
          en: 'Menu: Cars · fleet + VIN dedup',
          pt: 'Menu: Cars · frota + dedup VIN',
        },
        href: '/manager-pro/cars',
        barColor: '#22558c',
        donutData: [65, 20],
        donutColors: ['#22558c', '#e2d9cc'],
      },
      {
        label: { en: 'Insurance', pt: 'Insurance' },
        value: '65',
        moduleName: { en: 'Insurance', pt: 'Insurance' },
        detail: {
          en: 'Menu: Insurance · /extra/insurance',
          pt: 'Menu: Insurance · /extra/insurance',
        },
        href: '/manager-pro/extra/insurance',
        barColor: '#2d7252',
        donutData: [65, 15],
        donutColors: ['#2d7252', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Long term', pt: 'Longo prazo' },
    items: [
      {
        label: { en: 'Long Term', pt: 'Long Term' },
        value: '96',
        moduleName: { en: 'Long Term', pt: 'Long Term' },
        detail: {
          en: 'Menu: Long Term ▸ Long Term',
          pt: 'Menu: Long Term ▸ Long Term',
        },
        href: '/manager-pro/extra/long-term',
        barColor: '#2d7252',
        donutData: [96, 24],
        donutColors: ['#2d7252', '#e2d9cc'],
      },
    ],
  },
  {
    title: { en: 'Agencies/Reservation', pt: 'Agências/Reservas' },
    items: [
      {
        label: { en: 'Reservations', pt: 'Reservations' },
        value: '428',
        moduleName: { en: 'Reservations', pt: 'Reservations' },
        detail: {
          en: 'Menu: Agencies/Reservation ▸ Reservations',
          pt: 'Menu: Agências/Reservas ▸ Reservations',
        },
        href: '/manager-pro/reservations',
        barColor: '#22558c',
        donutData: [428, 100],
        donutColors: ['#22558c', '#e2d9cc'],
      },
      {
        label: { en: 'Agencies · Payouts', pt: 'Agências · Payouts' },
        value: '14',
        moduleName: { en: 'Payouts (Agencies)', pt: 'Payouts (Agências)' },
        detail: {
          en: 'Menu: Agencies/Reservation ▸ Payouts · same module as Payroll › Payouts',
          pt: 'Menu: Agências/Reservas ▸ Payouts · mesmo módulo que Payroll › Payouts',
        },
        href: '/manager-pro/payouts',
        barColor: '#c47b28',
        donutData: [14, 6],
        donutColors: ['#c47b28', '#e2d9cc'],
      },
    ],
  },
];

function pick<T extends Bilingual>(b: T, locale: MasterOneLocale): string {
  return b[locale];
}

function formatLatest(locale: MasterOneLocale): string {
  const d = new Date();
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

const EXPECTED_UI_MARKER = 'godmanager-ui-v2-godmanager-one';

export default function ManagerProHomePage() {
  const locale = useMasterOneLocale();
  const [latest, setLatest] = useState<string>('');
  const [uiProbe, setUiProbe] = useState<'loading' | 'ok' | 'bad'>('loading');

  const totalKpis = useMemo(
    () => HOME_KPI_SECTIONS.reduce((n, s) => n + s.items.length, 0),
    [],
  );

  useEffect(() => {
    setLatest(formatLatest(locale));
    const id = setInterval(() => setLatest(formatLatest(locale)), 60_000);
    return () => clearInterval(id);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/godmanager-ui.txt?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => {
        if (cancelled) return;
        setUiProbe(text.includes(EXPECTED_UI_MARKER) ? 'ok' : 'bad');
      })
      .catch(() => {
        if (!cancelled) setUiProbe('bad');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = useMemo(() => {
    return locale === 'pt'
      ? `Visão geral GodManager.One · ${totalKpis} KPIs alinhados ao menu lateral (donut 80×80px)`
      : `GodManager.One overview · ${totalKpis} KPIs aligned with sidebar (80×80px donuts)`;
  }, [locale, totalKpis]);

  return (
    <div>
      {uiProbe === 'bad' && (
        <div
          className="mb-4 rounded-lg border-2 border-red-600 bg-red-50 p-4 text-sm text-red-900"
          role="alert"
        >
          <p className="font-bold">
            {locale === 'pt'
              ? 'Este servidor não está a usar o código novo do GodManager.One.'
              : 'This server is NOT running the new GodManager.One code.'}
          </p>
          <p className="mt-2">
            {locale === 'pt' ? (
              <>
                1) Pare o <code className="rounded bg-white px-1">next dev</code>. <br />
                2) No terminal:{' '}
                <code className="mt-1 block whitespace-pre-wrap rounded bg-white p-2 text-xs">
                  cd …/cursor-projects/GodManager{'\n'}
                  rm -rf .next{'\n'}
                  npm run dev
                </code>
                <span className="mt-1 block text-xs">
                  (pasta onde existe <code>public/godmanager-ui.txt</code> no Cursor)
                </span>
                <br />
                3) Abra{' '}
                <a className="font-semibold underline" href="/godmanager-ui.txt" target="_blank" rel="noreferrer">
                  /godmanager-ui.txt
                </a>{' '}
                — a primeira linha deve ser <code>{EXPECTED_UI_MARKER}</code>.
              </>
            ) : (
              <>
                Stop <code className="rounded bg-white px-1">next dev</code>, then run from{' '}
                <strong>cursor-projects/GodManager</strong>, delete <code>.next</code>, and{' '}
                <code>npm run dev</code>. Open <a className="underline" href="/godmanager-ui.txt">/godmanager-ui.txt</a> — first line
                must be <code>{EXPECTED_UI_MARKER}</code>.
              </>
            )}
          </p>
        </div>
      )}
      {uiProbe === 'ok' && (
        <p className="mb-3 rounded-lg border border-green-600/40 bg-green-50/80 px-3 py-2 text-xs font-medium text-green-900">
          {locale === 'pt'
            ? `UI GodManager.One ativa (${EXPECTED_UI_MARKER}).`
            : `GodManager.One UI active (${EXPECTED_UI_MARKER}).`}
        </p>
      )}

      <h1 className="text-xl font-bold text-[var(--ink)]">
        {locale === 'pt' ? 'Início' : 'Home'}
      </h1>
      <p className="mt-1 text-sm text-[var(--ink2)]">{subtitle}</p>

      <div className="mt-4 flex flex-wrap gap-2 rounded-xl border-2 border-[#2d7252] bg-[#ecfdf5] p-3 shadow-sm">
        <span className="w-full text-[10px] font-bold uppercase tracking-wider text-[#166534]">
          {locale === 'pt' ? 'Acesso rápido (atualizações recentes)' : 'Quick links (recent updates)'}
        </span>
        <Link
          href="/manager-pro/licenses"
          className="inline-flex items-center rounded-lg bg-[#2d7252] px-4 py-2 text-sm font-bold text-white shadow hover:bg-[#256045]"
        >
          {locale === 'pt' ? '→ Licenças empresariais (712)' : '→ Business licenses (712)'}
        </Link>
        <Link
          href="/manager-pro/news"
          className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--cream)]"
        >
          NEWS / Notícias
        </Link>
        <span className="self-center text-[11px] text-[#166534]">
          {totalKpis} {locale === 'pt' ? 'cartões abaixo = itens do menu lateral' : 'cards below = sidebar menu items'}
        </span>
      </div>

      {HOME_KPI_SECTIONS.map((section) => (
        <section key={section.title.en} className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink3)]">
            {pick(section.title, locale)}
          </p>
          <div className="gp-grid-kpis mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {section.items.map((k) => (
              <MasterOneKpiCard
                key={k.label.en + k.href}
                label={pick(k.label, locale)}
                value={k.value}
                moduleName={pick(k.moduleName, locale)}
                detail={pick(k.detail, locale)}
                href={k.href}
                barColor={k.barColor}
                donutData={k.donutData}
                donutColors={k.donutColors}
                emptyDonut={k.emptyDonut}
                latestUpdate={latest}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-10 text-xs text-[var(--ink3)]">
        {locale === 'pt'
          ? 'Cada cartão corresponde a uma rota do menu (com texto de contexto). Home não tem cartão — é esta página. Legenda: barra inferior 3px por módulo.'
          : 'Each card maps to a sidebar route (with context text). Home has no card — you are on it. Footer bar: 3px module accent.'}
      </p>
    </div>
  );
}
