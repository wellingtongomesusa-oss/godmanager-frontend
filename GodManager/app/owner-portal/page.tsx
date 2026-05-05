import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import OwnerPortalHeader from './_components/OwnerPortalHeader';
import IndexClient from './IndexClient';

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
  const isAdminView = user.role === 'super_admin';
  let viewLabel = '';
  let properties: PortalProperty[] = [];

  const propertySelect = {
    id: true,
    code: true,
    address: true,
    ownerName: true,
    ownerMonthPayouts: {
      where: { yearMonth: period },
      select: { id: true },
      take: 1,
    },
  } as const;

  if (isAdminView) {
    viewLabel = 'Visao administrativa';
    const props = await prisma.property.findMany({
      select: propertySelect,
      orderBy: { code: 'asc' },
    });
    properties = props.map((p) => ({
      id: p.id,
      code: p.code,
      address: p.address,
      ownerName: p.ownerName,
      hasStatement: p.ownerMonthPayouts.length > 0,
    }));
  } else {
    if (!user.ownerId) {
      return <NoOwnerLink />;
    }
    const props = await prisma.property.findMany({
      where: { ownerId: user.ownerId },
      select: propertySelect,
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

      <IndexClient
        properties={properties}
        period={period}
        periodLabel={periodLabel(period)}
        isAdminView={isAdminView}
      />
    </div>
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
