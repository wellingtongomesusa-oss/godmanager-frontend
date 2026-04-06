/**
 * Bills Approval Workflow – contas a pagar com dupla alçada.
 * Status: Pending → Reviewed → Approved Level 1 → Approved Level 2 → Scheduled → Paid
 * Rejected encerra o fluxo.
 */

import { logAudit, type LogAction } from '@/services/logs.service';

export type BillStatus =
  | 'pending'
  | 'reviewed'
  | 'approved_l1'
  | 'approved_l2'
  | 'scheduled'
  | 'paid'
  | 'rejected';

export interface Bill {
  id: string;
  number: string;
  vendor: string;
  amount: number;
  currency: string;
  dueDate: string;
  description: string;
  status: BillStatus;
  approvedBy1?: string;
  approvedBy2?: string;
  approvedAt1?: string;
  approvedAt2?: string;
  scheduledPaymentDate?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  ocrData?: string;
  plaidValidated?: boolean;
  mastercardValidated?: boolean;
}

export interface BillFilters {
  status?: BillStatus;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export type BillSortField = 'dueDate' | 'amount' | 'vendor' | 'status' | 'createdAt';
export type BillSortOrder = 'asc' | 'desc';

const STATUS_ORDER: BillStatus[] = [
  'pending',
  'reviewed',
  'approved_l1',
  'approved_l2',
  'scheduled',
  'paid',
  'rejected',
];

let billsStore: Bill[] = [];
let _nextNumber = 1;

function generateId(): string {
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nextBillNumber(): string {
  const n = _nextNumber++;
  return `BL-${String(n).padStart(5, '0')}`;
}

function getCurrentUser(): { userId: string; userEmail: string } {
  if (typeof window !== 'undefined') {
    try {
      const u = (window as unknown as { __billsUser?: { userId: string; userEmail: string } }).__billsUser;
      if (u?.userId) return u;
    } catch {
      // ignore
    }
  }
  return { userId: 'admin', userEmail: 'admin@dashboard.local' };
}

function getClientContext(): { ip?: string; userAgent?: string } {
  if (typeof window !== 'undefined' && 'navigator' in window) {
    return { ip: undefined, userAgent: navigator.userAgent };
  }
  return {};
}

function audit(action: LogAction, entityId: string, metadata?: Record<string, unknown>): void {
  const user = getCurrentUser();
  const ctx = getClientContext();
  logAudit({
    action,
    entityType: 'bill',
    entityId,
    userId: user.userId,
    userEmail: user.userEmail,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata,
  });
}

export function seedBills(): void {
  if (billsStore.length > 0) return;
  const now = new Date().toISOString();
  const bills: Bill[] = [
    {
      id: generateId(),
      number: nextBillNumber(),
      vendor: 'Acme Supplies Inc',
      amount: 12500.0,
      currency: 'USD',
      dueDate: '2025-02-15',
      description: 'Office supplies Q1',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      number: nextBillNumber(),
      vendor: 'CloudHost LLC',
      amount: 890.5,
      currency: 'USD',
      dueDate: '2025-02-20',
      description: 'Hosting Feb 2025',
      status: 'reviewed',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      number: nextBillNumber(),
      vendor: 'Legal Partners',
      amount: 3500,
      currency: 'USD',
      dueDate: '2025-03-01',
      description: 'Legal retainer',
      status: 'approved_l1',
      approvedBy1: 'approver1@company.com',
      approvedAt1: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      number: nextBillNumber(),
      vendor: 'Utilities Co',
      amount: 420,
      currency: 'USD',
      dueDate: '2025-02-10',
      description: 'Electricity Jan',
      status: 'approved_l2',
      approvedBy1: 'approver1@company.com',
      approvedBy2: 'approver2@company.com',
      approvedAt1: now,
      approvedAt2: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateId(),
      number: nextBillNumber(),
      vendor: 'Insurance Corp',
      amount: 2100,
      currency: 'USD',
      dueDate: '2025-03-15',
      description: 'Annual premium',
      status: 'scheduled',
      approvedBy1: 'approver1@company.com',
      approvedBy2: 'approver2@company.com',
      approvedAt1: now,
      approvedAt2: now,
      scheduledPaymentDate: '2025-03-10',
      createdAt: now,
      updatedAt: now,
    },
  ];
  billsStore = bills;
  _nextNumber = 6;
}

export function getBills(filters: BillFilters = {}): Bill[] {
  let list = [...billsStore];
  if (filters.status) list = list.filter((b) => b.status === filters.status);
  if (filters.vendor)
    list = list.filter((b) => b.vendor.toLowerCase().includes((filters.vendor ?? '').toLowerCase()));
  if (filters.dateFrom) list = list.filter((b) => b.dueDate >= (filters.dateFrom ?? ''));
  if (filters.dateTo) list = list.filter((b) => b.dueDate <= (filters.dateTo ?? ''));
  if (filters.search) {
    const q = (filters.search ?? '').toLowerCase();
    list = list.filter(
      (b) =>
        b.number.toLowerCase().includes(q) ||
        b.vendor.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
  }
  return list;
}

export function sortBills(
  list: Bill[],
  field: BillSortField,
  order: BillSortOrder
): Bill[] {
  const arr = [...list];
  const mult = order === 'asc' ? 1 : -1;
  const statusRank = (s: BillStatus) => STATUS_ORDER.indexOf(s);
  arr.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'dueDate':
        cmp = a.dueDate.localeCompare(b.dueDate);
        break;
      case 'amount':
        cmp = a.amount - b.amount;
        break;
      case 'vendor':
        cmp = a.vendor.localeCompare(b.vendor);
        break;
      case 'status':
        cmp = statusRank(a.status) - statusRank(b.status);
        break;
      case 'createdAt':
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
      default:
        cmp = 0;
    }
    return mult * cmp;
  });
  return arr;
}

