/**
 * Invoice helpers: currency format, sanitize, totals.
 */

export const CURRENCY = 'BRL';
export const CURRENCY_SYMBOL = 'R$';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/\D/g, '');
  if (!cleaned) return 0;
  return parseInt(cleaned, 10) / 100;
}

export function formatCurrencyInput(value: number): string {
  return formatCurrency(value);
}

/** Sanitize for display (prevent XSS). */
export function sanitize(text: string): string {
  if (typeof text !== 'string') return '';
  const div = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }
  return text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c] || c);
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export function getSubtotal(item: LineItem): number {
  return item.quantity * item.unitPrice;
}

export function getTotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + getSubtotal(item), 0);
}

export function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = 'invoice-draft';

export function loadDraft(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDraft(data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
