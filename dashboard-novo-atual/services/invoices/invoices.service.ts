/**
 * Invoices Service – dashboard-novo
 * CRUD, geração de número, cálculos. Mock em memória; trocar por API depois.
 */

import { defaultCompany, type CompanyData } from '@/lib/company';

export type InvoiceStatus = 'pago' | 'em_aberto' | 'atrasado' | 'cancelado';
export type InvoiceCurrency = 'USD' | 'BRL' | 'EUR';
export type PaymentTerms = 'Net 7' | 'Net 15' | 'Net 30' | 'Net 45' | 'Net 60' | 'Due on receipt';

export interface InvoiceClient {
  name: string;
  address: string;
  country: string;
  email: string;
  phone: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  taxAmount: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  client: InvoiceClient;
  company: CompanyData;
  emissionDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  paymentTerms: PaymentTerms;
  items: InvoiceItem[];
  subtotal: number;
  taxes: number;
  discounts: number;
  total: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceFilters = {
  status?: InvoiceStatus | '';
  currency?: InvoiceCurrency | '';
  clientName?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type InvoiceSortField = 'emissionDate' | 'dueDate' | 'total' | 'status';
export type InvoiceSortOrder = 'asc' | 'desc';

const PAYMENT_TERMS_OPTIONS: PaymentTerms[] = ['Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on receipt'];

let mockInvoices: Invoice[] = [];
let _nextNumber = 1001;

function nextNumber(): string {
  const n = `INV-${String(_nextNumber).padStart(5, '0')}`;
  _nextNumber += 1;
  return n;
}

function generateId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function itemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function computeItem(item: Omit<InvoiceItem, 'id' | 'taxAmount' | 'lineTotal'>): Pick<InvoiceItem, 'taxAmount' | 'lineTotal'> {
  const subtotal = item.quantity * item.unitPrice;
  const taxAmount = Math.round(subtotal * (item.taxPercent / 100) * 100) / 100;
  const lineTotal = Math.round((subtotal + taxAmount) * 100) / 100;
  return { taxAmount, lineTotal };
}

export function getPaymentTermsOptions(): PaymentTerms[] {
  return [...PAYMENT_TERMS_OPTIONS];
}

export function getCompany(): CompanyData {
  return { ...defaultCompany };
}

export function getInvoices(filters: InvoiceFilters = {}): Invoice[] {
  let list = [...mockInvoices];
  if (filters.status) list = list.filter((i) => i.status === filters.status);
  if (filters.currency) list = list.filter((i) => i.currency === filters.currency);
  if (filters.clientName?.trim()) {
    const q = filters.clientName.trim().toLowerCase();
    list = list.filter((i) => i.client.name.toLowerCase().includes(q));
  }
  if (filters.dateFrom) list = list.filter((i) => i.emissionDate >= filters.dateFrom!);
  if (filters.dateTo) list = list.filter((i) => i.emissionDate <= filters.dateTo!);
  return list;
}

export function sortInvoices(
  list: Invoice[],
  field: InvoiceSortField,
  order: InvoiceSortOrder
): Invoice[] {
  const cmp = order === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    if (field === 'emissionDate') return cmp * (a.emissionDate > b.emissionDate ? 1 : a.emissionDate < b.emissionDate ? -1 : 0);
    if (field === 'dueDate') return cmp * (a.dueDate > b.dueDate ? 1 : a.dueDate < b.dueDate ? -1 : 0);
    if (field === 'total') return cmp * (a.total - b.total);
    if (field === 'status') return cmp * String(a.status).localeCompare(String(b.status));
    return 0;
  });
}

export function paginateInvoices(list: Invoice[], page: number, perPage: number): Invoice[] {
  const start = (page - 1) * perPage;
  return list.slice(start, start + perPage);
}

export function getInvoiceById(id: string): Invoice | null {
  return mockInvoices.find((i) => i.id === id) ?? null;
}

export interface CreateInvoiceInput {
  client: InvoiceClient;
  company: CompanyData;
  emissionDate: string;
  dueDate: string;
  currency: InvoiceCurrency;
  paymentTerms: PaymentTerms;
  items: { description: string; quantity: number; unitPrice: number; taxPercent: number }[];
  discounts: number;
  notes: string;
  status?: InvoiceStatus;
}

