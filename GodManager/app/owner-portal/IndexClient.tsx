'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

interface PortalProperty {
  id: string;
  code: string;
  address: string;
  ownerName: string | null;
  hasStatement: boolean;
}

interface Props {
  properties: PortalProperty[];
  period: string;
  periodLabel: string;
  isAdminView: boolean;
}

export default function IndexClient({
  properties,
  period,
  periodLabel,
  isAdminView,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        (p.ownerName?.toLowerCase().includes(q) ?? false)
    );
  }, [properties, query]);

  const titleHeading = isAdminView
    ? 'Todas as Propriedades'
    : filtered.length === 1
      ? 'Sua Propriedade'
      : 'Propriedades';

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-gm-ink">
            {titleHeading}
          </h2>
          <p className="mt-0.5 text-xs text-gm-ink-secondary">
            {filtered.length} de {properties.length} · período{' '}
            <span className="font-medium text-gm-ink">{periodLabel}</span>
            {isAdminView ? ' · vista administrativa' : ''}
          </p>
        </div>

        {properties.length > 6 ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por codigo, endereco ou proprietario"
            className="w-full rounded-md border border-gm-border bg-gm-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gm-amber sm:w-80"
          />
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gm-border bg-gm-paper p-8 text-center">
          <p className="text-sm text-gm-ink-secondary">
            {properties.length === 0
              ? isAdminView
                ? 'Nenhuma propriedade cadastrada.'
                : 'Nao ha propriedades associadas a sua conta.'
              : 'Nenhuma propriedade corresponde ao filtro.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} period={period} />
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyCard({
  property,
  period,
}: {
  property: PortalProperty;
  period: string;
}) {
  const href = `/owner-portal/statement?propertyId=${encodeURIComponent(property.id)}&period=${encodeURIComponent(period)}`;
  return (
    <Link
      href={href}
      className="block rounded-lg border border-gm-border bg-gm-paper p-5 shadow-sm transition hover:border-gm-amber hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gm-ink-secondary">
            {property.code}
          </p>
          <h3 className="mt-1 line-clamp-2 font-heading text-base font-semibold text-gm-ink">
            {property.address}
          </h3>
          {property.ownerName ? (
            <p className="mt-2 truncate text-xs text-gm-ink-secondary">
              {property.ownerName}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          {property.hasStatement ? (
            <span className="inline-flex rounded-full bg-gm-amber-bg/70 px-2.5 py-1 text-xs font-medium text-gm-ink">
              Disponivel
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-gm-border bg-gm-cream px-2.5 py-1 text-xs font-medium text-gm-ink-secondary">
              Aguardando
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold text-gm-amber">
        Ver demonstrativo
      </div>
    </Link>
  );
}
