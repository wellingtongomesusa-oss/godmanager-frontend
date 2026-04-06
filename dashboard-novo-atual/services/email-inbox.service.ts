/**
 * Caixa de E-mail – dashboard-novo
 * Configuração, listagem e envio (mock). Integrar Gmail API, Microsoft Graph, SendGrid etc. via env.
 */

const STORAGE_KEY = 'godcrm_email_config';

export type EmailProvider = 'gmail' | 'outlook' | 'sendgrid' | 'mailgun' | 'ses';

export interface EmailConfig {
  provider: EmailProvider;
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export interface InboxEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  read: boolean;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}

function getConfig(): EmailConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? (JSON.parse(s) as EmailConfig) : null;
  } catch {
    return null;
  }
}

function setConfig(c: EmailConfig) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

export function getEmailConfig(): EmailConfig | null {
  return getConfig();
}

export function setEmailConfig(config: Partial<EmailConfig>): EmailConfig {
  const prev = getConfig();
  const next: EmailConfig = {
    provider: config.provider ?? prev?.provider ?? 'gmail',
    connected: config.connected ?? prev?.connected ?? false,
    email: config.email ?? prev?.email,
    connectedAt: config.connectedAt ?? prev?.connectedAt,
  };
  setConfig(next);
  return next;
}

export function connectEmail(provider: EmailProvider, email: string): Promise<EmailConfig> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const config = setEmailConfig({
        provider,
        connected: true,
        email,
        connectedAt: new Date().toISOString(),
      });
      resolve(config);
    }, 800);
  });
}

export function disconnectEmail(): void {
  setEmailConfig({ connected: false, email: undefined, connectedAt: undefined });
}

const MOCK_INBOX: InboxEmail[] = [
  { id: '1', from: 'suporte@godcrm.com', to: 'voce@email.com', subject: 'Bem-vindo ao GodCRM', date: new Date().toISOString(), snippet: 'Olá! Confirmamos seu cadastro...', read: false },
  { id: '2', from: 'noreply@exemplo.com', to: 'voce@email.com', subject: 'Atualização do seu pedido', date: new Date(Date.now() - 86400000).toISOString(), snippet: 'Seu pedido #1234 foi enviado.', read: true },
  { id: '3', from: 'contato@parceiro.com', to: 'voce@email.com', subject: 'Re: Proposta comercial', date: new Date(Date.now() - 172800000).toISOString(), snippet: 'Segue em anexo a proposta solicitada...', read: true },
];

export function listInboxEmails(): Promise<InboxEmail[]> {
  return Promise.resolve([...MOCK_INBOX]);
}

export function sendInboxEmail(payload: SendEmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!payload.to?.trim()) return Promise.resolve({ success: false, error: 'Destinatário é obrigatório.' });
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, id: `mock-sent-${Date.now()}` });
    }, 600);
  });
}