function buildInvoice(
  input: CreateInvoiceInput,
  overrides?: { id: string; number: string; createdAt: string }
): Invoice {
  const items: InvoiceItem[] = input.items.map((it) => {
    const { taxAmount, lineTotal } = computeItem({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxPercent: it.taxPercent,
    });
    return {
      id: itemId(),
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxPercent: it.taxPercent,
      taxAmount,
      lineTotal,
    };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 100) / 100;
  const taxes = Math.round(items.reduce((s, i) => s + i.taxAmount, 0) * 100) / 100;
  const total = Math.round((subtotal + taxes - input.discounts) * 100) / 100;
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? generateId(),
    number: overrides?.number ?? nextNumber(),
    status: input.status ?? 'em_aberto',
    client: { ...input.client },
    company: { ...input.company },
    emissionDate: input.emissionDate,
    dueDate: input.dueDate,
    currency: input.currency,
    paymentTerms: input.paymentTerms,
    items,
    subtotal,
    taxes,
    discounts: input.discounts,
    total,
    notes: input.notes ?? '',
    createdAt: overrides?.createdAt ?? now,
    updatedAt: now,
  };
}

export function createInvoice(input: CreateInvoiceInput): Invoice {
  const inv = buildInvoice(input);
  mockInvoices.unshift(inv);
  return inv;
}

export function updateInvoice(id: string, input: Partial<CreateInvoiceInput>): Invoice | null {
  const idx = mockInvoices.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const existing = mockInvoices[idx]!;
  const base: CreateInvoiceInput = {
    client: input.client ?? existing.client,
    company: input.company ?? existing.company,
    emissionDate: input.emissionDate ?? existing.emissionDate,
    dueDate: input.dueDate ?? existing.dueDate,
    currency: input.currency ?? existing.currency,
    paymentTerms: input.paymentTerms ?? existing.paymentTerms,
    items: input.items ?? existing.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, taxPercent: i.taxPercent })),
    discounts: input.discounts ?? existing.discounts,
    notes: input.notes ?? existing.notes,
  };
  const updated = buildInvoice(
    { ...base, status: input.status ?? existing.status },
    { id: existing.id, number: existing.number, createdAt: existing.createdAt }
  );
  mockInvoices = mockInvoices.filter((i) => i.id !== id);
  mockInvoices.unshift(updated);
  return updated;
}

export function setInvoiceStatus(id: string, status: InvoiceStatus): Invoice | null {
  const inv = getInvoiceById(id);
  if (!inv) return null;
  inv.status = status;
  inv.updatedAt = new Date().toISOString();
  return inv;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Seed mock data for demo */
export function seedMockInvoices(): void {
  if (mockInvoices.length > 0) return;
  const company = getCompany();
  createInvoice({
    client: { name: 'Acme Corp', address: '123 Main St', country: 'United States', email: 'billing@acme.com', phone: '+1 555-0100' },
    company,
    emissionDate: '2025-01-10',
    dueDate: '2025-02-09',
    currency: 'USD',
    paymentTerms: 'Net 30',
    items: [
      { description: 'Consulting services', quantity: 10, unitPrice: 150, taxPercent: 0 },
      { description: 'Software license', quantity: 1, unitPrice: 1200, taxPercent: 0 },
    ],
    discounts: 0,
    notes: 'Thank you for your business.',
    status: 'pago',
  });
  createInvoice({
    client: { name: 'Tech Ltda', address: 'Rua das Flores, 50', country: 'Brasil', email: 'financeiro@tech.com', phone: '+55 11 99999-0000' },
    company,
    emissionDate: '2025-01-15',
    dueDate: '2025-02-14',
    currency: 'BRL',
    paymentTerms: 'Net 30',
    items: [{ description: 'Suporte mensal', quantity: 1, unitPrice: 2500, taxPercent: 0 }],
    discounts: 100,
    notes: '',
    status: 'em_aberto',
  });
  createInvoice({
    client: { name: 'Euro Solutions', address: '10 Rue de la Paix', country: 'France', email: 'info@eurosol.eu', phone: '+33 1 00 00 00 00' },
    company,
    emissionDate: '2025-01-05',
    dueDate: '2025-01-12',
    currency: 'EUR',
    paymentTerms: 'Net 7',
    items: [{ description: 'Implementation', quantity: 40, unitPrice: 85, taxPercent: 20 }],
    discounts: 0,
    notes: 'VAT included.',
    status: 'atrasado',
  });
}
