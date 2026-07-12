import { qbApiFetch } from '@/lib/quickbooks';

/**
 * Lançamentos no QuickBooks Online (API v3) seguindo double-entry / US GAAP.
 *
 *  - Purchase  → despesa PAGA (cartão/banco): débito conta de despesa, crédito conta de pagamento.
 *  - Bill      → despesa A PAGAR (accounts payable): débito despesa, crédito A/P.
 *  - Invoice   → receita a receber (accounts receivable): débito A/R, crédito receita (via Item).
 */

const MINOR = '65';

type QbFault = { Fault?: { Error?: Array<{ Message?: string; Detail?: string; code?: string }> } };

function faultMessage(json: unknown, fallback: string): string {
  const f = json as QbFault;
  const e = f?.Fault?.Error?.[0];
  if (e) return `${e.Message || 'QuickBooks error'}${e.Detail ? ' — ' + e.Detail : ''}${e.code ? ' [' + e.code + ']' : ''}`;
  return fallback;
}

async function qbRead(clientId: string, path: string): Promise<unknown> {
  const res = await qbApiFetch(clientId, path.includes('?') ? `${path}&minorversion=${MINOR}` : `${path}?minorversion=${MINOR}`);
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`QuickBooks: resposta inválida (${res.status})`);
  }
  if (!res.ok) throw new Error(faultMessage(json, `QuickBooks ${res.status}`));
  return json;
}

async function qbCreate(clientId: string, entity: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await qbApiFetch(clientId, `${entity}?minorversion=${MINOR}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`QuickBooks: resposta inválida (${res.status})`);
  }
  if (!res.ok) throw new Error(faultMessage(json, `QuickBooks ${res.status}`));
  return json as Record<string, unknown>;
}

// ---- Leitura (para dropdowns de mapeamento) ---------------------------------

export type QbAccount = { id: string; name: string; accountType: string; accountSubType: string; classification: string; active: boolean };
export type QbNamed = { id: string; name: string; active: boolean };

function esc(v: string): string {
  return String(v).replace(/'/g, "\\'");
}

export async function qbListAccounts(clientId: string): Promise<QbAccount[]> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Account where Active = true maxresults 1000')}`)) as {
    QueryResponse?: { Account?: Array<Record<string, unknown>> };
  };
  const rows = json?.QueryResponse?.Account || [];
  return rows.map((a) => ({
    id: String(a.Id ?? ''),
    name: String(a.Name ?? ''),
    accountType: String(a.AccountType ?? ''),
    accountSubType: String(a.AccountSubType ?? ''),
    classification: String(a.Classification ?? ''),
    active: a.Active !== false,
  }));
}

export async function qbListVendors(clientId: string): Promise<QbNamed[]> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Vendor where Active = true maxresults 1000')}`)) as {
    QueryResponse?: { Vendor?: Array<Record<string, unknown>> };
  };
  return (json?.QueryResponse?.Vendor || []).map((v) => ({ id: String(v.Id ?? ''), name: String(v.DisplayName ?? ''), active: v.Active !== false }));
}

export async function qbListCustomers(clientId: string): Promise<QbNamed[]> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Customer where Active = true maxresults 1000')}`)) as {
    QueryResponse?: { Customer?: Array<Record<string, unknown>> };
  };
  return (json?.QueryResponse?.Customer || []).map((c) => ({ id: String(c.Id ?? ''), name: String(c.DisplayName ?? ''), active: c.Active !== false }));
}

export async function qbListItems(clientId: string): Promise<QbNamed[]> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Item where Active = true maxresults 1000')}`)) as {
    QueryResponse?: { Item?: Array<Record<string, unknown>> };
  };
  return (json?.QueryResponse?.Item || []).map((i) => ({ id: String(i.Id ?? ''), name: String(i.Name ?? ''), active: i.Active !== false }));
}

/** Busca um vendor pelo nome; cria se não existir. Retorna o Id. */
export async function qbFindOrCreateVendor(clientId: string, displayName: string): Promise<string> {
  const name = displayName.trim().slice(0, 100) || 'Unknown Vendor';
  const json = (await qbRead(
    clientId,
    `query?query=${encodeURIComponent(`select * from Vendor where DisplayName = '${esc(name)}'`)}`,
  )) as { QueryResponse?: { Vendor?: Array<Record<string, unknown>> } };
  const found = json?.QueryResponse?.Vendor?.[0];
  if (found?.Id) return String(found.Id);
  const created = await qbCreate(clientId, 'vendor', { DisplayName: name });
  const v = created?.Vendor as Record<string, unknown> | undefined;
  return String(v?.Id ?? '');
}

