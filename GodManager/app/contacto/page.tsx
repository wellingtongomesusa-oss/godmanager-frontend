import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/landing/SiteHeader';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contacto | GodManager',
  description: 'Fale com a Godroox LLC por email, SMS ou formulario. Resposta em menos de 24h.',
};

export default function ContactoPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        color: 'var(--ink)',
        fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
        WebkitFontSmoothing: 'antialiased' as const,
      }}
    >
      <SiteHeader active="contact" />
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '120px 32px 80px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 40,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif',
              fontSize: 40,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Fale connosco
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink2)', marginBottom: 32, lineHeight: 1.6 }}>
            Estamos disponiveis para responder a duvidas, agendar demos personalizadas, ou discutir
            como podemos ajudar a tua empresa.
          </p>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--amber)',
                letterSpacing: 1,
                textTransform: 'uppercase' as const,
                marginBottom: 6,
              }}
            >
              Email
            </div>
            <a
              href="mailto:contact@godmanager.us"
              style={{ fontSize: 18, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}
            >
              contact@godmanager.us
            </a>
          </div>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 24,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--amber)',
                letterSpacing: 1,
                textTransform: 'uppercase' as const,
                marginBottom: 6,
              }}
            >
              SMS / WhatsApp
            </div>
            <a
              href="https://wa.me/13215194710"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 18, color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}
            >
              (321) 519-4710
            </a>
            <p style={{ fontSize: 12, color: 'var(--ink2)', margin: '6px 0 0' }}>
              So respondemos por SMS ou WhatsApp. Nao atendemos chamadas.
            </p>
          </div>
          <div
            style={{ background: 'var(--sidebar-bg)', color: '#fff', padding: 24, borderRadius: 10 }}
          >
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.9)', margin: 0, lineHeight: 1.6 }}>
              Tipicamente respondemos em menos de 24h. Para acesso imediato ao produto, usa{' '}
              <Link
                href="/request-demo"
                style={{ color: 'var(--amber)', textDecoration: 'underline' }}
              >
                Solicite o Demo
              </Link>
              .
            </p>
          </div>
        </div>
        <div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
