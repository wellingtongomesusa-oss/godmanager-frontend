import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentAdminFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Leads de contato | GodManager Admin',
  robots: { index: false, follow: false },
};

function fmtDate(d: Date): string {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default async function AdminContactLeadsPage() {
  const admin = await getCurrentAdminFromSession();
  if (!admin) {
    redirect('/login');
  }

  const leads = await prisma.contactLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gm-ink">Leads de contato</h1>
        <p className="mt-1 text-[13px] text-gm-ink-secondary">
          {leads.length} mensagens recebidas (mais recentes primeiro, max. 200)
        </p>
      </div>

      <div className="rounded-gm border border-gm-border bg-gm-paper overflow-hidden">
        <table className="w-full text-[12px]">
          <thead style={{ background: 'var(--cream)' }}>
            <tr style={{ textAlign: 'left' }}>
              {['Data', 'Nome', 'Tipo', 'Empresa', 'Email', 'Telefone', 'Mensagem', 'IP'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      fontSize: 9,
                      letterSpacing: '1px',
                      textTransform: 'uppercase' as const,
                      fontWeight: 600,
                      color: 'var(--ink3)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)' }}
                >
                  Sem mensagens ainda.
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr
                  key={l.id}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <td style={{ padding: '10px 14px', color: 'var(--ink2)', whiteSpace: 'nowrap' }}>
                    {fmtDate(l.createdAt)}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--ink)' }}>{l.nome}</td>
                  <td style={{ padding: '10px 14px' }}>{l.tipoContacto}</td>
                  <td style={{ padding: '10px 14px' }}>{l.empresa || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{l.email}</td>
                  <td style={{ padding: '10px 14px' }}>{l.telefone}</td>
                  <td
                    style={{
                      padding: '10px 14px',
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}
                    title={l.mensagem || undefined}
                  >
                    {l.mensagem || '—'}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      color: 'var(--ink3)',
                    }}
                  >
                    {l.ip || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
