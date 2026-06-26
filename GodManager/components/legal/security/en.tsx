export function SecurityContentEn() {
  return (
    <>
    <p style={{ margin: '0 0 12px' }}>
      <strong>Godroox LLC — GodManager Platform</strong><br />
      <strong>Owner: Wellington Alves Gomes, Owner, Godroox LLC</strong>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>1. Purpose and Scope</h2>
    <p style={{ margin: '0 0 12px' }}>
      This Information Security Policy describes how Godroox LLC (&quot;Godroox&quot;) protects the confidentiality, integrity, and availability of the information processed by the GodManager platform (&quot;the Service&quot;). It applies to all systems, data, personnel, and third-party services involved in operating the Service.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      GodManager is a software-as-a-service property management platform for property management companies in the United States. It processes business and personal data including property records, tenant and owner information, financial transactions, and — where a user chooses to connect a bank account — encrypted financial account tokens obtained through Plaid.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      This document describes both the controls currently in place and the improvements that are planned or in progress, with target timelines. Godroox treats information security as an ongoing program of continuous improvement.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>2. Organization and Responsibility</h2>
    <p style={{ margin: '0 0 12px' }}>
      Godroox is a small organization. The Owner, Wellington Alves Gomes, is responsible for information security decisions, including access management, vendor selection, incident response, and approval of changes to production systems.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      System access is limited to the Owner and a small number of vetted contractors engaged for specific development tasks. Access is granted on a least-privilege basis and removed when no longer required.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>3. Access Control</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Authentication:</strong> Users authenticate with a username (email) and password. Passwords are stored using bcrypt one-way hashing (12 rounds); plain-text passwords are never stored.</li>
      <li style={{ marginBottom: 6 }}><strong>Session management:</strong> Authenticated sessions use a secure, HTTP-only cookie. In production, the session cookie is marked Secure (transmitted only over HTTPS) and SameSite to mitigate cross-site risks. Sessions expire after 24 hours.</li>
      <li style={{ marginBottom: 6 }}><strong>Brute-force protection:</strong> Login attempts are rate-limited (a maximum number of attempts per window, with temporary lockout) to deter automated password-guessing.</li>
      <li style={{ marginBottom: 6 }}><strong>Role-based access control:</strong> The Service defines distinct user roles (administrator, manager, accountant, leasing, maintenance, field, viewer, owner, tenant, vendor, and platform super-administrator). Access to features and data is gated by role and per-section permissions.</li>
      <li style={{ marginBottom: 6 }}><strong>Tenant isolation:</strong> The Service is multi-tenant. Each client organization&apos;s data is scoped by a client identifier so that users can access only the data belonging to their organization. Database-level row isolation provides defense in depth.</li>
      <li style={{ marginBottom: 6 }}><strong>Administrative access:</strong> Access to production infrastructure (hosting, database, storage, code repository) is restricted to the Owner and protected by multi-factor authentication (MFA) on each provider account. Credentials are stored in a password manager, not in plain text or in code.</li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>4. Data Protection and Encryption</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Encryption in transit:</strong> All traffic between clients and the Service is served over HTTPS/TLS by the hosting and edge providers.</li>
      <li style={{ marginBottom: 6 }}><strong>Encryption of sensitive credentials at rest:</strong> Bank account access tokens obtained through Plaid are encrypted at the application layer using AES-256-GCM before being stored. The encryption key is held only in the production environment configuration and is never committed to source control.</li>
      <li style={{ marginBottom: 6 }}><strong>Password hashing:</strong> As above, bcrypt is used for all account passwords.</li>
      <li style={{ marginBottom: 6 }}><strong>No card data stored:</strong> Godroox does not store full payment card numbers. Subscription card payments are handled by Stripe.</li>
      <li style={{ marginBottom: 6 }}><strong>Database and storage:</strong> The production database (PostgreSQL) and object storage (Cloudflare R2) are hosted by reputable providers that apply encryption at rest at the infrastructure level.</li>
    </ul>
    <h3 style={{ fontSize: 17, fontWeight: 600, marginTop: 20, marginBottom: 8 }}>Planned improvements (data protection)</h3>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Encryption of additional sensitive fields:</strong> Certain sensitive fields entered by client organizations (for example, tenant SSN/ITIN and vendor bank account details) are currently stored in plain text within the tenant-isolated database. Godroox is implementing application-layer encryption (using the same AES-256-GCM mechanism already in place for Plaid tokens) for these fields. <strong>Target: within 60 days.</strong></li>
      <li style={{ marginBottom: 6 }}><strong>Signed session tokens:</strong> Godroox is upgrading session cookies to use cryptographic signing (HMAC) to further protect session integrity. <strong>Target: within 60 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>5. Network and Transport Security</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>The Service is delivered over HTTPS/TLS by the hosting platform (Railway) and edge/CDN provider (Cloudflare).</li>
      <li style={{ marginBottom: 6 }}>Godroox is adding HTTP security response headers (including HTTP Strict Transport Security, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy) at the application layer to enforce HTTPS and reduce common web risks. <strong>Target: within 30 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>6. Logging, Monitoring, and Audit</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}><strong>Audit logging:</strong> Key actions (such as record deletions, balance updates, password changes, and financial document changes) are recorded in an audit log capturing the actor, timestamp, IP address, user agent, and relevant context.</li>
      <li style={{ marginBottom: 6 }}><strong>Application monitoring:</strong> Application errors and operational events are logged through the hosting platform.</li>
      <li style={{ marginBottom: 6 }}><strong>Planned improvement:</strong> Godroox is expanding audit coverage to additional sensitive operations and defining a log retention period. <strong>Target: within 90 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>7. Vendor and Subprocessor Management</h2>
    <p style={{ margin: '0 0 12px' }}>
      Godroox relies on established, reputable third-party providers, each processing only the data needed for its function:
    </p>
    <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginTop: 12, marginBottom: 16, fontSize: 14 }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Provider</th>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Function</th>
          <th style={{ border: '1px solid #e5e7eb', padding: '8px 12px', textAlign: 'left' as const, background: '#f9fafb', fontWeight: 600 }}>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Railway</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Application hosting and PostgreSQL database</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>United States</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Cloudflare R2</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Object storage (photos, documents)</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Encryption at rest</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Stripe</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Subscription payment processing</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>PCI-compliant; no card data stored by Godroox</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Plaid</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Bank account verification and linking</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Auth and Identity products; access tokens encrypted by Godroox</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Resend</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Transactional email delivery</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Crisp</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Marketing-site chat</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Ramp</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Corporate card / expense integration</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Intuit QuickBooks</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Optional accounting integration</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Enabled per client</td>
        </tr>
        <tr>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>Anthropic</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}>AI-assisted features</td>
          <td style={{ border: '1px solid #e5e7eb', padding: '8px 12px', verticalAlign: 'top' as const }}></td>
        </tr>
      </tbody>
    </table>
    <p style={{ margin: '0 0 12px' }}>
      Godroox selects vendors that maintain recognized security practices and reviews this list periodically.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>8. Plaid Integration — Scope and Handling</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Godroox uses Plaid&apos;s <strong>Auth</strong> and <strong>Identity</strong> products to verify and link bank accounts at the user&apos;s request.</li>
      <li style={{ marginBottom: 6 }}>Godroox does <strong>not</strong> use Plaid to move money, initiate payments, or retrieve transaction history.</li>
      <li style={{ marginBottom: 6 }}>Godroox does <strong>not</strong> receive or store users&apos; online banking credentials; these are handled solely by Plaid.</li>
      <li style={{ marginBottom: 6 }}>Data received from Plaid (access tokens and limited account metadata) is treated as sensitive. Access tokens are encrypted at rest (AES-256-GCM). Only the last digits of an account number (the mask) are retained for display.</li>
      <li style={{ marginBottom: 6 }}>Users may disconnect a linked account; Godroox is adding a self-service disconnect/revocation flow. <strong>Target: within 60 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>9. Vulnerability Management</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Godroox relies on managed, patched infrastructure from its hosting and platform providers, and keeps application dependencies updated.</li>
      <li style={{ marginBottom: 6 }}>Code changes affecting production are reviewed before deployment, with particular scrutiny for changes that touch financial data or authentication.</li>
      <li style={{ marginBottom: 6 }}><strong>Planned improvement:</strong> Godroox is establishing a routine process to scan application dependencies and production assets for known vulnerabilities and to remediate findings on a defined schedule. <strong>Target: within 90 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>10. Data Retention and Deletion</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Data is retained while a client account is active and as required for legal, accounting, and audit purposes.</li>
      <li style={{ marginBottom: 6 }}>After account closure, production data is deleted after a limited recovery window; backups are overwritten on a rolling basis.</li>
      <li style={{ marginBottom: 6 }}><strong>Planned improvement:</strong> Godroox is formalizing and automating its retention and deletion schedule, including a defined retention period for audit logs and a documented process for honoring deletion requests. <strong>Target: within 90 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>11. Backup and Recovery</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>The production database is hosted on Railway, which provides managed backups at the infrastructure level.</li>
      <li style={{ marginBottom: 6 }}><strong>Planned improvement:</strong> Godroox is documenting its backup configuration and recovery procedure, and will periodically test data restoration to confirm recoverability. <strong>Target: within 60 days.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>12. Incident Response</h2>
    <p style={{ margin: '0 0 12px' }}>
      In the event of a suspected security incident, Godroox follows these steps:
    </p>
    <p style={{ margin: '0 0 12px' }}>
      1. <strong>Contain:</strong> Isolate the affected system; if a deployment is implicated, roll back to the last known-good release.<br />
      2. <strong>Assess:</strong> Determine the scope and what data may have been affected.<br />
      3. <strong>Remediate:</strong> Fix the underlying cause and rotate any potentially exposed credentials.<br />
      4. <strong>Notify:</strong> Inform affected client organizations and, where required by law, affected individuals and authorities, without undue delay.<br />
      5. <strong>Review:</strong> Document the incident and the corrective actions taken.
    </p>
    <p style={{ margin: '0 0 12px' }}>
      Godroox is formalizing this procedure into a written incident-response plan with defined notification timelines. <strong>Target: within 60 days.</strong>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>13. User Authentication and MFA Roadmap</h2>
    <ul style={{ margin: '0 0 12px', paddingLeft: 24 }}>
      <li style={{ marginBottom: 6 }}>Administrative access to production infrastructure is protected by MFA at the provider level.</li>
      <li style={{ marginBottom: 6 }}>End-user accounts in the Service currently authenticate with username and password, with brute-force rate limiting.</li>
      <li style={{ marginBottom: 6 }}><strong>Planned improvement:</strong> Godroox is evaluating and intends to implement multi-factor authentication for end users, prioritizing accounts that can link financial accounts via Plaid. <strong>Target: under evaluation; roadmap item.</strong></li>
    </ul>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>14. Privacy</h2>
    <p style={{ margin: '0 0 12px' }}>
      Godroox maintains a public Privacy Policy describing what data is collected, how it is used, with whom it is shared, and the rights of individuals. The Privacy Policy is available at godmanager.us and is provided in English, Portuguese, and Spanish.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>15. Policy Review</h2>
    <p style={{ margin: '0 0 12px' }}>
      This Information Security Policy is reviewed periodically and updated as the Service and its controls evolve. Material changes are reflected in the &quot;Last updated&quot; date.
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <h2 style={{ fontFamily: 'var(--font-playfair, "Cormorant Garamond"), serif', fontSize: 20, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>16. Contact</h2>
    <p style={{ margin: '0 0 12px' }}>
      For security questions or to report a vulnerability or incident:
    </p>
    <p style={{ margin: '0 0 12px' }}>
      <strong>Godroox LLC</strong><br />
      7480 Stone Creek Trail, Kissimmee, FL 34747, USA<br />
      Email: <a href="mailto:contact@godmanager.us" style={{ color: '#c9a96e' }}>contact@godmanager.us</a>
    </p>
    <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
    <p style={{ margin: '0 0 12px' }}>
      *This document reflects controls in place as of the last-updated date and improvements in progress with target timelines. It is maintained internally by Godroox LLC and is intended to describe our security program accurately and honestly.*
    </p>
    </>
  );
}
