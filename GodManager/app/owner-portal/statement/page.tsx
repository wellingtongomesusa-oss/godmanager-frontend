import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUserFromSession } from '@/lib/authServer';
import StatementClient from './StatementClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { propertyId?: string; period?: string };
}

export default async function StatementPage({ searchParams }: PageProps) {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/manager-pro/login');
  }

  const propertyId = searchParams.propertyId ?? '';
  const period = searchParams.period ?? '2026-04';

  if (!propertyId) {
    return (
      <div className="min-h-screen bg-gm-sand p-8 font-body">
        <div className="mx-auto max-w-3xl rounded-[12px] border border-gm-border bg-gm-paper p-8 shadow-gm-card">
          <h1 className="font-heading text-[28px] font-semibold text-gm-ink">
            Owner Statement
          </h1>
          <p className="mt-2 text-[13px] text-gm-ink-secondary">
            Property required. Use{' '}
            <code className="rounded border border-gm-border-strong bg-gm-cream px-2 py-0.5 text-[12px] text-gm-ink">
              ?propertyId=...&amp;period=YYYY-MM
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('host') ?? 'www.godmanager.us';
  const cookie = h.get('cookie') ?? '';

  const url = new URL(
    `/api/owner/statement?propertyId=${encodeURIComponent(propertyId)}&period=${encodeURIComponent(period)}`,
    `${proto}://${host}`,
  );

  const res = await fetch(url.toString(), {
    headers: { cookie },
    cache: 'no-store',
  });

  if (res.status === 401) {
    redirect('/manager-pro/login');
  }

  if (res.status === 403) {
    return (
      <div className="min-h-screen bg-gm-sand p-8 font-body">
        <div className="mx-auto max-w-3xl rounded-[12px] border border-gm-amber-bd bg-gm-amber-bg p-8">
          <h1 className="font-heading text-[28px] font-semibold text-gm-ink">
            Sem permissão
          </h1>
          <p className="mt-2 text-[13px] text-gm-ink-secondary">
            Esta conta não tem acesso a este demonstrativo.
          </p>
        </div>
      </div>
    );
  }

  if (res.status === 404) {
    return (
      <div className="min-h-screen bg-gm-sand p-8 font-body">
        <div className="mx-auto max-w-3xl rounded-[12px] border border-gm-border bg-gm-paper p-8 shadow-gm-card">
          <h1 className="font-heading text-[28px] font-semibold text-gm-ink">
            Property não encontrada
          </h1>
        </div>
      </div>
    );
  }

  const data = await res.json();
  if (!data.ok) {
    return (
      <div className="min-h-screen bg-gm-sand p-8 font-body">
        <div className="mx-auto max-w-3xl rounded-[12px] border border-gm-border-strong bg-gm-red-bg p-8">
          <h1 className="font-heading text-[28px] font-semibold text-gm-red">
            Erro
          </h1>
          <pre className="mt-2 whitespace-pre-wrap text-[12px] text-gm-ink-secondary">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return <StatementClient data={data} />;
}
