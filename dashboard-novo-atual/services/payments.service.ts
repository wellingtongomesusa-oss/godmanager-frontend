/**
 * Payments Service – pagamentos corporativos: ACH, Wire, Mastercard Send, Plaid Bank Linking.
 * Registra cada pagamento, falhas e callbacks. Em produção integrar APIs reais.
 */

import { encryptSensitive, decryptSensitive, checkRateLimit } from '@/lib/security';
import { validateAccount as mastercardValidate, sendPayment as mastercardSend } from '@/services/bills/mastercard-send.service';
import {
  createLinkToken,
  validateBankAccount as plaidValidate,
  getBalance,
} from '@/services/bills/plaid.service';

export type PaymentType = 'ACH' | 'WIRE' | 'MASTERCARD_SEND';

export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface LinkedBankAccount {
  id: string;
  plaidAccountId: string;
  accountIdMasked: string;
  routingNumberMasked: string;
  name: string;
  institutionName?: string;
  linkedAt: string;
}

export interface PaymentRecord {
  id: string;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus;
  bankAccountMasked?: string;
  routingNumberMasked?: string;
  plaidAccountId?: string;
  recipientAccountUri?: string;
  reference?: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface PaymentLogEntry {
  id: string;
  paymentId: string;
  action: 'created' | 'validation_start' | 'validation_ok' | 'validation_failed' | 'sent' | 'callback' | 'failed';
  timestamp: string;
  details?: Record<string, unknown>;
  error?: string;
}

const paymentsStore: PaymentRecord[] = [];
const paymentLogsStore: PaymentLogEntry[] = [];
const linkedAccountsStore: LinkedBankAccount[] = [];
const RATE_LIMIT_KEY = 'payments-api';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function logPayment(paymentId: string, action: PaymentLogEntry['action'], details?: Record<string, unknown>, error?: string): void {
  paymentLogsStore.push({
    id: generateId('log'),
    paymentId,
    action,
    timestamp: new Date().toISOString(),
    details,
    error,
  });
}

/**
 * Cria link token para Plaid (conectar conta bancária).
 */
export async function createPlaidLinkToken(userId: string): Promise<{ linkToken: string; expiration: string }> {
  if (!checkRateLimit(RATE_LIMIT_KEY)) {
    throw new Error('Rate limit exceeded. Try again later.');
  }
  const res = await createLinkToken({ userId, clientName: 'Dashboard' });
  return { linkToken: res.linkToken, expiration: res.expiration };
}

/**
 * Simula exchange do public_token do Plaid e armazena conta vinculada (mock).
 */
export async function exchangePlaidToken(publicToken: string, userId: string): Promise<LinkedBankAccount> {
  if (!checkRateLimit(RATE_LIMIT_KEY)) {
    throw new Error('Rate limit exceeded. Try again later.');
  }
  await new Promise((r) => setTimeout(r, 400));
  const balance = await getBalance(publicToken);
  const account: LinkedBankAccount = {
    id: generateId('acc'),
    plaidAccountId: `pla_${Date.now()}`,
    accountIdMasked: '****4521',
    routingNumberMasked: '****0210',
    name: 'Checking',
    institutionName: balance?.institutionName ?? 'Chase (sandbox)',
    linkedAt: new Date().toISOString(),
  };
  linkedAccountsStore.push(account);
  return account;
}

export function getLinkedAccounts(): LinkedBankAccount[] {
  return [...linkedAccountsStore];
}

/**
 * Valida conta bancária (routing + account). Em produção: Plaid Auth ou micro-deposits.
 */
export async function validateBankAccount(params: {
  routingNumber: string;
  accountNumber: string;
  accountType?: PaymentType;
}): Promise<{ valid: boolean; accountId?: string; message?: string }> {
  if (!checkRateLimit(RATE_LIMIT_KEY)) {
    return { valid: false, message: 'Rate limit exceeded.' };
  }
  const routing = (params.routingNumber ?? '').replace(/\D/g, '');
  const account = (params.accountNumber ?? '').replace(/\D/g, '');
  if (routing.length !== 9 || account.length < 4) {
    return { valid: false, message: 'Invalid routing or account number format.' };
  }
  await new Promise((r) => setTimeout(r, 300));
  const accountId = `val_${Date.now()}`;
  return { valid: true, accountId };
}

/**
 * Cria e envia pagamento ACH (mock).
 */
export async function createACHPayment(params: {
  routingNumber: string;
  accountNumber: string;
  amount: number;
  currency: string;
  reference?: string;
}): Promise<PaymentRecord> {
  if (!checkRateLimit(RATE_LIMIT_KEY)) {
    throw new Error('Rate limit exceeded.');
  }
  const id = generateId('pay');
  const now = new Date().toISOString();
  const routingMasked = (params.routingNumber ?? '').slice(-4).padStart(9, '*');
  const accountMasked = (params.accountNumber ?? '').slice(-4).padStart(8, '*');

  const record: PaymentRecord = {
    id,
    type: 'ACH',
    amount: params.amount,
    currency: params.currency ?? 'USD',
    status: 'pending',
    bankAccountMasked: accountMasked,
    routingNumberMasked: routingMasked,
    reference: params.reference,
    createdAt: now,
    updatedAt: now,
  };
  paymentsStore.push(record);
  logPayment(id, 'created', { type: 'ACH', amount: params.amount });
  logPayment(id, 'validation_start');

  const validation = await validateBankAccount({
    routingNumber: params.routingNumber,
    accountNumber: params.accountNumber,
    accountType: 'ACH',
  });
  if (!validation.valid) {
    record.status = 'failed';
    record.failureCode = 'VALIDATION_FAILED';
    record.failureMessage = validation.message;
    record.updatedAt = new Date().toISOString();
    logPayment(id, 'validation_failed', {}, validation.message);
    return record;
  }
  logPayment(id, 'validation_ok');

  record.status = 'processing';
  record.updatedAt = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 600));
  record.status = 'completed';
  record.externalId = `ach-${Date.now()}`;
  record.completedAt = new Date().toISOString();
  record.updatedAt = record.completedAt;
  logPayment(id, 'sent', { externalId: record.externalId });
  return record;
}