// ---- Escrita (lançamentos) --------------------------------------------------

export type PurchaseInput = {
  amount: number;
  expenseAccountId: string; // conta de despesa (débito)
  paymentAccountId: string; // conta bancária/cartão (crédito)
  paymentType?: 'CreditCard' | 'Cash' | 'Check';
  vendorId?: string | null;
  txnDate?: string | null; // YYYY-MM-DD
  memo?: string | null;
  description?: string | null;
};

export async function qbCreatePurchase(clientId: string, input: PurchaseInput): Promise<{ id: string; docNumber: string | null }> {
  const body: Record<string, unknown> = {
    PaymentType: input.paymentType || 'CreditCard',
    AccountRef: { value: input.paymentAccountId },
    TxnDate: input.txnDate || undefined,
    PrivateNote: input.memo || undefined,
    Line: [
      {
        Amount: Number(input.amount.toFixed(2)),
        DetailType: 'AccountBasedExpenseLineDetail',
        Description: input.description || undefined,
        AccountBasedExpenseLineDetail: { AccountRef: { value: input.expenseAccountId } },
      },
    ],
  };
  if (input.vendorId) body.EntityRef = { value: input.vendorId, type: 'Vendor' };
  const res = await qbCreate(clientId, 'purchase', body);
  const p = res?.Purchase as Record<string, unknown> | undefined;
  return { id: String(p?.Id ?? ''), docNumber: p?.DocNumber ? String(p.DocNumber) : null };
}

export type BillInput = {
  amount: number;
  expenseAccountId: string;
  vendorId: string; // A/P exige vendor
  txnDate?: string | null;
  dueDate?: string | null;
  memo?: string | null;
  description?: string | null;
};

export async function qbCreateBill(clientId: string, input: BillInput): Promise<{ id: string; docNumber: string | null }> {
  const body: Record<string, unknown> = {
    VendorRef: { value: input.vendorId },
    TxnDate: input.txnDate || undefined,
    DueDate: input.dueDate || undefined,
    PrivateNote: input.memo || undefined,
    Line: [
      {
        Amount: Number(input.amount.toFixed(2)),
        DetailType: 'AccountBasedExpenseLineDetail',
        Description: input.description || undefined,
        AccountBasedExpenseLineDetail: { AccountRef: { value: input.expenseAccountId } },
      },
    ],
  };
  const res = await qbCreate(clientId, 'bill', body);
  const b = res?.Bill as Record<string, unknown> | undefined;
  return { id: String(b?.Id ?? ''), docNumber: b?.DocNumber ? String(b.DocNumber) : null };
}

export type InvoiceInput = {
  customerId: string;
  itemId: string; // Item de serviço ligado a uma conta de receita
  amount: number;
  txnDate?: string | null;
  dueDate?: string | null;
  memo?: string | null;
  description?: string | null;
  allowOnlinePayment?: boolean; // gera link de pagamento (requer QuickBooks Payments)
};

export async function qbCreateInvoice(
  clientId: string,
  input: InvoiceInput,
): Promise<{ id: string; docNumber: string | null; invoiceLink: string | null }> {
  const body: Record<string, unknown> = {
    CustomerRef: { value: input.customerId },
    TxnDate: input.txnDate || undefined,
    DueDate: input.dueDate || undefined,
    PrivateNote: input.memo || undefined,
    AllowOnlineACHPayment: input.allowOnlinePayment !== false,
    AllowOnlineCreditCardPayment: input.allowOnlinePayment !== false,
    Line: [
      {
        Amount: Number(input.amount.toFixed(2)),
        DetailType: 'SalesItemLineDetail',
        Description: input.description || undefined,
        SalesItemLineDetail: { ItemRef: { value: input.itemId }, Qty: 1, UnitPrice: Number(input.amount.toFixed(2)) },
      },
    ],
  };
  const res = await qbCreate(clientId, 'invoice', body);
  const inv = res?.Invoice as Record<string, unknown> | undefined;
  return {
    id: String(inv?.Id ?? ''),
    docNumber: inv?.DocNumber ? String(inv.DocNumber) : null,
    invoiceLink: inv?.InvoiceLink ? String(inv.InvoiceLink) : null,
  };
}
