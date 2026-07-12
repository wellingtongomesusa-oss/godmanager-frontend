'use client';

import { useState } from 'react';

type PlanId = '30' | '90' | '180';
type Props = { locale?: string };

const PRICES: Record<PlanId, string> = { '30': 'US$ 19,90', '90': 'US$ 49,90', '180': 'US$ 89,00' };

const STR = {
  en: {
    intro:
      'GODREALTOR — Florida real estate exam prep (audiobook). A product from the same group, with checkout right here.',
    names: { '30': '30 days', '90': '90 days', '180': '6 months' } as Record<PlanId, string>,
    access: { '30': 'Access for 30 days', '90': 'Access for 90 days', '180': 'Access for 180 days' } as Record<PlanId, string>,
    features: ['520 practice questions with answers', 'Audio in PT, ES & EN', 'Practice & exam mode', 'Glossary “What is it?”'],
    popular: 'Most popular',
    buy: 'Buy',
    opening: 'Opening…',
    err: 'Could not open checkout.',
    net: 'Network error.',
    disclaimer:
      'Complementary study-support course. Does not replace the mandatory 63-hour (pre-licensing) courses required in Florida.',
  },
  'pt-br': {
    intro:
      'GODREALTOR — preparação para a prova de corretor da Flórida (audiobook). Produto do mesmo grupo, com checkout direto aqui.',
    names: { '30': '30 dias', '90': '90 dias', '180': '6 meses' } as Record<PlanId, string>,
    access: { '30': 'Acesso por 30 dias', '90': 'Acesso por 90 dias', '180': 'Acesso por 180 dias' } as Record<PlanId, string>,
    features: ['520 questões com gabarito', 'Áudio em PT, ES e EN', 'Modo prática e simulado', 'Glossário «O que é?»'],
    popular: 'Mais popular',
    buy: 'Comprar',
    opening: 'Abrindo…',
    err: 'Não foi possível abrir o checkout.',
    net: 'Falha de rede.',
    disclaimer:
      'Curso complementar de apoio ao estudo. Não substitui os cursos obrigatórios de 63h (pré-licenciamento) exigidos na Flórida.',
  },
  es: {
    intro:
      'GODREALTOR — preparación para el examen de bienes raíces de Florida (audiolibro). Producto del mismo grupo, con checkout aquí.',
    names: { '30': '30 días', '90': '90 días', '180': '6 meses' } as Record<PlanId, string>,
    access: { '30': 'Acceso por 30 días', '90': 'Acceso por 90 días', '180': 'Acceso por 180 días' } as Record<PlanId, string>,
    features: ['520 preguntas con respuestas', 'Audio en PT, ES e EN', 'Modo práctica y simulacro', 'Glosario «¿Qué es?»'],
    popular: 'Más popular',
    buy: 'Comprar',
    opening: 'Abriendo…',
    err: 'No se pudo abrir el checkout.',
    net: 'Error de red.',
    disclaimer:
      'Curso complementario de apoyo al estudio. No sustituye los cursos obligatorios de 63h (pre-licencia) exigidos en Florida.',
  },
};

export function GodrealtorPlans({ locale }: Props) {
  const loc = locale === 'pt-br' ? 'pt-br' : locale === 'es' ? 'es' : 'en';
  const t = STR[loc];
  const PLANS: { id: PlanId; popular?: boolean }[] = [
    { id: '30' },
    { id: '90', popular: true },
    { id: '180' },
  ];
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const buy = async (plan: string) => {
    setBusy(plan);
    setErr(null);
    try {
      const r = await fetch('/api/godrealtor/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.url) {
        window.location.href = d.url;
        return;
      }
      setErr(t.err);
    } catch {
      setErr(t.net);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px', maxWidth: 640 }}>{t.intro}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {PLANS.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#fff',
              border: p.popular ? '2px solid #c9a96e' : '1px solid #e5e7eb',
              borderRadius: 12,
              padding: 24,
              position: 'relative',
              boxShadow: p.popular ? '0 6px 20px rgba(201,169,110,0.18)' : '0 1px 2px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {p.popular && (
              <span
                style={{
                  position: 'absolute',
                  top: -11,
                  left: 24,
                  background: '#c9a96e',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  padding: '3px 10px',
                  borderRadius: 6,
                }}
              >
                {t.popular}
              </span>
            )}
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>{t.names[p.id]}</h3>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#c9a96e', lineHeight: 1.1 }}>{PRICES[p.id]}</div>
            <div style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 16px' }}>{t.access[p.id]}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'grid', gap: 8, flex: 1 }}>
              {t.features.map((f) => (
                <li key={f} style={{ fontSize: 13, color: '#374151', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#c9a96e', fontWeight: 700 }}>•</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void buy(p.id)}
              disabled={busy === p.id}
              style={{
                background: '#c9a96e',
                color: '#fff',
                border: 'none',
                padding: '12px 18px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.3px',
                cursor: 'pointer',
                opacity: busy === p.id ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(201,169,110,0.3)',
              }}
            >
              {busy === p.id ? t.opening : t.buy}
            </button>
          </div>
        ))}
      </div>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626' }}>{err}</div>}
      <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0' }}>{t.disclaimer}</p>
    </>
  );
}
