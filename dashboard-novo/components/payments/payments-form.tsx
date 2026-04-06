'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency, cn } from '@/lib/utils';
import type { PaymentType } from '@/services/payments.service';
import {
  validateBankAccount,
  sendPayment,
  trackPayment,
  listPayments,
  type PaymentRecord,
  type PaymentLogEntry,
} from '@/services/payments.service';
import { Modal } from '@/components/ui/modal';

const PAYMENT_TYPES: { value: PaymentType; labelKey: string }[] = [
  { value: 'ACH', labelKey: 'payments.type.ACH' },
  { value: 'WIRE', labelKey: 'payments.type.WIRE' },
  { value: 'MASTERCARD_SEND', labelKey: 'payments.type.MASTERCARD_SEND' },
];

const LOG_ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  validation_start: 'Validation started',
  validation_ok: 'Validated',
  validation_failed: 'Validation failed',
  sent: 'Sent',
  callback: 'Callback',
  failed: 'Failed',
};

export function PaymentsForm() {
  const { t } = useLanguage();
  const [paymentType, setPaymentType] = useState<PaymentType>('ACH');
  const [bankAccount, setBankAccount] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [recipientUri, setRecipientUri] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [validationMessage, setValidationMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [lastPayment, setLastPayment] = useState<PaymentRecord | null>(null);
  const [trackId, setTrackId] = useState('');
  const [trackResult, setTrackResult] = useState<{ payment: PaymentRecord | null; logs: PaymentLogEntry[] } | null>(null);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);

  const refreshRecent = useCallback(() => {
    setRecentPayments(listPayments(10));
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  const handleValidate = useCallback(async () => {
    setValidationMessage(null);
    if (paymentType === 'MASTERCARD_SEND') {
      setValidationMessage({ type: 'error', text: 'Use Validate for ACH/Wire; Mastercard validates on Send.' });
      return;
    }
    try {
      const res = await validateBankAccount({
        routingNumber,
        accountNumber: bankAccount,
        accountType: paymentType,
      });
      if (res.valid) {
        setValidationMessage({ type: 'ok', text: t('payments.validationOk') });
      } else {
        setValidationMessage({ type: 'error', text: res.message ?? t('payments.validationFailed') });
      }
    } catch (e) {
      setValidationMessage({ type: 'error', text: e instanceof Error ? e.message : t('payments.validationFailed') });
    }
  }, [paymentType, routingNumber, bankAccount, t]);

  const handleSend = useCallback(async () => {
    setValidationMessage(null);
    setLastPayment(null);
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setValidationMessage({ type: 'error', text: 'Invalid amount.' });
      return;
    }
    setSending(true);
    try {
      const record =
        paymentType === 'MASTERCARD_SEND'
          ? await sendPayment({
              paymentType: 'MASTERCARD_SEND',
              recipientAccountUri: recipientUri,
              amount: amt,
              currency: 'USD',
              reference: reference || undefined,
            })
          : await sendPayment({
              paymentType,
              routingNumber,
              accountNumber: bankAccount,
              amount: amt,
              currency: 'USD',
              reference: reference || undefined,
            });
      setLastPayment(record);
      if (record.status === 'completed') {
        setValidationMessage({ type: 'ok', text: t('payments.sent') });
      } else if (record.status === 'failed') {
        setValidationMessage({ type: 'error', text: record.failureMessage ?? t('payments.error') });
      }
      refreshRecent();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('payments.error');
      setValidationMessage({ type: 'error', text: msg });
      if (msg.includes('Rate limit')) setValidationMessage({ type: 'error', text: t('payments.rateLimit') });
    } finally {
      setSending(false);
    }
  }, [paymentType, bankAccount, routingNumber, recipientUri, amount, reference, t, refreshRecent]);

  const handleTrack = useCallback(() => {
    if (!trackId.trim()) return;
    const result = trackPayment(trackId.trim());
    setTrackResult(result);
    setTrackModalOpen(true);
  }, [trackId]);

  const isAchOrWire = paymentType === 'ACH' || paymentType === 'WIRE';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('payments.title')}</CardTitle>
          <p className="text-sm text-secondary-600">{t('payments.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('payments.paymentType')}</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="h-11 w-full max-w-xs rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900"
            >
              {PAYMENT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey as 'payments.type.ACH')}
                </option>
              ))}
            </select>
          </div>

          {isAchOrWire && (
            <>
              <Input
                label={t('payments.bankAccount')}
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="Account number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
              />
              <Input
                label={t('payments.routingNumber')}
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                placeholder="9 digits"
                type="text"
                inputMode="numeric"
                maxLength={9}
                autoComplete="off"
              />
            </>
          )}
          {paymentType === 'MASTERCARD_SEND' && (
            <Input
              label={t('payments.recipientUri')}
              value={recipientUri}
              onChange={(e) => setRecipientUri(e.target.value)}
              placeholder="Account URI or identifier"
            />
          )}

          <Input
            label={t('payments.amount')}
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label={t('payments.reference')}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Optional reference"
          />

          {validationMessage && (
            <p
              className={cn(
                'rounded-lg px-4 py-2 text-sm',
                validationMessage.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              )}
            >
              {validationMessage.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleValidate} disabled={sending || paymentType === 'MASTERCARD_SEND'}>
              {t('payments.validateAccount')}
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? '...' : t('payments.sendPayment')}
            </Button>
          </div>

          {lastPayment && (
            <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4 text-sm">
              <p className="font-medium text-secondary-800">
                Last payment: {lastPayment.id} – {lastPayment.status} – {formatCurrency(lastPayment.amount, lastPayment.currency)}
                {lastPayment.externalId && ` (${lastPayment.externalId})`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('payments.trackPayment')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              label={t('payments.trackById')}
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              placeholder="e.g. pay-1234567890-abc"
              className="flex-1"
            />
            <div className="flex items-end pb-2">
              <Button variant="outline" onClick={handleTrack} disabled={!trackId.trim()}>
                {t('payments.trackPayment')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {recentPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('payments.recentPayments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentPayments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary-100 pb-2 text-sm last:border-0">
                  <span className="font-mono text-secondary-700">{p.id}</span>
                  <span>{p.type}</span>
                  <span>{formatCurrency(p.amount, p.currency)}</span>
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-xs',
                      p.status === 'completed' && 'bg-green-100 text-green-800',
                      p.status === 'failed' && 'bg-red-100 text-red-800',
                      p.status === 'pending' && 'bg-amber-100 text-amber-800',
                      p.status === 'processing' && 'bg-blue-100 text-blue-800'
                    )}
                  >
                    {t(`payments.status.${p.status}` as 'payments.status.completed')}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { setTrackId(p.id); setTrackResult(trackPayment(p.id)); setTrackModalOpen(true); }}>
                    {t('payments.trackPayment')}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Modal
        open={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        title={t('payments.trackPayment')}
        size="lg"
      >
        {trackResult && (
          <div className="space-y-4">
            {trackResult.payment ? (
              <div className="grid gap-2 text-sm">
                <p><strong>ID:</strong> {trackResult.payment.id}</p>
                <p><strong>Type:</strong> {trackResult.payment.type}</p>
                <p><strong>Amount:</strong> {formatCurrency(trackResult.payment.amount, trackResult.payment.currency)}</p>
                <p><strong>Status:</strong> {trackResult.payment.status}</p>
                {trackResult.payment.externalId && <p><strong>External ID:</strong> {trackResult.payment.externalId}</p>}
                {trackResult.payment.failureMessage && <p className="text-red-600">{trackResult.payment.failureMessage}</p>}
              </div>
            ) : (
              <p className="text-secondary-600">Payment not found.</p>
            )}
            {trackResult.logs.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-secondary-800">Logs</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-secondary-600">
                  {trackResult.logs.map((log) => (
                    <li key={log.id}>
                      {LOG_ACTION_LABELS[log.action] ?? log.action} – {log.timestamp.slice(0, 19).replace('T', ' ')}
                      {log.error && ` – ${log.error}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
