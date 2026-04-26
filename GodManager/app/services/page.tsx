import type { Metadata } from 'next';
import { SiteHeader } from '@/components/landing/SiteHeader';

export const metadata: Metadata = {
  title: 'Servicos · GodManager',
  description:
    'Bookkeeping profissional, consulting financeiro e servicos 1099 para imobiliarias e brokerages nos EUA.',
};

type ServiceItem = { name: string; desc: string };
type ServiceGroup = { category: string; items: ServiceItem[] };

const SERVICES: ServiceGroup[] = [
  {
    category: 'Bookkeeping',
    items: [
      {
        name: 'All Services',
        desc: 'Tudo: registo de receitas/despesas, categorizacao, organizacao de recibos, relatorios mensais.',
      },
      {
        name: 'Trust Bookkeeping',
        desc: 'Gestao de fundos em conta de trust/IOLTA por cliente, sem comingling.',
      },
      {
        name: 'Corporate Bookkeeping',
        desc: 'Contas a pagar/receber, payroll, cash flow, despesas operacionais.',
      },
      {
        name: 'Daily Bank Recs',
        desc: 'Reconciliacao diaria entre extracto bancario e sistema, ajustes de fees e chargebacks.',
      },
      {
        name: 'Daily Audits',
        desc: 'Revisao diaria de lancamentos, deteccao proactiva de erros e categorias erradas.',
      },
    ],
  },
  {
    category: 'Consulting & Cleanup',
    items: [
      {
        name: 'On-Demand Consulting',
        desc: 'Aconselhamento sobre estruturacao financeira, escolha de LLC/S-Corp, leitura de relatorios.',
      },
      {
        name: 'Financial Diagnostic Cleanup',
        desc: 'Revisao e correcao de meses ou anos de registos desorganizados, prepara para auditoria.',
      },
      {
        name: 'Bank Reconciliation Catch-Up',
        desc: 'Recuperacao de reconciliacoes em atraso, fechamento de meses pendentes.',
      },
      {
        name: 'Three-Way Reconciliation',
        desc: 'Verificacao bank statement + ledger + relatorio cliente. Usado em law firms e real estate.',
      },
      {
        name: 'Trust Compliance Audit',
        desc: 'Verificacao das regras de trust, auditoria de relatorios por cliente.',
      },
      {
        name: 'Cash Suspect Report Cleanup',
        desc: 'Correcao de relatorios de cash flow descompensados, identificacao de saldos negativos.',
      },
    ],
  },
  {
    category: '1099 Services',
    items: [
      {
        name: '1099 eBook',
        desc: 'Guia de quem precisa receber 1099, regras IRS, prazos e penalidades.',
      },
      {
        name: '1099 Webinar',
        desc: 'Treinamento ao vivo sobre como emitir 1099, com Q&A.',
      },
      {
        name: '1099 Filing Services',
        desc: 'Recolha de dados de contractors, emissao, envio para IRS e contractors.',
      },
    ],
  },
];

export default function ServicesPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8f4ec',
        color: '#1f2937',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
      }}
    >
      <SiteHeader active="services" />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '120px 32px 80px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 48,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 8,
            letterSpacing: '-0.5px',
          }}
        >
          Servicos
        </h1>
        <p
          style={{
            color: '#6b7280',
            fontSize: 16,
            lineHeight: 1.6,
            marginBottom: 48,
            maxWidth: 720,
          }}
        >
          Bookkeeping profissional, consultoria, cleanup financeiro e servicos 1099. Cobertura
          completa para imobiliarias, brokerages e empresas que querem crescer sem perder controlo
          financeiro.
        </p>
        {SERVICES.map((group) => (
          <section key={group.category} style={{ marginBottom: 56 }}>
            <h2
              style={{
                fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                fontSize: 28,
                fontWeight: 600,
                color: '#c9a96e',
                marginBottom: 20,
                letterSpacing: '0.5px',
              }}
            >
              {group.category}
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {group.items.map((s) => (
                <article
                  key={s.name}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: 24,
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                  }}
                >
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#1f2937',
                      marginBottom: 8,
                    }}
                  >
                    {s.name}
                  </h3>
                  <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    {s.desc}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
        <section
          style={{
            marginTop: 32,
            padding: 32,
            borderRadius: 12,
            background: '#1f2937',
            color: '#fff',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                fontSize: 24,
                fontWeight: 600,
                color: '#c9a96e',
                marginBottom: 6,
              }}
            >
              Quer ver isto a operar com os teus livros?
            </h3>
            <p style={{ fontSize: 14, color: '#e5e7eb', margin: 0 }}>
              Demos guiadas, sem compromisso. Resposta em 24h.
            </p>
          </div>
          <a
            href="mailto:contact@godmanager.com?subject=Solicite%20o%20Demo%20-%20GodManager"
            style={{
              background: '#c9a96e',
              color: '#fff',
              padding: '12px 24px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: '0.5px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(201,169,110,0.3)',
            }}
          >
            Solicite o Demo
          </a>
        </section>
      </div>
    </div>
  );
}
