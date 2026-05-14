import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — GodManager',
  description: 'Privacy Policy for GodManager, a Godroox LLC product.',
};

export default function PrivacyPage() {
  return (
    <main
      className="font-body antialiased"
      style={{
        maxWidth: 820,
        margin: '0 auto',
        padding: '40px 20px',
        color: 'var(--ink)',
        lineHeight: 1.7,
      }}
    >
      <h1
        className="font-heading"
        style={{ fontSize: 32, marginBottom: 8, color: 'var(--ink)', fontWeight: 600 }}
      >
        Privacy Policy
      </h1>
      <p style={{ color: 'var(--ink3)', fontSize: 14, marginBottom: 32 }}>
        Last updated: May 13, 2026 · Effective date: May 13, 2026
      </p>

      <div
        style={{
          background: 'var(--amber-bg)',
          border: '1px solid var(--amber-bd)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 32,
          fontSize: 13,
          color: 'var(--ink2)',
        }}
      >
        <strong>DRAFT NOTICE:</strong> This document is a working draft and pending review by qualified
        legal counsel before being relied upon in production.
      </div>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        1. Who We Are
      </h2>
      <p>
        Godroox LLC (&quot;we&quot;, &quot;us&quot;) operates GodManager (godmanager.us). Registered
        address: 7480 Stone Creek Trail, Kissimmee, FL 34747, USA. Contact:{' '}
        <a href="mailto:contact@godmanager.us" style={{ color: 'var(--amber)' }}>
          contact@godmanager.us
        </a>
        .
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        2. Information We Collect
      </h2>
      <ul>
        <li>
          <strong>Account Data:</strong> name, email, phone, role, password (hashed).
        </li>
        <li>
          <strong>Property &amp; Tenant Data:</strong> addresses, owner information, tenant contact
          details, lease data — uploaded by you to operate your property management business.
        </li>
        <li>
          <strong>Financial Data:</strong> expense records, vendor payments, invoices, banking
          integrations (via Ramp / Plaid / Stripe).
        </li>
        <li>
          <strong>Usage Data:</strong> log files, IP address, browser type, pages visited, actions taken
          within the Service.
        </li>
        <li>
          <strong>Cookies:</strong> authentication cookies, language preference cookies, analytics
          cookies (where applicable).
        </li>
      </ul>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        3. How We Use Your Information
      </h2>
      <ul>
        <li>Provide and maintain the Service</li>
        <li>Process payments and subscriptions</li>
        <li>Send transactional and support emails</li>
        <li>Detect and prevent fraud, abuse, or security threats</li>
        <li>Comply with legal obligations</li>
        <li>Improve the Service based on aggregate usage patterns</li>
      </ul>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        4. Third-Party Services We Use
      </h2>
      <p>We integrate with reputable third-party providers, each governed by their own privacy policies:</p>
      <ul>
        <li>
          <strong>Stripe</strong> — payment processing (stripe.com/privacy)
        </li>
        <li>
          <strong>Resend</strong> — transactional email delivery (resend.com/legal/privacy-policy)
        </li>
        <li>
          <strong>Cloudflare R2</strong> — file storage (cloudflare.com/privacypolicy/)
        </li>
        <li>
          <strong>Railway</strong> — application and database hosting (railway.app/legal/privacy)
        </li>
        <li>
          <strong>Anthropic Claude API</strong> — AI assistance features (anthropic.com/legal/privacy)
        </li>
        <li>
          <strong>Crisp Chat</strong> — customer support chat (crisp.chat/en/privacy/)
        </li>
        <li>
          <strong>Ramp</strong> — financial integrations (where enabled by you)
        </li>
      </ul>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        5. Data Sharing and Disclosure
      </h2>
      <p>We do NOT sell your data. We share data only:</p>
      <ul>
        <li>With service providers listed above, strictly to operate the Service</li>
        <li>When required by law, subpoena, or court order</li>
        <li>To protect rights, property, or safety of Godroox, users, or the public</li>
        <li>In connection with a merger, acquisition, or sale of assets (with notice)</li>
      </ul>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        6. Data Security
      </h2>
      <p>
        We implement industry-standard security measures including: encrypted database connections
        (TLS), encrypted credential storage (AES-256-GCM), hashed passwords (bcrypt), access
        controls, and audit logging. No system is 100% secure; we cannot guarantee absolute security but
        commit to ongoing improvement.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        7. Data Retention
      </h2>
      <p>
        We retain your data for as long as your account is active. After cancellation, data is retained
        for up to 30 days for recovery purposes, then deleted from production systems. Backups may persist
        for up to 90 days. Anonymized aggregate data may be retained indefinitely.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        8. Your Rights
      </h2>
      <p>Subject to applicable law, you have the right to:</p>
      <ul>
        <li>
          <strong>Access:</strong> request a copy of data we hold about you
        </li>
        <li>
          <strong>Correct:</strong> update inaccurate information
        </li>
        <li>
          <strong>Delete:</strong> request deletion of your account and data
        </li>
        <li>
          <strong>Port:</strong> receive your data in a portable format (CSV/JSON)
        </li>
        <li>
          <strong>Object:</strong> opt out of non-essential processing
        </li>
      </ul>
      <p>
        Email{' '}
        <a href="mailto:contact@godmanager.us" style={{ color: 'var(--amber)' }}>
          contact@godmanager.us
        </a>{' '}
        to exercise any of these rights. We respond within 30 days.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        9. Children&apos;s Privacy
      </h2>
      <p>
        The Service is not intended for individuals under 18. We do not knowingly collect data from
        minors. If we learn we have collected such data, we will delete it.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        10. International Users
      </h2>
      <p>
        The Service is hosted in the United States. By using it, you consent to the transfer and
        processing of your data in the US, which may have different data protection laws than your
        country.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        11. Cookies
      </h2>
      <p>
        We use essential cookies for authentication and preferences. We may use analytics cookies (e.g.,
        to count visits). You can control cookies via your browser settings; disabling essential cookies
        may break the Service.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        12. Changes to This Policy
      </h2>
      <p>
        We may update this Privacy Policy. Material changes will be communicated via email or in-app
        notice. Continued use after changes means acceptance.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        13. Contact
      </h2>
      <p>
        Privacy questions or rights requests:{' '}
        <a href="mailto:contact@godmanager.us" style={{ color: 'var(--amber)' }}>
          contact@godmanager.us
        </a>
      </p>

      <hr style={{ margin: '40px 0', border: 0, borderTop: '1px solid var(--border)' }} />

      <h2 className="font-heading" style={{ color: 'var(--ink2)', fontSize: 20, fontWeight: 600 }}>
        Política de Privacidade (resumo em português)
      </h2>
      <p style={{ fontStyle: 'italic', color: 'var(--ink3)' }}>
        Este resumo é informativo. Em caso de divergência, a versão em inglês acima prevalece.
      </p>

      <ol style={{ paddingLeft: 20 }}>
        <li>
          <strong>Operador:</strong> Godroox LLC (Kissimmee, FL, EUA). Contato: contact@godmanager.us
        </li>
        <li>
          <strong>Dados coletados:</strong> conta, propriedades, inquilinos, financeiro, uso, cookies.
        </li>
        <li>
          <strong>Finalidades:</strong> prestar o Serviço, processar pagamentos, suporte, segurança,
          compliance.
        </li>
        <li>
          <strong>Terceiros:</strong> Stripe, Resend, Cloudflare, Railway, Anthropic, Crisp, Ramp.
        </li>
        <li>
          <strong>Não vendemos seus dados.</strong> Compartilhamos apenas com fornecedores acima ou por
          exigência legal.
        </li>
        <li>
          <strong>Segurança:</strong> TLS, AES-256, bcrypt, logs de auditoria.
        </li>
        <li>
          <strong>Retenção:</strong> dados mantidos enquanto conta ativa. Após cancelamento, 30 dias.
        </li>
        <li>
          <strong>Seus direitos:</strong> acessar, corrigir, deletar, portar, objetar. Email pra
          solicitar.
        </li>
        <li>
          <strong>Menores:</strong> Serviço não destinado a menores de 18 anos.
        </li>
        <li>
          <strong>Hospedagem:</strong> Estados Unidos. Você consente com transferência internacional.
        </li>
        <li>
          <strong>Cookies:</strong> essenciais para login + analíticas opcionais.
        </li>
        <li>
          <strong>Mudanças:</strong> aviso prévio para alterações relevantes.
        </li>
        <li>
          <strong>Contato LGPD/GDPR:</strong> contact@godmanager.us
        </li>
      </ol>

      <p style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
        © 2026 Godroox LLC · Last updated May 13, 2026
      </p>
    </main>
  );
}
