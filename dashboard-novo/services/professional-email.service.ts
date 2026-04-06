/**
 * E-mail profissional @godcrm.com – dashboard-novo
 * Solicitação e provisionamento (mock). Integrar Google Workspace, Zoho, Cloudflare, etc. via env.
 */

const DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'godcrm.com';

export interface ProfessionalEmailRequest {
  id: string;
  requestedLocal: string;
  fullEmail: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const STORAGE_KEY = 'godcrm_pro_email_requests';

function getRequests(): ProfessionalEmailRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? (JSON.parse(s) as ProfessionalEmailRequest[]) : [];
  } catch {
    return [];
  }
}

function saveRequests(r: ProfessionalEmailRequest[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

export function getEmailDomain(): string {
  return DOMAIN;
}

export function requestProfessionalEmail(localPart: string): Promise<ProfessionalEmailRequest> {
  const trimmed = (localPart || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!trimmed) return Promise.reject(new Error('Informe o nome desejado para o e-mail.'));
  const full = `${trimmed}@${DOMAIN}`;
  const req: ProfessionalEmailRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    requestedLocal: trimmed,
    fullEmail: full,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  const list = getRequests();
  list.unshift(req);
  saveRequests(list);
  return Promise.resolve(req);
}

export function listProfessionalEmailRequests(): Promise<ProfessionalEmailRequest[]> {
  return Promise.resolve([...getRequests()]);
}
