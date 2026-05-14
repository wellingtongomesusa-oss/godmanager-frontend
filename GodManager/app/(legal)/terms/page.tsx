import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — GodManager',
  description: 'Terms of Service for GodManager, a Godroox LLC product.',
};

export default function TermsPage() {
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
        Terms of Service
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
        1. Agreement
      </h2>
      <p>
        These Terms of Service (&quot;Terms&quot;) constitute a binding agreement between you
        (&quot;User&quot;, &quot;you&quot;) and Godroox LLC, a Florida limited liability company with
        registered address at 7480 Stone Creek Trail, Kissimmee, FL 34747 (&quot;Godroox&quot;,
        &quot;we&quot;, &quot;us&quot;), regarding your use of the GodManager platform available at
        godmanager.us and related services (the &quot;Service&quot;).
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        2. Description of Service
      </h2>
      <p>
        GodManager is a SaaS platform designed for property managers in the United States to manage
        properties, tenants, vendors, maintenance jobs, expenses, owner payments, and related
        operational tasks. The Service is provided &quot;as is&quot; on a subscription basis.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        3. User Accounts
      </h2>
      <p>
        You must register an account to use the Service. You agree to: (a) provide accurate
        registration information; (b) maintain the security of your password and access credentials;
        (c) be responsible for all activity under your account; (d) notify us immediately of any
        unauthorized use. We reserve the right to suspend or terminate accounts for violation of these
        Terms.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        4. Acceptable Use
      </h2>
      <p>
        You agree NOT to: (a) reverse engineer, decompile, or attempt to extract source code; (b)
        scrape, crawl, or harvest data via automated means; (c) resell or sublicense the Service
        without written consent; (d) upload malware, viruses, or harmful content; (e) violate any
        applicable law (US federal, Florida state, or other applicable jurisdiction); (f) impersonate
        others or misrepresent your affiliation.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        5. Intellectual Property
      </h2>
      <p>
        All rights, title, and interest in and to the Service — including software, source code,
        design, trademarks (including &quot;GodManager&quot;), database schemas, algorithms,
        documentation, and any derivatives thereof — are and remain the exclusive property of Godroox
        LLC. These Terms grant you a limited, revocable, non-exclusive, non-transferable license to
        use the Service for its intended purpose during your active subscription.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        6. User Content
      </h2>
      <p>
        You retain ownership of data you upload to the Service (property records, tenant information,
        financial data, photos). You grant Godroox a limited license to host, process, and display
        such data solely to provide the Service to you. We do not sell your data to third parties.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        7. Subscription, Billing, and Refunds
      </h2>
      <p>
        The Service is offered under monthly or annual subscription plans as described at
        godmanager.us/pricing. Fees are billed in advance and are non-refundable except as required by
        applicable law. You may cancel your subscription at any time; cancellation takes effect at the
        end of the current billing period.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        8. Disclaimers and Limitation of Liability
      </h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
        KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, GODROOX DISCLAIMS ALL WARRANTIES, EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        IN NO EVENT SHALL GODROOX BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR SPECIAL
        DAMAGES ARISING FROM YOUR USE OF THE SERVICE. Our total liability shall not exceed the amount
        you paid Godroox in the twelve (12) months preceding the claim.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        9. Termination
      </h2>
      <p>
        We may suspend or terminate your access at any time for violation of these Terms. Upon
        termination, your right to use the Service ceases, and we may delete your data after a
        reasonable retention period (typically 30 days).
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        10. Governing Law and Venue
      </h2>
      <p>
        These Terms shall be governed by the laws of the State of Florida, USA, without regard to
        conflict of laws principles. Any dispute shall be submitted exclusively to the state or
        federal courts located in Orange County, Florida.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        11. Changes
      </h2>
      <p>
        We may modify these Terms at any time. Material changes will be communicated via email or
        in-app notice at least 30 days before taking effect. Continued use after changes constitutes
        acceptance.
      </p>

      <h2 className="font-heading" style={{ fontSize: 20, fontWeight: 600, marginTop: 24 }}>
        12. Contact
      </h2>
      <p>
        Questions about these Terms:{' '}
        <a href="mailto:contact@godmanager.us" style={{ color: 'var(--amber)' }}>
          contact@godmanager.us
        </a>
      </p>

      <hr style={{ margin: '40px 0', border: 0, borderTop: '1px solid var(--border)' }} />

      <h2 className="font-heading" style={{ color: 'var(--ink2)', fontSize: 20, fontWeight: 600 }}>
        Termos de Serviço (resumo em português)
      </h2>
      <p style={{ fontStyle: 'italic', color: 'var(--ink3)' }}>
        Este resumo é informativo. Em caso de divergência, a versão em inglês acima prevalece.
      </p>

      <ol style={{ paddingLeft: 20 }}>
        <li>
          <strong>Acordo:</strong> Estes Termos vinculam você e a Godroox LLC (sede: 7480 Stone Creek
          Trail, Kissimmee, FL 34747).
        </li>
        <li>
          <strong>Serviço:</strong> GodManager é uma plataforma SaaS para property managers nos EUA.
        </li>
        <li>
          <strong>Conta:</strong> Você é responsável pela segurança e atividade na sua conta.
        </li>
        <li>
          <strong>Uso Permitido:</strong> proibido reverse engineering, scraping, revenda, conteúdo
          malicioso ou violação de lei.
        </li>
        <li>
          <strong>Propriedade Intelectual:</strong> todo o software, código, marca e design são da
          Godroox LLC.
        </li>
        <li>
          <strong>Seus Dados:</strong> você mantém propriedade dos dados que sobe. Não vendemos a
          terceiros.
        </li>
        <li>
          <strong>Assinatura:</strong> mensal/anual conforme planos. Cancelável a qualquer momento, sem
          reembolso retroativo.
        </li>
        <li>
          <strong>Garantias:</strong> serviço &quot;como está&quot;. Limitação de responsabilidade
          conforme cláusula 8.
        </li>
        <li>
          <strong>Encerramento:</strong> podemos suspender por violação. Dados são deletados após
          retenção razoável.
        </li>
        <li>
          <strong>Lei Aplicável:</strong> Estado da Flórida, EUA. Foro: Orange County, Florida.
        </li>
        <li>
          <strong>Alterações:</strong> aviso prévio de 30 dias para mudanças materiais.
        </li>
        <li>
          <strong>Contato:</strong> contact@godmanager.us
        </li>
      </ol>

      <p style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: 'var(--ink3)' }}>
        © 2026 Godroox LLC · Last updated May 13, 2026
      </p>
    </main>
  );
}
