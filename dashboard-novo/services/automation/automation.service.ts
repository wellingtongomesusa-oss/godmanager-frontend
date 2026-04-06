/**
 * Automation Service – agendamento de pagamentos, IA (previsão de fluxo de caixa, datas ideais, anomalias),
 * notificações e integrações (Mastercard Send, Plaid, OCR, Webhooks).
 * Em produção: cron jobs, APIs de IA, filas de notificação.
 */

import { listPayments, type PaymentType } from '@/services/payments.service';
import { onWebhook } from '@/services/bills/webhooks.service';

export type RecurrenceType = 'once' | 'weekly' | 'monthly';

export type ScheduledPaymentStatus = 'pending' | 'processing' | 'processed' | 'cancelled' | 'failed';

export interface ScheduledPayment {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  scheduledDate: string;
  recurrence: RecurrenceType;
  nextRunAt: string;
  status: ScheduledPaymentStatus;
  paymentType: PaymentType;
  reference?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  lastNotificationAt?: string;
}

export interface AutomationNotification {
  id: string;
  type: 'payment_due' | 'payment_processed' | 'anomaly' | 'cash_flow_alert' | 'vendor_automated';
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  read: boolean;
  createdAt: string;
}

export interface CashFlowPrediction {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export interface PaymentDateSuggestion {
  date: string;
  score: number;
  reason: string;
}

export interface AnomalyAlert {
  id: string;
  type: 'amount' | 'vendor' | 'timing';
  entityId: string;
  entityType: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
}

export interface VendorAutomation {
  id: string;
  vendorId: string;
  vendorName: string;
  enabled: boolean;
  defaultAmount?: number;
  recurrence: RecurrenceType;
  nextRunAt: string;
  createdAt: string;
}

const scheduledStore: ScheduledPayment[] = [];
const notificationsStore: AutomationNotification[] = [];
const vendorAutomationsStore: VendorAutomation[] = [];
const anomaliesStore: AnomalyAlert[] = [];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addWeeks(dateStr: string, weeks: number): string {
  return addDays(dateStr, weeks * 7);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function getNextRun(scheduledDate: string, recurrence: RecurrenceType, afterDate?: string): string {
  const after = afterDate ?? new Date().toISOString().slice(0, 10);
  if (recurrence === 'once') return scheduledDate;
  let next = scheduledDate;
  while (next < after) {
    if (recurrence === 'weekly') next = addWeeks(next, 1);
    else next = addMonths(next, 1);
  }
  return next;
}

/** Notificações automáticas (mock: em produção push/email). */
function pushNotification(n: Omit<AutomationNotification, 'id' | 'read' | 'createdAt'>): void {
  notificationsStore.unshift({
    ...n,
    id: generateId('notif'),
    read: false,
    createdAt: new Date().toISOString(),
  });
}

/** Seed de dados para demonstração. */
function seedIfEmpty(): void {
  if (scheduledStore.length > 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = addDays(today, 7);
  const nextMonth = addMonths(today, 1);
  scheduledStore.push(
    {
      id: generateId('sched'),
      vendor: 'CloudHost LLC',
      amount: 890.5,
      currency: 'USD',
      scheduledDate: nextWeek,
      recurrence: 'monthly',
      nextRunAt: nextWeek,
      status: 'pending',
      paymentType: 'ACH',
      reference: 'Hosting',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId('sched'),
      vendor: 'Acme Supplies',
      amount: 1200,
      currency: 'USD',
      scheduledDate: nextMonth,
      recurrence: 'once',
      nextRunAt: nextMonth,
      status: 'pending',
      paymentType: 'WIRE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );
  notificationsStore.push({
    id: generateId('notif'),
    type: 'payment_due',
    title: 'Payment due soon',
    message: 'CloudHost LLC – $890.50 due in 7 days',
    entityId: scheduledStore[0]?.id,
    entityType: 'scheduled_payment',
    read: false,
    createdAt: new Date().toISOString(),
  });
  anomaliesStore.push({
    id: generateId('anom'),
    type: 'amount',
    entityId: 'bill-1',
    entityType: 'bill',
    message: 'Amount 15% higher than 3-month average for this vendor',
    severity: 'medium',
    createdAt: new Date().toISOString(),
  });
}

// --- Scheduler ---

export function listScheduledPayments(onlyPending: boolean = true): ScheduledPayment[] {
  seedIfEmpty();
  let list = [...scheduledStore].sort(
    (a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()
  );
  if (onlyPending) list = list.filter((s) => s.status === 'pending');
  return list;
}

export function getUpcomingPayments(limit: number = 10): ScheduledPayment[] {
  return listScheduledPayments(true).slice(0, limit);
}

export function schedulePayment(params: {
  vendor: string;
  amount: number;
  currency: string;
  scheduledDate: string;
  recurrence?: RecurrenceType;
  paymentType?: PaymentType;
  reference?: string;
}): ScheduledPayment {
  seedIfEmpty();
  const recurrence = params.recurrence ?? 'once';
  const nextRunAt = getNextRun(params.scheduledDate, recurrence);
  const record: ScheduledPayment = {
    id: generateId('sched'),
    vendor: params.vendor,
    amount: params.amount,
    currency: params.currency ?? 'USD',
    scheduledDate: params.scheduledDate,
    recurrence,
    nextRunAt,
    status: 'pending',
    paymentType: params.paymentType ?? 'ACH',
    reference: params.reference,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  scheduledStore.push(record);
  pushNotification({
    type: 'payment_due',
    title: 'Payment scheduled',
    message: `${params.vendor} – ${params.currency} ${params.amount} on ${nextRunAt}`,
    entityId: record.id,
    entityType: 'scheduled_payment',
  });
  return record;
}

export function cancelScheduledPayment(id: string): boolean {
  const idx = scheduledStore.findIndex((s) => s.id === id);
  if (idx < 0) return false;
  scheduledStore[idx] = { ...scheduledStore[idx], status: 'cancelled', updatedAt: new Date().toISOString() };
  return true;
}

/** Processa próximo agendamento (mock: em produção job dispararia envio real). */
export async function processNextScheduled(): Promise<ScheduledPayment | null> {
  const next = listScheduledPayments(true)[0];
  if (!next) return null;
  const idx = scheduledStore.findIndex((s) => s.id === next.id);
  if (idx < 0) return null;
  scheduledStore[idx] = { ...scheduledStore[idx], status: 'processing', updatedAt: new Date().toISOString() };
  await new Promise((r) => setTimeout(r, 500));
  scheduledStore[idx] = {
    ...scheduledStore[idx],
    status: 'processed',
    processedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (scheduledStore[idx].recurrence !== 'once') {
    const nextRun = getNextRun(
      scheduledStore[idx].nextRunAt,
      scheduledStore[idx].recurrence,
      addDays(new Date().toISOString().slice(0, 10), 1)
    );
    scheduledStore.push({
      ...scheduledStore[idx],
      id: generateId('sched'),
      status: 'pending',
      nextRunAt: nextRun,
      processedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  pushNotification({
    type: 'payment_processed',
    title: 'Payment processed',
    message: `${next.vendor} – ${next.currency} ${next.amount}`,
    entityId: next.id,
    entityType: 'scheduled_payment',
  });
  return scheduledStore[idx];
}

// --- Notifications ---

export function getNotifications(unreadOnly: boolean = false): AutomationNotification[] {
  seedIfEmpty();
  let list = [...notificationsStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (unreadOnly) list = list.filter((n) => !n.read);
  return list.slice(0, 50);
}

export function markNotificationRead(id: string): void {
  const n = notificationsStore.find((x) => x.id === id);
  if (n) n.read = true;
}

export function markAllNotificationsRead(): void {
  notificationsStore.forEach((n) => (n.read = true));
}

// --- IA: Previsão de fluxo de caixa ---

export function predictCashFlow(horizonDays: number = 30): CashFlowPrediction[] {
  const payments = listPayments(100);
  const scheduled = listScheduledPayments(true);
  const baseBalance = 85000;
  const dailyInflow = 1200;
  const result: CashFlowPrediction[] = [];
  const today = new Date();
  let balance = baseBalance;
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOutflows = scheduled
      .filter((s) => s.nextRunAt === dateStr)
      .reduce((sum, s) => sum + s.amount, 0);
    const dayInflows = i % 7 === 5 ? dailyInflow * 2 : dailyInflow;
    balance = balance + dayInflows - dayOutflows;
    result.push({
      date: dateStr,
      balance: Math.round(balance * 100) / 100,
      inflows: dayInflows,
      outflows: dayOutflows,
    });
  }
  return result;
}

// --- IA: Sugestão de datas ideais ---

export function suggestPaymentDates(vendorId?: string, amount?: number): PaymentDateSuggestion[] {
  const predictions = predictCashFlow(14);
  const suggestions: PaymentDateSuggestion[] = [];
  for (let i = 0; i < Math.min(7, predictions.length); i++) {
    const p = predictions[i];
    const score = p.balance > 50000 ? 90 : p.balance > 30000 ? 70 : 50;
    suggestions.push({
      date: p.date,
      score: score + Math.floor(Math.random() * 10),
      reason: p.balance > 50000 ? 'High projected balance' : 'Moderate balance',
    });
  }
  return suggestions.sort((a, b) => b.score - a.score);
}

// --- IA: Detecção de anomalias ---

export function detectAnomalies(): AnomalyAlert[] {
  seedIfEmpty();
  return [...anomaliesStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addAnomaly(alert: Omit<AnomalyAlert, 'id' | 'createdAt'>): AnomalyAlert {
  const record: AnomalyAlert = {
    ...alert,
    id: generateId('anom'),
    createdAt: new Date().toISOString(),
  };
  anomaliesStore.unshift(record);
  pushNotification({
    type: 'anomaly',
    title: 'Anomaly detected',
    message: alert.message,
    entityId: alert.entityId,
    entityType: alert.entityType,
  });
  return record;
}

// --- Automatizar fornecedor ---

export function listVendorAutomations(): VendorAutomation[] {
  return [...vendorAutomationsStore];
}

export function automateVendor(params: {
  vendorId: string;
  vendorName: string;
  recurrence: RecurrenceType;
  defaultAmount?: number;
}): VendorAutomation {
  const nextRun = getNextRun(new Date().toISOString().slice(0, 10), params.recurrence);
  const record: VendorAutomation = {
    id: generateId('vauto'),
    vendorId: params.vendorId,
    vendorName: params.vendorName,
    enabled: true,
    defaultAmount: params.defaultAmount,
    recurrence: params.recurrence,
    nextRunAt: nextRun,
    createdAt: new Date().toISOString(),
  };
  vendorAutomationsStore.push(record);
  pushNotification({
    type: 'vendor_automated',
    title: 'Vendor automated',
    message: `${params.vendorName} – ${params.recurrence} payments`,
    entityId: record.id,
    entityType: 'vendor_automation',
  });
  return record;
}

// --- Integrações (uso dos serviços existentes) ---

export { onWebhook } from '@/services/bills/webhooks.service';
