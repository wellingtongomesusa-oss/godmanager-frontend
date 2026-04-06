'use client';

import { useTrustKPIs } from '@/hooks/useTrustKPIs';

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    n,
  );
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function TrustKpiPanel() {
  const { data, loading, error, refetch } = useTrustKPIs();

  const pctOccupied =
    data.totalUnitsManaged > 0
      ? Math.round((data.occupiedUnits / data.totalUnitsManaged) * 1000) / 10
      : 0;

  return (
    <section
      className="trust-kpi-panel border-t border-[color-mix(in_srgb,var(--champagne)_35%,transparent)] bg-[color-mix(in_srgb,var(--coal)_97%,white)] px-4 py-10 sm:px-8"
      aria-labelledby="trust-kpi-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="trust-kpi-heading" className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--champagne)]">
              GodManager Trust
            </h2>
            <p className="mt-1 text-lg font-medium text-[var(--warm-white)]">
              Painel de resumo · KPIs em tempo real (demo)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="self-start rounded-xl border border-[color-mix(in_srgb,var(--champagne)_45%,transparent)] bg-[color-mix(in_srgb,var(--champagne)_12%,var(--coal))] px-4 py-2 text-xs font-semibold text-[var(--champagne)] transition hover:bg-[color-mix(in_srgb,var(--champagne)_22%,var(--coal))]"
          >
            Atualizar
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-[color-mix(in_srgb,var(--red)_90%,white)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile
            label="Unidades gerenciadas"
            value={fmtInt(data.totalUnitsManaged)}
            sub="Total do portfólio"
            loading={loading}
          />
          <KpiTile
            label="Ocupadas vs vagas"
            value={`${fmtInt(data.occupiedUnits)} / ${fmtInt(data.vacantUnits)}`}
            sub={`${pctOccupied}% ocupação`}
            loading={loading}
          />
          <KpiTile
            label="Receita mensal"
            value={fmtMoney(data.monthlyRevenueConsolidated)}
            sub="Consolidada"
            loading={loading}
          />
          <KpiTile label="Past due total" value={fmtMoney(data.pastDueTotal)} sub="Em aberto" loading={loading} />
          <KpiTile
            label="Última atualização"
            value={new Date(data.updatedAt).toLocaleString('pt-BR')}
            sub="Fuso local"
            loading={loading}
            small
          />
        </div>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  sub,
  loading,
  small,
}: {
  label: string;
  value: string;
  sub: string;
  loading: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-[color-mix(in_srgb,var(--champagne)_25%,transparent)] bg-[color-mix(in_srgb,var(--warm-white)_6%,var(--coal))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color-mix(in_srgb,var(--champagne)_85%,white)]">
        {label}
      </p>
      <p
        className={`mt-2 font-[family-name:var(--font-cormorant)] text-[var(--warm-white)] ${small ? 'text-sm' : 'text-2xl'} ${loading ? 'opacity-40' : ''}`}
      >
        {loading ? '…' : value}
      </p>
      <p className="mt-1 text-[11px] text-[color-mix(in_srgb,white_55%,var(--coal))]">{sub}</p>
    </div>
  );
}
