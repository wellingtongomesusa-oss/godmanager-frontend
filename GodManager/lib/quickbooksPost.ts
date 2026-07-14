import { qbApiFetch, tidOf } from '@/lib/quickbooks';

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
  const tid = tidOf(res);
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    console.error('[quickbooks read] invalid json', res.status, 'intuit_tid=', tid, 'path=', path);
    throw new Error(`QuickBooks: resposta inválida (${res.status}) tid=${tid ?? '-'}`);
  }
  if (!res.ok) {
    console.error('[quickbooks read] error', res.status, 'intuit_tid=', tid, 'path=', path, faultMessage(json, ''));
    throw new Error(`${faultMessage(json, `QuickBooks ${res.status}`)} tid=${tid ?? '-'}`);
  }
  return json;
}

async function qbCreate(clientId: string, entity: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await qbApiFetch(clientId, `${entity}?minorversion=${MINOR}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const tid = tidOf(res);
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    console.error('[quickbooks create] invalid json', res.status, 'intuit_tid=', tid, 'entity=', entity);
    throw new Error(`QuickBooks: resposta inválida (${res.status}) tid=${tid ?? '-'}`);
  }
  if (!res.ok) {
    console.error('[quickbooks create] error', res.status, 'intuit_tid=', tid, 'entity=', entity, faultMessage(json, ''));
    throw new Error(`${faultMessage(json, `QuickBooks ${res.status}`)} tid=${tid ?? '-'}`);
  }
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

// ---- Relatórios (cards + gráficos) ----------------------------------------

export type QbPnl = {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  months: Array<{ month: string; income: number; expenses: number }>;
};

function numVal(v: unknown): number {
  const n = Number(String(v ?? '0').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Profit & Loss do QuickBooks (summarize por mês) → totais + série mensal. */
export async function qbProfitAndLoss(clientId: string, from: string, to: string): Promise<QbPnl> {
  const json = (await qbRead(
    clientId,
    `reports/ProfitAndLoss?start_date=${from}&end_date=${to}&summarize_column_by=Month&accounting_method=Accrual`,
  )) as Record<string, unknown>;

  const report = (json || {}) as Record<string, unknown>;
  const cols = (((report.Columns as Record<string, unknown>)?.Column as Array<Record<string, unknown>>) || []);
  const colKeys: string[] = cols.map((c, idx) => {
    if (idx === 0) return '__label__';
    const meta = (c?.MetaData as Array<Record<string, unknown>>) || [];
    const sd = meta.find((m) => m?.Name === 'StartDate')?.Value as string | undefined;
    if (sd && /^\d{4}-\d{2}/.test(sd)) return sd.slice(0, 7);
    if (String(c?.ColTitle || '').toLowerCase() === 'total') return 'total';
    return `col${idx}`;
  });

  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const walk = (rows: Array<Record<string, unknown>>) => {
    for (const row of rows || []) {
      const group = row?.group;
      if (group === 'Income' || group === 'Expenses') {
        const summary = ((row?.Summary as Record<string, unknown>)?.ColData as Array<Record<string, unknown>>) || [];
        const target = group === 'Income' ? income : expenses;
        summary.forEach((cd, i) => {
          if (i === 0) return;
          const key = colKeys[i];
          if (key) target[key] = numVal(cd?.value);
        });
      }
      const sub = (row?.Rows as Record<string, unknown>)?.Row as Array<Record<string, unknown>> | undefined;
      if (sub) walk(sub);
    }
  };
  walk(((report.Rows as Record<string, unknown>)?.Row as Array<Record<string, unknown>>) || []);

  const monthKeys = colKeys.filter((k) => /^\d{4}-\d{2}$/.test(k));
  const sumMonths = (o: Record<string, number>) => monthKeys.reduce((s, k) => s + (o[k] || 0), 0);
  const totalIncome = income.total ?? sumMonths(income);
  const totalExpenses = expenses.total ?? sumMonths(expenses);
  const months = monthKeys.map((k) => ({ month: k, income: income[k] || 0, expenses: expenses[k] || 0 }));
  return { totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses, months };
}

/** Total de contas a pagar (soma do saldo em aberto dos Bills). */
export async function qbAccountsPayable(clientId: string): Promise<number> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Bill maxresults 1000')}`)) as {
    QueryResponse?: { Bill?: Array<Record<string, unknown>> };
  };
  const bills = json?.QueryResponse?.Bill || [];
  return bills.reduce((s, b) => s + numVal(b.Balance), 0);
}

export type QbExpenseRow = { category: string; vendor: string; date: string; amount: number; status: string };

