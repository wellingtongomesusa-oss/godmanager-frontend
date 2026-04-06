export const MP_SESSION_KEY = 'manager_pro_session';
export const DEMO_EMAIL = 'admin@managerpro.local';
export const DEMO_PASSWORD = 'ManagerPRO2026!';

export type ManagerProUserRole = 'admin' | 'primary' | 'collaborator';

export type ManagerProSession = {
  email: string;
  name: string;
  at: string;
  /** Ausente no login legado: inferido por e-mail ou tratado como primary */
  role?: ManagerProUserRole;
};

function inferRole(email: string, explicit?: ManagerProUserRole): ManagerProUserRole {
  if (explicit) return explicit;
  const e = email.toLowerCase();
  if (e.includes('admin') || e === DEMO_EMAIL.toLowerCase()) return 'admin';
  return 'primary';
}

export function getSession(): ManagerProSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MP_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ManagerProSession;
    return {
      ...parsed,
      role: inferRole(parsed.email, parsed.role),
    };
  } catch {
    return null;
  }
}

/** Banner de prazo e ações sensíveis: admin ou primary (não colaborador). */
export function isAdminOrPrimary(): boolean {
  const s = getSession();
  if (!s) return false;
  const r = s.role ?? inferRole(s.email, undefined);
  return r === 'admin' || r === 'primary';
}

export function setSession(s: ManagerProSession) {
  localStorage.setItem(MP_SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(MP_SESSION_KEY);
}

export function validateLogin(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === DEMO_EMAIL.toLowerCase() &&
    password === DEMO_PASSWORD
  );
}
