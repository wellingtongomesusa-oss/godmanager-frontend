export const MP_SESSION_KEY = 'manager_pro_session';
export const DEMO_EMAIL = 'admin@managerpro.local';
export const DEMO_PASSWORD = 'ManagerPRO2026!';

export type ManagerProSession = {
  email: string;
  name: string;
  at: string;
};

export function getSession(): ManagerProSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MP_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ManagerProSession;
  } catch {
    return null;
  }
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
