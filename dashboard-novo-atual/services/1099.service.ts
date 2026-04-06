/**
 * 1099 Service – Formulários 1099-NEC, 1099-MISC, 1099-INT.
 * Armazenamento em memória; exportação CSV/PDF.
 */

export type Form1099Type = '1099-NEC' | '1099-MISC' | '1099-INT';

export interface Recipient1099 {
  id: string;
  name: string;
  tin: string;
  amount: number;
  formType: Form1099Type;
  taxYear: number;
}

const STORAGE_KEY = 'godcrm_1099_recipients';

function loadRecipients(): Recipient1099[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Recipient1099[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecipients(list: Recipient1099[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function list1099Recipients(filters?: { formType?: Form1099Type; taxYear?: number }): Recipient1099[] {
  let list = loadRecipients();
  if (filters?.formType) list = list.filter((r) => r.formType === filters.formType);
  if (filters?.taxYear != null) list = list.filter((r) => r.taxYear === filters.taxYear);
  return list;
}

export function add1099Recipient(r: Omit<Recipient1099, 'id'>): Recipient1099 {
  const list = loadRecipients();
  const id = `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const rec: Recipient1099 = { ...r, id };
  list.push(rec);
  saveRecipients(list);
  return rec;
}

export function remove1099Recipient(id: string): void {
  const list = loadRecipients().filter((x) => x.id !== id);
  saveRecipients(list);
}

export function get1099RecipientById(id: string): Recipient1099 | null {
  return loadRecipients().find((r) => r.id === id) ?? null;
}

export function get1099ExportData(filters?: { formType?: Form1099Type; taxYear?: number }): Record<string, string | number>[] {
  const list = list1099Recipients(filters);
  return list.map((r) => ({
    'Form Type': r.formType,
    'Tax Year': r.taxYear,
    'Recipient Name': r.name,
    TIN: r.tin,
    'Amount (USD)': r.amount,
  }));
}
