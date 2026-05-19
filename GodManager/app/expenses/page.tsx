import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';
import { getGodManagerPremiumUrl } from '@/lib/godmanager-premium-url';

export const dynamic = 'force-dynamic';

export default async function ExpensesLandingPage() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/login?from=/expenses');
  }

  let allowed = false;
  if (user.role === 'super_admin') {
    allowed = true;
  } else if (user.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: user.clientId },
      select: { productType: true },
    });
    allowed = client?.productType === 'EXPENSES_JOBS';
  }

  if (!allowed) {
    return (
      <div
        className="mx-auto max-w-lg px-6 py-16 text-[var(--ink)]"
        style={{ fontFamily: 'var(--font-dm), system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}
      >
        <h1 className="mb-3 font-[family-name:var(--font-cormorant)] text-2xl font-semibold">
          Sem permissão para esta área
        </h1>
        <p className="mb-6 text-sm text-[var(--ink2)]">
          Esta área destina-se a contas GodManager configuradas apenas para despesas, fornecedores e trabalhos.
        </p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--amber)] underline">
          Voltar ao painel
        </Link>
      </div>
    );
  }

  redirect(getGodManagerPremiumUrl());
}
