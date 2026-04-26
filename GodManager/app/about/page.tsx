import type { Metadata } from 'next';
import { SiteHeader } from '@/components/landing/SiteHeader';

export const metadata: Metadata = {
  title: 'Sobre nos · GodManager',
  description:
    'Godroox LLC — bookkeeping profissional, trust compliance e operacoes financeiras diarias para imobiliarias e brokerages nos EUA.',
};

const STATS: Array<{ value: string; label: string }> = [
  { value: '98%', label: 'Accuracy rate em reconciliacao' },
  { value: '3x', label: 'Velocidade vs metodo manual' },
  { value: '24h', label: 'Cobertura de auditoria diaria' },
];

const STEPS: Array<{ title: string; desc: string }> = [
  {
    title: 'Diagnostico inicial',
    desc: 'Entendemos o estado actual dos teus livros antes de prometer qualquer coisa.',
  },
  {
    title: 'Cleanup se necessario',
    desc: 'Se ha meses ou anos de registos por organizar, limpamos antes de comecar a operacao corrente.',
  },
  {
    title: 'Operacao continua',
    desc: 'Bookkeeping diario, reconciliacao, audit, relatorios mensais.',
  },
  {
    title: 'Suporte estrategico',
    desc: 'Quando estiveres pronto a procurar investimento ou IPO, ja temos os fundamentos prontos.',
  },
];

export default function AboutPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8f4ec',
        color: '#1f2937',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
      }}
    >
      <SiteHeader active="about" />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '120px 32px 80px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
            fontSize: 48,
            fontWeight: 600,
            marginBottom: 8,
            letterSpacing: '-0.5px',
          }}
        >
          Sobre a Godroox LLC
        </h1>
        <p
          style={{
            fontSize: 18,
            color: '#6b7280',
            marginBottom: 48,
            maxWidth: 720,
            lineHeight: 1.6,
          }}
        >
          Bookkeeping profissional, trust compliance e operacoes financeiras diarias para
          imobiliarias e brokerages nos EUA.
        </p>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 28,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 16,
              letterSpacing: '0.5px',
            }}
          >
            A nossa missao
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#1f2937', marginBottom: 16 }}>
            Preparamos empresas pequenas e medias para crescer com integridade financeira. O nosso
            objectivo e que cada cliente atinja a fase em que tenha opcoes reais: continuar como
            negocio familiar, atrair investidores institucionais, expandir nacionalmente, ou um dia
            abrir capital atraves de um IPO.
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#1f2937', margin: 0 }}>
            Nao prometemos crescimento. Garantimos que quando a oportunidade chegar, os teus livros
            estao prontos para ser auditados, os teus reports estao em conformidade GAAP, e as tuas
            operacoes financeiras nao serao um obstaculo.
          </p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 28,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 16,
              letterSpacing: '0.5px',
            }}
          >
            O que entregamos
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginTop: 16,
            }}
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 24,
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: '#c9a96e',
                    fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                    lineHeight: 1.1,
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 28,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 16,
              letterSpacing: '0.5px',
            }}
          >
            Como trabalhamos
          </h2>
          <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: '16px 0',
                  borderBottom:
                    i === STEPS.length - 1 ? 'none' : '1px solid rgba(31,41,55,0.08)',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    background: 'rgba(201,169,110,0.15)',
                    color: '#c9a96e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>
                    {step.title}
                  </div>
                  <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '4px 0 0' }}>
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          style={{
            background: '#1f2937',
            color: '#fff',
            padding: 32,
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 24,
              fontWeight: 600,
              color: '#c9a96e',
              marginBottom: 12,
            }}
          >
            Contactos
          </h2>
          <p style={{ fontSize: 14, color: '#e5e7eb', margin: 0, lineHeight: 1.7 }}>
            Godroox LLC &middot; godmanager.com &middot; trust.godmanager.com &middot;{' '}
            <a
              href="mailto:contact@godmanager.com"
              style={{ color: '#c9a96e', textDecoration: 'none', fontWeight: 600 }}
            >
              contact@godmanager.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
