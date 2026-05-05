'use client';

import OwnerPortalHeader from '../_components/OwnerPortalHeader';

interface LineItem {
  id: string;
  lineType: string;
  description: string;
  amount: string;
  sortOrder: number;
}

interface StatementData {
  property: {
    id: string;
    code: string;
    address: string;
    bedrooms: number | null;
    bathrooms: number | null;
    ownerName: string | null;
    ownerEmail: string | null;
    clientName: string | null;
    clientLogoUrl: string | null;
    tenantNames: string | null;
    tenantsCount: number;
  };
  period: string;
  payout: {
    id: string;
    totalIncome: string;
    totalExpenses: string;
    netPayout: string;
    previousBalance: string;
    paidAt: string | null;
    paidAmount: string | null;
    notes: string | null;
    lineItems: LineItem[];
  } | null;
}

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtPeriod = (yearMonth: string) => {
  const parts = yearMonth.split('-');
  const year = parts[0] ?? '';
  const monthStr = parts[1] ?? '1';
  const months = [
    '',
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const y = parseInt(monthStr, 10);
  return `${months[y] ?? monthStr} ${year}`;
};

export default function StatementClient({
  data,
  userName,
}: {
  data: { ok: boolean } & StatementData;
  userName: string;
}) {
  const { property, period, payout } = data;

  if (!payout) {
    return (
      <div className="flex min-h-screen flex-col bg-gm-sand font-body antialiased">
        <OwnerPortalHeader
          showBack
          userName={userName}
          subtitle="Demonstrativo Mensal"
          rightLabel="Periodo"
          rightValue={fmtPeriod(period)}
        />
        <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          <div className="rounded-gm border border-gm-border bg-gm-paper p-8 shadow-gm-card">
            <h1 className="font-heading text-xl font-semibold text-gm-ink sm:text-[22px]">
              {property.code} — {property.address}
            </h1>
            <p className="mt-2 text-[13px] text-gm-ink-tertiary">
              Sem demonstrativo para {fmtPeriod(period)}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const totalIncome = Number.parseFloat(payout.totalIncome);
  const totalExpenses = Number.parseFloat(payout.totalExpenses);
  const netPayout = Number.parseFloat(payout.netPayout);
  const previousBalance = Number.parseFloat(payout.previousBalance);
  const totalBalance = previousBalance + netPayout;

  const incomes = payout.lineItems.filter((l) => l.lineType === 'income');
  const expenses = payout.lineItems.filter((l) => l.lineType === 'expense');

  return (
    <div className="flex min-h-screen flex-col bg-gm-sand font-body antialiased">
      <OwnerPortalHeader
        showBack
        userName={userName}
        subtitle="Demonstrativo Mensal"
        rightLabel="Periodo"
        rightValue={fmtPeriod(period)}
      />

      <div className="mx-auto max-w-6xl flex-1 space-y-6 px-6 py-8">
        <div className="rounded-gm border border-gm-border bg-gm-paper p-6 shadow-gm-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold text-gm-ink">
                {property.tenantNames ?? 'Sem inquilino actual'}
              </h2>
              <p className="mt-1 text-[13px] text-gm-ink-secondary">
                {property.address}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 text-[13px] md:grid-cols-2">
                <div>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-gm-ink-tertiary">
                    Proprietário
                  </span>
                  <p className="font-medium text-gm-ink">{property.ownerName ?? '—'}</p>
                </div>
                <div>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-gm-ink-tertiary">
                    Property Manager
                  </span>
                  <p className="font-medium text-gm-ink">
                    {property.clientName ?? '—'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex min-w-[180px] flex-col gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-[8px] border border-gm-border-strong px-4 py-2 text-[12px] font-semibold text-gm-ink transition hover:border-gm-amber hover:text-gm-ink"
              >
                Imprimir
              </button>
              <a
                href={`/api/owner/statement/pdf?propertyId=${encodeURIComponent(property.id)}&period=${encodeURIComponent(period)}&lang=pt`}
                download
                className="rounded-[8px] border border-gm-border-strong px-4 py-2 text-[12px] font-semibold text-gm-ink transition hover:border-gm-amber hover:text-gm-ink"
              >
                PDF (Portugues)
              </a>
              <a
                href={`/api/owner/statement/pdf?propertyId=${encodeURIComponent(property.id)}&period=${encodeURIComponent(period)}&lang=en`}
                download
                className="rounded-[8px] border border-gm-border-strong px-4 py-2 text-[12px] font-semibold text-gm-ink transition hover:border-gm-amber hover:text-gm-ink"
              >
                PDF (English)
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-gm border border-gm-border bg-gm-paper p-6 shadow-gm-card">
            <h3 className="mb-4 text-[9px] font-semibold uppercase tracking-wider text-gm-ink-tertiary">
              Saldo do Período
            </h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-gm-ink-secondary">Saldo mês anterior</span>
                <span className="font-mono font-bold tabular-nums text-gm-ink">
                  {fmtUSD(previousBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gm-ink-secondary">Saldo mês atual</span>
                <span className="font-mono font-bold tabular-nums text-gm-ink">
                  {fmtUSD(netPayout)}
                </span>
              </div>
              <div className="flex justify-between border-t border-gm-border pt-3">
                <span className="font-semibold text-gm-ink">Saldo total</span>
                <span className="font-mono text-lg font-bold tabular-nums text-gm-ink">
                  {fmtUSD(totalBalance)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-gm-ink-tertiary">
                <span>Saldo mínimo</span>
                <span className="font-mono tabular-nums">{fmtUSD(0)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-gm bg-gradient-to-br from-gm-blue to-gm-sidebar p-6 text-white shadow-gm-card">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/75">
              Disponível para Repasse
            </p>
            <p className="mt-2 font-mono text-4xl font-bold tabular-nums">{fmtUSD(netPayout)}</p>
            <div className="mt-auto flex flex-col gap-2 pt-6">
              <button
                type="button"
                disabled
                title="Workflow de transferência chega em F4.6"
                className="rounded-[8px] bg-white/15 px-4 py-2 text-[12px] font-semibold text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Transferir ao proprietário
              </button>
              <a
                href="/api/rent-advance/request"
                onClick={(e) => {
                  e.preventDefault();
                  alert(
                    'Solicitação de antecipação — fluxo será integrado na próxima sprint (F4.6).'
                  );
                }}
                className="rounded-[8px] bg-gm-amber px-4 py-2 text-center text-[12px] font-semibold text-white shadow-gm-amber transition hover:bg-gm-amber-light"
              >
                Solicitar Antecipação de Crédito
              </a>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-gm border border-gm-border bg-gm-paper shadow-gm-card">
          <div className="bg-gm-sidebar px-6 py-3">
            <h3 className="text-[13px] font-semibold text-white">
              Receitas (Créditos)
            </h3>
          </div>
          <table className="w-full text-[13px]">
            <thead className="bg-gm-cream text-[9px] font-semibold uppercase tracking-wide text-gm-ink-tertiary">
              <tr>
                <th className="px-6 py-2 text-left font-semibold">Descrição</th>
                <th className="px-6 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gm-border">
              {incomes.map((li) => (
                <tr key={li.id} className="transition hover:bg-gm-amber-bg/40">
                  <td className="px-6 py-3 text-gm-ink">{li.description}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold tabular-nums text-gm-green">
                    {fmtUSD(Number.parseFloat(li.amount))}
                  </td>
                </tr>
              ))}
              <tr className="bg-gm-amber-bg font-semibold">
                <td className="px-6 py-3 text-gm-ink">Total de Receitas</td>
                <td className="px-6 py-3 text-right font-mono tabular-nums text-gm-green">
                  {fmtUSD(totalIncome)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-gm border border-gm-border bg-gm-paper shadow-gm-card">
          <div className="bg-gm-sidebar px-6 py-3">
            <h3 className="text-[13px] font-semibold text-white">
              Despesas (Débitos)
            </h3>
          </div>
          <table className="w-full text-[13px]">
            <thead className="bg-gm-cream text-[9px] font-semibold uppercase tracking-wide text-gm-ink-tertiary">
              <tr>
                <th className="px-6 py-2 text-left font-semibold">Descrição</th>
                <th className="px-6 py-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gm-border">
              {expenses.map((li) => (
                <tr key={li.id} className="transition hover:bg-gm-red-bg/35">
                  <td className="px-6 py-3 text-gm-ink">{li.description}</td>
                  <td className="px-6 py-3 text-right font-mono font-semibold tabular-nums text-gm-red">
                    ({fmtUSD(Number.parseFloat(li.amount))})
                  </td>
                </tr>
              ))}
              <tr className="bg-gm-amber-bg font-semibold">
                <td className="px-6 py-3 text-gm-ink">Total de Despesas</td>
                <td className="px-6 py-3 text-right font-mono tabular-nums text-gm-red">
                  ({fmtUSD(totalExpenses)})
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 rounded-gm bg-gm-sidebar p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gm-amber">
              Repasse Líquido
            </p>
            <p className="mt-1 text-[12px] text-white/65">
              Valor a Repassar ao Proprietário
            </p>
          </div>
          <p className="font-mono text-3xl font-bold tabular-nums text-gm-amber sm:text-4xl">
            {fmtUSD(netPayout)}
          </p>
        </div>

        <p className="pb-12 pt-4 text-center text-[11px] text-gm-ink-tertiary">
          Este demonstrativo reflete todas as transações referentes ao imóvel acima durante
          o período indicado. Em caso de divergência, favor entrar em contato em até 30
          dias.
        </p>
      </div>
    </div>
  );
}
