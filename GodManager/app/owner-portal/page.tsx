import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import OwnerPortalHeader from './_components/OwnerPortalHeader';

export const dynamic = 'force-dynamic';

const DEFAULT_PERIOD = '2026-04';

const MONTHS_PT = [
  '',
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function periodLabel(yearMonth: string): string {
  const [, monthStr] = yearMonth.split('-');
  const year = yearMonth.split('-')[0] ?? '';
  return `${MONTHS_PT[parseInt(monthStr, 10)]} ${year}`;
}

interface PortalProperty {
  id: string;
  code: string;
  address: string;
  ownerName: string | null;
  hasStatement: boolean;
}

export default async function OwnerPortalIndex() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/owner-portal/login');
  }

  if (user.role !== 'owner' && user.role !== 'super_admin') {
    redirect('/manager-pro');
  }

  const period = DEFAULT_PERIOD;
  let properties: PortalProperty[] = [];
  let viewLabel = '';

  if (user.role === 'super_admin') {
    viewLabel = 'Visao administrativa';
    const payouts = await prisma.ownerMonthPayout.findMany({
      where: { yearMonth: period },
      include: {
        property: {
          select: { id: true, code: true, address: true, ownerName: true },
        },
      },
      orderBy: { property: { code: 'asc' } },
    });
    properties = payouts.map((p) => ({
      id: p.property.id,
      code: p.property.code,
      address: p.property.address,
      ownerName: p.property.ownerName,
      hasStatement: true,
    }));
  } else {
    if (!user.ownerId) {
      return <NoOwnerLink />;
    }
    const props = await prisma.property.findMany({
      where: { ownerId: user.ownerId },
      select: {
        id: true,
        code: true,
        address: true,
        ownerName: true,
        ownerMonthPayouts: {
          where: { yearMonth: period },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { code: 'asc' },
    });
    properties = props.map((p) => ({
      id: p.id,
      code: p.code,
      address: p.address,
      ownerName: p.ownerName,
      hasStatement: p.ownerMonthPayouts.length > 0,
    }));
  }

  return (
    <div className="flex min-h-screen flex-col bg-gm-cream font-body antialiased">
      <OwnerPortalHeader
        userName={
          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
          user.email ||
          'Owner'
        }
        subtitle={viewLabel || undefined}
        rightLabel="Periodo"
        rightValue={periodLabel(period)}
      />

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <h2 className="mb-4 font-heading text-lg font-semibold text-gm-ink">
          {properties.length === 1
            ? 'Sua Propriedade'
            : `Propriedades (${properties.length})`}
        </h2>

        {properties.length === 0 ? (
          <div className="rounded-lg border border-gm-border bg-gm-paper p-8 text-center shadow-sm">
            <p className="text-sm text-gm-ink-secondary">
              {user.role === 'super_admin'
                ? `Nenhum demonstrativo gerado para ${periodLabel(period)} ainda.`
                : 'Nao ha propriedades associadas a sua conta. Entre em contato com seu gestor.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {properties.map((p) => (
              <PropertyCard key={p.id} property={p} period={period} />
            ))}
          </div>
        )}
      </div>
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
          <h3 className="mt-1 truncate font-heading text-base font-semibold text-gm-ink">
            {property.address}
          </h3>
          {property.ownerName ? (
            <p className="mt-2 text-xs text-gm-ink-secondary">
              Proprietario:{' '}
              <span className="font-medium">{property.ownerName}</span>
            </p>
          ) : null}
        </div>
        <div className="text-right">
          {property.hasStatement ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gm-amber-bg/60 px-2.5 py-1 text-xs font-medium text-gm-ink">
              Disponivel
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gm-border bg-gm-cream px-2.5 py-1 text-xs font-medium text-gm-ink-secondary">
              Aguardando
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 text-xs font-semibold text-gm-amber">
        Ver demonstrativo
      </div>
    </Link>
  );
}

function NoOwnerLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gm-cream px-6 font-body antialiased">
      <div className="max-w-md rounded-lg border border-gm-border bg-gm-paper p-8 text-center shadow-sm">
        <h1 className="mb-2 font-heading text-xl font-semibold text-gm-ink">
          Conta sem propriedade
        </h1>
        <p className="text-sm text-gm-ink-secondary">
          Sua conta nao esta associada a nenhuma propriedade. Entre em contato
          com seu gestor.
        </p>
      </div>
    </div>
  );
}