/** Despesas recentes do QuickBooks (Purchase + Bill) → linhas para a tabela "Despesas por Categoria". */
export async function qbRecentExpenses(clientId: string, limit = 25): Promise<QbExpenseRow[]> {
  const rows: QbExpenseRow[] = [];
  const catOf = (lines: Array<Record<string, unknown>> | undefined): string => {
    for (const ln of lines || []) {
      const d = (ln?.AccountBasedExpenseLineDetail as Record<string, unknown>) || {};
      const acct = (d?.AccountRef as Record<string, unknown>) || {};
      if (acct?.name) return String(acct.name);
    }
    return 'Sem categoria';
  };

  try {
    const pj = (await qbRead(
      clientId,
      `query?query=${encodeURIComponent('select * from Purchase orderby TxnDate desc maxresults ' + limit)}`,
    )) as { QueryResponse?: { Purchase?: Array<Record<string, unknown>> } };
    for (const p of pj?.QueryResponse?.Purchase || []) {
      const payee = (p?.EntityRef as Record<string, unknown>) || (p?.PayeeRef as Record<string, unknown>) || {};
      rows.push({
        category: catOf(p?.Line as Array<Record<string, unknown>>),
        vendor: String(payee?.name || '—'),
        date: String(p?.TxnDate || '').slice(0, 10),
        amount: numVal(p?.TotalAmt),
        status: 'Posted',
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const bj = (await qbRead(
      clientId,
      `query?query=${encodeURIComponent('select * from Bill orderby TxnDate desc maxresults ' + limit)}`,
    )) as { QueryResponse?: { Bill?: Array<Record<string, unknown>> } };
    for (const b of bj?.QueryResponse?.Bill || []) {
      const vend = (b?.VendorRef as Record<string, unknown>) || {};
      rows.push({
        category: catOf(b?.Line as Array<Record<string, unknown>>),
        vendor: String(vend?.name || '—'),
        date: String(b?.TxnDate || '').slice(0, 10),
        amount: numVal(b?.TotalAmt),
        status: numVal(b?.Balance) > 0 ? 'Pending' : 'Posted',
      });
    }
  } catch {
    /* ignore */
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows.slice(0, limit);
}

// ---- AP/AR: listagens de Contas a Pagar / Receber -------------------------

export type QbApRow = { id: string; docNumber: string | null; vendor: string; txnDate: string; dueDate: string; total: number; balance: number; overdue: boolean };
export type QbArRow = { id: string; docNumber: string | null; customer: string; txnDate: string; dueDate: string; total: number; balance: number; overdue: boolean; link: string | null };

function isOverdue(dueDate: string, balance: number): boolean {
  if (!(balance > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

/** Contas a Pagar: Bills em aberto (Balance > 0), mais recentes primeiro. */
export async function qbListOpenBills(clientId: string, limit = 100): Promise<QbApRow[]> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Bill where Balance > \'0\' orderby TxnDate desc maxresults ' + limit)}`)) as {
    QueryResponse?: { Bill?: Array<Record<string, unknown>> };
  };
  return (json?.QueryResponse?.Bill || []).map((b) => {
    const vend = (b?.VendorRef as Record<string, unknown>) || {};
    const dueDate = String(b?.DueDate || '').slice(0, 10);
    const balance = numVal(b?.Balance);
    return { id: String(b?.Id ?? ''), docNumber: b?.DocNumber ? String(b.DocNumber) : null, vendor: String(vend?.name || '—'), txnDate: String(b?.TxnDate || '').slice(0, 10), dueDate, total: numVal(b?.TotalAmt), balance, overdue: isOverdue(dueDate, balance) };
  });
}

/** Contas a Receber: Invoices em aberto (Balance > 0), mais recentes primeiro. */
export async function qbListOpenInvoices(clientId: string, limit = 100): Promise<QbArRow[]> {
  const json = (await qbRead(clientId, `query?query=${encodeURIComponent('select * from Invoice where Balance > \'0\' orderby TxnDate desc maxresults ' + limit)}`)) as {
    QueryResponse?: { Invoice?: Array<Record<string, unknown>> };
  };
  return (json?.QueryResponse?.Invoice || []).map((inv) => {
    const cust = (inv?.CustomerRef as Record<string, unknown>) || {};
    const dueDate = String(inv?.DueDate || '').slice(0, 10);
    const balance = numVal(inv?.Balance);
    return { id: String(inv?.Id ?? ''), docNumber: inv?.DocNumber ? String(inv.DocNumber) : null, customer: String(cust?.name || '—'), txnDate: String(inv?.TxnDate || '').slice(0, 10), dueDate, total: numVal(inv?.TotalAmt), balance, overdue: isOverdue(dueDate, balance), link: inv?.InvoiceLink ? String(inv.InvoiceLink) : null };
  });
}

export type QbApArSummary = {
  payables: QbApRow[]; receivables: QbArRow[];
  apTotal: number; apOverdue: number; arTotal: number; arOverdue: number;
};

/** Resumo consolidado AP/AR para a tela Contas a Pagar/Receber. */
export async function qbApArSummary(clientId: string): Promise<QbApArSummary> {
  const [payables, receivables] = await Promise.all([
    qbListOpenBills(clientId, 100).catch(() => [] as QbApRow[]),
    qbListOpenInvoices(clientId, 100).catch(() => [] as QbArRow[]),
  ]);
  const sum = (arr: Array<{ balance: number }>) => arr.reduce((s, x) => s + (x.balance || 0), 0);
  return {
    payables, receivables,
    apTotal: sum(payables), apOverdue: sum(payables.filter((b) => b.overdue)),
    arTotal: sum(receivables), arOverdue: sum(receivables.filter((r) => r.overdue)),
  };
}
