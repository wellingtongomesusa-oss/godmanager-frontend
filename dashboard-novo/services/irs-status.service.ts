/**
 * IRS Status Service – dashboard-novo
 * Status de filings, pagamentos e notificações (mock). Em produção: IRS MeF,
 * Transcripts API, e-Services.
 */

export type FilingStatus = 'Filed' | 'Pending' | 'Overdue' | 'Extension' | 'Not Required';

export interface FilingItem {
  id: string;
  taxYear: number;
  formType: string;
  description: string;
  status: FilingStatus;
  dueDate: string;
  filedDate?: string;
}

export interface IrsPaymentItem {
  id: string;
  date: string;
  amount: number;
  type: string;
  taxYear: number;
  reference?: string;
}

export interface IrsNoticeItem {
  id: string;
  date: string;
  noticeType: string;
  description: string;
  amount?: number;
  resolved: boolean;
}

export interface FederalTaxStatus {
  taxpayerId: string;
  taxYear: number;
  filingStatus: FilingStatus;
  lastFiledDate?: string;
  balanceDue: number;
  estimatedPayments: number;
  refundPending: boolean;
}

const currentYear = new Date().getFullYear();

function mockFilings(): FilingItem[] {
  return [
    { id: '1', taxYear: currentYear, formType: '1040', description: 'Individual Income Tax', status: 'Pending', dueDate: `${currentYear}-04-15` },
    { id: '2', taxYear: currentYear - 1, formType: '1040', description: 'Individual Income Tax', status: 'Filed', dueDate: `${currentYear - 1}-04-15`, filedDate: `${currentYear - 1}-04-10` },
    { id: '3', taxYear: currentYear, formType: '1040-ES', description: 'Estimated Tax', status: 'Pending', dueDate: `${currentYear}-04-15` },
    { id: '4', taxYear: currentYear, formType: '1120', description: 'U.S. Corporation', status: 'Pending', dueDate: `${currentYear}-03-15` },
  ];
}

function mockPayments(): IrsPaymentItem[] {
  return [
    { id: 'p1', date: `${currentYear - 1}-04-10`, amount: 12500, type: '1040 Payment', taxYear: currentYear - 1, reference: 'EFTPS' },
    { id: 'p2', date: `${currentYear}-01-15`, amount: 3500, type: '1040-ES Q4', taxYear: currentYear, reference: 'EST' },
    { id: 'p3', date: `${currentYear - 1}-06-15`, amount: 3200, type: '1040-ES Q2', taxYear: currentYear - 1 },
  ];
}

function mockNotices(): IrsNoticeItem[] {
  return [
    { id: 'n1', date: `${currentYear - 1}-08-01`, noticeType: 'CP2000', description: 'Underreported Income', amount: 0, resolved: true },
    { id: 'n2', date: `${currentYear}-02-01`, noticeType: 'Reminder', description: 'Q1 Estimated Tax Due', amount: 3500, resolved: false },
  ];
}

let filingsCache: FilingItem[] | null = null;
let paymentsCache: IrsPaymentItem[] | null = null;
let noticesCache: IrsNoticeItem[] | null = null;

/**
 * Retorna filings (mock). Em produção: IRS MeF Get Return Status.
 */
export function getFilings(taxYear?: number): FilingItem[] {
  if (!filingsCache) filingsCache = mockFilings();
  let list = [...filingsCache];
  if (taxYear != null) list = list.filter((f) => f.taxYear === taxYear);
  return list;
}

/**
 * Retorna histórico de pagamentos ao IRS (mock). Em produção: IRS Transcripts / EFTPS.
 */
export function getPaymentHistory(taxYear?: number): IrsPaymentItem[] {
  if (!paymentsCache) paymentsCache = mockPayments();
  let list = [...paymentsCache];
  if (taxYear != null) list = list.filter((p) => p.taxYear === taxYear);
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Retorna notificações/alertas IRS (mock). Em produção: IRS e-Services.
 */
export function getNotices(resolved?: boolean): IrsNoticeItem[] {
  if (!noticesCache) noticesCache = mockNotices();
  let list = [...noticesCache];
  if (resolved !== undefined) list = list.filter((n) => n.resolved === resolved);
  return list.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Status federal consolidado (mock).
 */
export function getFederalTaxStatus(taxpayerId: string, taxYear: number): FederalTaxStatus {
  const filings = getFilings(taxYear);
  const filed = filings.find((f) => f.status === 'Filed');
  const payments = getPaymentHistory(taxYear);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  return {
    taxpayerId,
    taxYear,
    filingStatus: filed ? 'Filed' : filings.some((f) => f.status === 'Overdue') ? 'Overdue' : 'Pending',
    lastFiledDate: filed?.filedDate,
    balanceDue: Math.max(0, 18000 - totalPaid),
    estimatedPayments: totalPaid,
    refundPending: false,
  };
}

/**
 * Simula sincronização com IRS (mock). Em produção: chamada MeF/Transcripts.
 */
export function syncIrsData(taxpayerId: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      filingsCache = mockFilings();
      paymentsCache = mockPayments();
      noticesCache = mockNotices();
      resolve({ success: true, message: 'IRS data refreshed (mock).' });
    }, 800);
  });
}