/**
 * Cria e envia pagamento Wire (mock).
 */
export async function createWirePayment(params: {
  routingNumber: string;
  accountNumber: string;
  amount: number;
  currency: string;
  reference?: string;
}): Promise<PaymentRecord> {
  if (!checkRateLimit(RATE_LIMIT_KEY)) {
    throw new Error('Rate limit exceeded.');
  }
  const id = generateId('pay');
  const now = new Date().toISOString();
  const routingMasked = (params.routingNumber ?? '').slice(-4).padStart(9, '*');
  const accountMasked = (params.accountNumber ?? '').slice(-4).padStart(8, '*');

  const record: PaymentRecord = {
    id,
    type: 'WIRE',
    amount: params.amount,
    currency: params.currency ?? 'USD',
    status: 'pending',
    bankAccountMasked: accountMasked,
    routingNumberMasked: routingMasked,
    reference: params.reference,
    createdAt: now,
    updatedAt: now,
  };
  paymentsStore.push(record);
  logPayment(id, 'created', { type: 'WIRE', amount: params.amount });
  logPayment(id, 'validation_start');

  const validation = await validateBankAccount({
    routingNumber: params.routingNumber,
    accountNumber: params.accountNumber,
    accountType: 'WIRE',
  });
  if (!validation.valid) {
    record.status = 'failed';
    record.failureCode = 'VALIDATION_FAILED';
    record.failureMessage = validation.message;
    record.updatedAt = new Date().toISOString();
    logPayment(id, 'validation_failed', {}, validation.message);
    return record;
  }
  logPayment(id, 'validation_ok');

  record.status = 'processing';
  record.updatedAt = new Date().toISOString();
  await new Promise((r) => setTimeout(r, 800));
  record.status = 'completed';
  record.externalId = `wire-${Date.now()}`;
  record.completedAt = new Date().toISOString();
  record.updatedAt = record.completedAt;
  logPayment(id, 'sent', { externalId: record.externalId });
  return record;
}

/**
 * Envia pagamento via Mastercard Send API (mock).
 */
