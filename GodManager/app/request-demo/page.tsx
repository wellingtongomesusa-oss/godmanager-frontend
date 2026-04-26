import { SiteHeader } from '@/components/landing/SiteHeader';
import { RequestDemoForm } from './RequestDemoForm';

export const metadata = {
  title: 'Solicite o Demo | GodManager',
  description:
    'Aceda a um ambiente demo do GodManager com dados realistas. Sem cartao de credito.',
};

export default function RequestDemoPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#fff',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
      }}
    >
      <SiteHeader active="home" />
      <main
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '120px 32px 64px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 48,
          alignItems: 'start',
        }}
      >
        <section>
          <p
            style={{
              color: '#c9a96e',
              fontSize: 11,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Solicite o Demo
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 44,
              fontWeight: 600,
              lineHeight: 1.1,
              marginBottom: 20,
            }}
          >
            Veja o GodManager em acao
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
            Aceda a um ambiente demo isolado com dados realistas (20 properties, 10 tenants, 10
            vendors). Sem instalacao, sem cartao de credito, sem compromisso.
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {[
              'Demonstrativos de owners e tenants',
              'Reconciliacao bancaria GAAP',
              'Audit log multi-utilizador',
              'Relatorios 1099 / IRS',
            ].map((it) => (
              <li
                key={it}
                style={{
                  color: '#e5e7eb',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#c9a96e',
                  }}
                />
                {it}
              </li>
            ))}
          </ul>
        </section>
        <section
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(201,169,110,0.2)',
            borderRadius: 12,
            padding: 32,
          }}
        >
          <RequestDemoForm />
        </section>
      </main>
    </div>
  );
}
