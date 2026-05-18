import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  const user = await getCurrentUserFromSession();
  if (!user) {
    redirect('/login?from=/design');
  }

  if (!user.clientId) {
    redirect('/dashboard');
  }

  const client = await prisma.client.findUnique({
    where: { id: user.clientId },
    select: { companyName: true, productType: true },
  });

  if (!client || client.productType !== 'DESIGN_DECORATION') {
    redirect('/dashboard');
  }

  return (
    <div>
      <h1
        className="mb-3 font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-[var(--ink)]"
        style={{ WebkitFontSmoothing: 'antialiased' as const }}
      >
        Bem-vindo. Painel em construção.
      </h1>
      <p className="font-[family-name:var(--font-dm)] text-sm text-[var(--ink2)]">
        Cliente: <span className="font-medium text-[var(--ink)]">{client.companyName}</span>
      </p>
    </div>
  );
}