export async function sendMastercardPayment(params: {
  recipientAccountUri: string;
  amount: number;
  currency: string;
  reference?: string;
}): Promise<PaymentRecord> {
  if (!checkRateLimit(RATE_LIMIT_KEY)) {
    throw new Error('Rate limit exceeded.');
  }
  const id = generateId('pay');
  const now = new Date().toISOString();

  const record: PaymentRecord = {
    id,
    type: 'MASTERCARD_SEND',
    amount: params.amount,
    currency: params.currency ?? 'USD',
    status: 'pending',
    recipientAccountUri: params.recipientAccountUri,
    reference: params.reference,
    createdAt: now,
    updatedAt: now,
  };
  paymentsStore.push(record);
  logPayment(id, 'created', { type: 'MASTERCARD_SEND', amount: params.amount });
  logPayment(id, 'validation_start');

  const validation = await mastercardValidate({
    recipientAccountUri: params.recipientAccountUri,
    currency: params.currency,
  });
  if (!validation.valid) {
    record.status = 'failed';
    record.failureCode = validation.errorCode ?? 'VALIDATION_FAILED';
    record.failureMessage = validation.message;
    record.updatedAt = new Date().toISOString();
    logPayment(id, 'validation_failed', {}, validation.message);
    return record;
  }
  logPayment(id, 'validation_ok');

  record.status = 'processing';
  record.updatedAt = new Date().toISOString();
  const result = await mastercardSend({
    transferReference: id,
    amount: params.amount,
    currency: params.currency ?? 'USD',
    recipientAccountUri: params.recipientAccountUri,
    description: params.reference,
  });
  if (!result.success) {
    record.status = 'failed';
    record.failureCode = result.errorCode;
    record.failureMessage = result.message;
    record.updatedAt = new Date().toISOString();
    logPayment(id, 'failed', {}, result.message);
    return record;
  }
  record.status = 'completed';
  record.externalId = result.transactionId;
  record.completedAt = new Date().toISOString();
  record.updatedAt = record.completedAt;
  logPayment(id, 'sent', { externalId: record.externalId });
  return record;
}

/**
 * Envio unificado por tipo.
 */
export async function sendPayment(params: {
  paymentType: PaymentType;
  routingNumber?: string;
  accountNumber?: string;
  recipientAccountUri?: string;
  amount: number;
  currency?: string;
  reference?: string;
}): Promise<PaymentRecord> {
  if (params.paymentType === 'MASTERCARD_SEND') {
    if (!params.recipientAccountUri) throw new Error('Recipient account URI required for Mastercard Send.');
    return sendMastercardPayment({
      recipientAccountUri: params.recipientAccountUri,
      amount: params.amount,
      currency: params.currency ?? 'USD',
      reference: params.reference,
    });
  }
  if (params.paymentType === 'ACH') {
    if (!params.routingNumber || !params.accountNumber) throw new Error('Routing and account number required for ACH.');
    return createACHPayment({
      routingNumber: params.routingNumber,
      accountNumber: params.accountNumber,
      amount: params.amount,
      currency: params.currency ?? 'USD',
      reference: params.reference,
    });
  }
  if (params.paymentType === 'WIRE') {
    if (!params.routingNumber || !params.accountNumber) throw new Error('Routing and account number required for Wire.');
    return createWirePayment({
      routingNumber: params.routingNumber,
      accountNumber: params.accountNumber,
      amount: params.amount,
      currency: params.currency ?? 'USD',
      reference: params.reference,
    });
  }
  throw new Error('Invalid payment type.');
}

/**
 * Rastreia pagamento por ID: retorna registro e logs.
 */
export function trackPayment(paymentId: string): { payment: PaymentRecord | null; logs: PaymentLogEntry[] } {
  const payment = paymentsStore.find((p) => p.id === paymentId) ?? null;
  const logs = paymentLogsStore
    .filter((l) => l.paymentId === paymentId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { payment, logs };
}

/**
 * Lista pagamentos recentes.
 */
export function listPayments(limit: number = 50): PaymentRecord[] {
  return [...paymentsStore]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/** Uso opcional: criptografar dados antes de enviar para API (ex.: account number). */
export function maskAccountNumber(accountNumber: string): string {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return digits.slice(-4).padStart(digits.length, '*');
}

export { encryptSensitive as paymentsEncrypt, decryptSensitive as paymentsDecrypt };
