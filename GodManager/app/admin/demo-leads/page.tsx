import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentAdminFromSession } from '@/lib/authServer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Demo Leads | GodManager Admin',
  robots: { index: false, follow: false },
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default async function AdminDemoLeadsPage() {
  const admin = await getCurrentAdminFromSession();
  if (!admin) {
    redirect('/login');
  }

  const leads = await prisma.demoLead.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      tokens: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-gm-ink">Demo leads</h1>
        <p className="mt-1 text-[13px] text-gm-ink-secondary">
          Pedidos de acesso ao ambiente demo submetidos via /request-demo. Mostra os 200 mais
          recentes.
        </p>
      </div>

      <div className="rounded-gm border border-gm-border bg-gm-paper overflow-hidden">
        <table className="w-full text-[12px]">
          <thead style={{ background: 'var(--cream)' }}>
            <tr style={{ textAlign: 'left' }}>
              {[
                'Data',
                'Nome',
                'Empresa',
                'Email',
                'Telefone',
                'Site',
                'Token',
                'Estado',
                'IP',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    fontSize: 9,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    color: 'var(--ink3)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ padding: 24, textAlign: 'center', color: 'var(--ink3)' }}
                >
                  Sem pedidos ainda.
                </td>
              </tr>
            ) : (
              leads.map((l) => {
                const last = l.tokens[0];
                let state: { label: string; color: string; bg: string };
                if (!last) {
                  state = { label: 'sem token', color: '#475569', bg: '#e2e8f0' };
                } else if (last.usedAt) {
                  state = { label: 'usado', color: '#065f46', bg: '#d1fae5' };
                } else if (new Date() > last.expiresAt) {
                  state = { label: 'expirado', color: '#7f1d1d', bg: '#fee2e2' };
                } else {
                  state = { label: 'pendente', color: '#92400e', bg: '#fef3c7' };
                }
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {fmtDate(l.createdAt)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{l.nome}</td>
                    <td style={{ padding: '10px 14px' }}>{l.empresa}</td>
                    <td style={{ padding: '10px 14px' }}>{l.email}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{l.telefone}</td>
                    <td
                      style={{
                        padding: '10px 14px',
                        maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {l.siteEmpresa ? (
                        <a
                          href={l.siteEmpresa}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--amber)' }}
                        >
                          {l.siteEmpresa.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                      }}
                    >
                      {last ? last.token.slice(0, 10) + '…' : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 20,
                          color: state.color,
                          background: state.bg,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {state.label}
                      </span>
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
