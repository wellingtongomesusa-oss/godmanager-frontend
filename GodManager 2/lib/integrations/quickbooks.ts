/**
 * QuickBooks Online — cliente tipado (demo + preparação OAuth).
 * Variáveis: QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REDIRECT_URI
 */

export type QuickBooksConnectionStatus = 'desconectado' | 'conectado' | 'erro';

export type QboQueryRow = {
  id: string;
  tipo: 'invoice' | 'purchase' | 'journal';
  total: number;
  data: string;
  memo: string;
};

export type QboAccount = {
  id: string;
  nome: string;
  tipo: string;
};

export type QboInvoiceCreatePayload = {
  cliente: string;
  linhas: { descricao: string; valor: number }[];
};

export type QboInvoiceCreateResult = {
  id: string;
  status: 'criada';
};

const DEMO_ACCOUNTS: QboAccount[] = [
  { id: 'acc-1', nome: 'Receita de aluguel', tipo: 'Income' },
  { id: 'acc-2', nome: 'Contas a receber', tipo: 'Accounts Receivable' },
];

const DEMO_QUERY: QboQueryRow[] = [
  { id: 'q-1', tipo: 'invoice', total: 4200, data: '2026-03-15', memo: 'Aluguel março' },
  { id: 'q-2', tipo: 'purchase', total: 180, data: '2026-03-18', memo: 'Manutenção' },
];

export function getQuickBooksAuthorizeUrl(): string {
  if (typeof window === 'undefined') return '/api/integrations/quickbooks/authorize';
  return `${window.location.origin}/api/integrations/quickbooks/authorize`;
}

export async function queryTransactionsDemo(companyId: string): Promise<QboQueryRow[]> {
  void companyId;
  await new Promise((r) => setTimeout(r, 200));
  return DEMO_QUERY;
}

export async function listAccountsDemo(companyId: string): Promise<QboAccount[]> {
  void companyId;
  await new Promise((r) => setTimeout(r, 150));
  return DEMO_ACCOUNTS;
}

export async function createInvoiceDemo(
  companyId: string,
  payload: QboInvoiceCreatePayload,
): Promise<QboInvoiceCreateResult> {
  void companyId;
  void payload;
  await new Promise((r) => setTimeout(r, 250));
  return { id: `qbo-inv-${Date.now()}`, status: 'criada' };
}
