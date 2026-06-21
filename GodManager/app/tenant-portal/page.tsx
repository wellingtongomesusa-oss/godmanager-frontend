import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import TenantPortalHeader from './_components/TenantPortalHeader';

export const dynamic = 'force-dynamic';

export default async function TenantPortalIndex() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/tenant-portal/login');
  }

  if (user.role !== 'tenant' && user.role !== 'super_admin') {
    redirect('/manager-pro');
  }

  const displayName =
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
    user.email ||
    'Inquilino';

  if (!user.tenantId) {
    return <NoTenantLink />;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      propertyId: true,
      unit: true,
      property: {
        select: {
          id: true,
          code: true,
          address: true,
        },
      },
    },
  });

  if (!tenant) {
    return <NoTenantLink />;
  }

  const propertyAddress =
    tenant.property?.address ?? (tenant.propertyId ? 'Imovel vinculado' : '—');
  const propertyCode = tenant.property?.code ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-gm-cream font-body antialiased">
      <TenantPortalHeader
        userName={displayName}
        subtitle={user.role === 'super_admin' ? 'Visao administrativa' : undefined}
      />

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="rounded-lg border border-gm-border bg-gm-paper p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-gm-ink">
            Sua conta
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gm-ink-secondary">
                Nome
              </dt>
              <dd className="mt-0.5 font-medium text-gm-ink">{tenant.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gm-ink-secondary">
                Email
              </dt>
              <dd className="mt-0.5 text-gm-ink">{tenant.email ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gm-ink-secondary">
                Imovel
              </dt>
              <dd className="mt-0.5 text-gm-ink">
                {propertyCode ? (
                  <span className="font-mono text-xs text-gm-ink-secondary">
                    {propertyCode}
                  </span>
                ) : null}
                {propertyCode ? ' · ' : null}
                {propertyAddress}
                {tenant.unit ? (
                  <span className="text-gm-ink-secondary"> · Unidade {tenant.unit}</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div
            className="rounded-lg border border-dashed border-gm-border bg-gm-paper/60 p-5 text-center"
            aria-disabled="true"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gm-ink-secondary">
              Proxima fase
            </p>
            <p className="mt-2 font-heading text-base font-semibold text-gm-ink">
              Pagamento de aluguel
            </p>
            <p className="mt-1 text-xs text-gm-ink-secondary">Em breve</p>
          </div>
          <div
            className="rounded-lg border border-dashed border-gm-border bg-gm-paper/60 p-5 text-center"
            aria-disabled="true"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gm-ink-secondary">
              Proxima fase
            </p>
            <p className="mt-2 font-heading text-base font-semibold text-gm-ink">
              Vincular banco
            </p>
            <p className="mt-1 text-xs text-gm-ink-secondary">Em breve</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoTenantLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gm-cream px-6 font-body antialiased">
      <div className="max-w-md rounded-lg border border-gm-border bg-gm-paper p-8 text-center shadow-sm">
        <h1 className="mb-2 font-heading text-xl font-semibold text-gm-ink">
          Conta sem vinculo
        </h1>
        <p className="text-sm text-gm-ink-secondary">
          Sua conta nao esta associada a um inquilino. Entre em contato com seu
          gestor.
        </p>
      </div>
    </div>
  );
}
