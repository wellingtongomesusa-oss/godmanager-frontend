import type { InvoiceRecord } from '@/lib/manager-pro/invoiceTypes';

const LS = 'invoices_demo_v1';

const SEED: InvoiceRecord[] = [
  {
    id: 'inv-001',
    numero: '2026-001',
    cliente: 'HOPM Services Corp',
    valor: 12800,
    status: 'enviada',
    vencimento: '2026-04-15',
    criadoEm: '2026-03-01',
  },
  {
    id: 'inv-002',
    numero: '2026-002',
    cliente: 'Storey Lake HOA',
    valor: 4200,
    status: 'rascunho',
    vencimento: '2026-04-01',
    criadoEm: '2026-03-20',
  },
];

function read(): InvoiceRecord[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) {
      localStorage.setItem(LS, JSON.stringify(SEED));
      return SEED;
    }
    const parsed = JSON.parse(raw) as InvoiceRecord[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED;
  } catch {
    return SEED;
  }
}

function write(rows: InvoiceRecord[]) {
  localStorage.setItem(LS, JSON.stringify(rows));
}

export function listInvoices(): InvoiceRecord[] {
  return read();
}

export function getInvoice(id: string): InvoiceRecord | undefined {
  return read().find((r) => r.id === id);
}

export function updateInvoiceStatus(id: string, status: InvoiceRecord['status']): void {
  const rows = read().map((r) => (r.id === id ? { ...r, status } : r));
  write(rows);
}

export function deleteInvoice(id: string): void {
  write(read().filter((r) => r.id !== id));
}