export function getBillById(id: string): Bill | null {
  return billsStore.find((b) => b.id === id) ?? null;
}

export function updateBillStatus(
  id: string,
  newStatus: BillStatus,
  options?: {
    approvedBy?: string;
    scheduledPaymentDate?: string;
  }
): Bill | null {
  const bill = billsStore.find((b) => b.id === id);
  if (!bill) return null;
  const now = new Date().toISOString();
  const user = getCurrentUser();
  const approver = options?.approvedBy ?? user.userEmail;

  const updated: Bill = {
    ...bill,
    status: newStatus,
    updatedAt: now,
  };
  if (newStatus === 'approved_l1') {
    updated.approvedBy1 = approver;
    updated.approvedAt1 = now;
    audit('bill.approved_l1', id, { approvedBy: approver });
  } else if (newStatus === 'approved_l2') {
    updated.approvedBy2 = approver;
    updated.approvedAt2 = now;
    audit('bill.approved_l2', id, { approvedBy: approver });
  } else if (newStatus === 'reviewed') {
    audit('bill.reviewed', id, { reviewedBy: approver });
  } else if (newStatus === 'rejected') {
    audit('bill.rejected', id, { rejectedBy: approver });
  } else if (newStatus === 'scheduled') {
    updated.scheduledPaymentDate = options?.scheduledPaymentDate ?? now.slice(0, 10);
    audit('bill.scheduled', id, { scheduledPaymentDate: updated.scheduledPaymentDate });
  } else if (newStatus === 'paid') {
    updated.paidAt = now;
    audit('bill.paid', id);
  }

  billsStore = billsStore.map((b) => (b.id === id ? updated : b));
  return updated;
}

export function setBillReviewed(id: string): Bill | null {
  return updateBillStatus(id, 'reviewed');
}

export function setBillApprovedL1(id: string): Bill | null {
  return updateBillStatus(id, 'approved_l1');
}

export function setBillApprovedL2(id: string): Bill | null {
  return updateBillStatus(id, 'approved_l2');
}

export function setBillRejected(id: string): Bill | null {
  return updateBillStatus(id, 'rejected');
}

export function setBillScheduled(id: string, scheduledPaymentDate: string): Bill | null {
  return updateBillStatus(id, 'scheduled', { scheduledPaymentDate });
}

export function setBillPaid(id: string): Bill | null {
  return updateBillStatus(id, 'paid');
}

/** Permissões simuladas: em produção checar por role. */
export function canApproveL1(userId?: string): boolean {
  return true;
}
export function canApproveL2(userId?: string): boolean {
  return true;
}
