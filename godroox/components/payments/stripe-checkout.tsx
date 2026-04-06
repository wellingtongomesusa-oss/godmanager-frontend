'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'canceled';

export interface StripeCheckoutProps {
  /** Valor pré-preenchido (ex.: do formulário de pagamento). */
  defaultAmount?: number;
  /** Moeda pré-preenchida (ex.: USD, BRL). */
  defaultCurrency?: string;
  /** Descrição do pagamento. */
  description?: string;
  /** URL de sucesso (default: atual + ?stripe=success). */
  successUrl?: string;
  /** URL de cancelamento. */
  cancelUrl?: string;
  className?: string;
}

export function StripeCheckout({
  defaultAmount = 0,
  defaultCurrency = 'USD',
  description,
  successUrl,
  cancelUrl,
  className,
}: StripeCheckoutProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount || ''));
  const [currency, setCurrency] = useState(defaultCurrency);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const success = successUrl ?? `${base}?stripe=success`;
  const cancel = cancelUrl ?? `${base}?stripe=cancel`;

  const handleOpen = useCallback(() => {
    setAmount(defaultAmount ? String(defaultAmount) : '');
    setCurrency(defaultCurrency);
    setError(null);
    setModalOpen(true);
  }, [defaultAmount, defaultCurrency]);

  const handleConfirm = useCallback(async () => {
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: num,
          currency: currency.toLowerCase(),
          successUrl: success,
          cancelUrl: cancel,
          description: description ?? 'Pagamento Godroox',
        }),
      });
      const json = await res.json();
      if (!json.success || !json.data?.url) {
        throw new Error(json.message ?? json.error ?? 'Erro ao criar checkout');
      }
      window.location.href = json.data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar pagamento.');
      setLoading(false);
    }
  }, [amount, currency, success, cancel, description]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleOpen}
        className={cn(className)}
      >
        Pagar com Stripe
      </Button>
      {modalOpen && (
        <StripeConfirmModal
          amount={amount}
          currency={currency}
          onAmountChange={setAmount}
          onCurrencyChange={setCurrency}
          onConfirm={handleConfirm}
          onClose={() => setModalOpen(false)}
          loading={loading}
          error={error}
        />
      )}
    </>
  );
}

interface StripeConfirmModalProps {
  amount: string;
  currency: string;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}

function StripeConfirmModal({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  onConfirm,
  onClose,
  loading,
  error,
}: StripeConfirmModalProps) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', fn);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-secondary-900/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="w-full max-w-md border-secondary-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <h2 className="text-lg font-semibold text-secondary-900">Confirmar pagamento com Stripe</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700"
            aria-label="Fechar"
          >
            ×
          </button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">Moeda</label>
            <select
              value={currency}
              onChange={(e) => onCurrencyChange(e.target.value)}
              className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={onConfirm} className="flex-1" disabled={loading} isLoading={loading}>
              Ir para o checkout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
  canceled: 'Canceled',
};

/** Seção Stripe: status do retorno + botão "Pagar com Stripe". */
export function StripePaymentSection() {
  return (
    <div className="space-y-4">
      <StripePaymentStatus />
      <StripeCheckout description="Pagamento internacional" />
    </div>
  );
}

export function StripePaymentStatus() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const stripe = searchParams.get('stripe');
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(!!sessionId);

  useEffect(() => {
    if (!sessionId || stripe !== 'success') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stripe/status?session_id=${encodeURIComponent(sessionId)}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data?.status) {
          setStatus(json.data.status as PaymentStatus);
        }
      } catch {
        if (!cancelled) setStatus('failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, stripe]);

  if (!sessionId || stripe !== 'success') return null;
  if (loading) {
    return (
      <div className="rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-700">
        Verificando status do pagamento…
      </div>
    );
  }
  if (!status) return null;

  const variants: Record<PaymentStatus, string> = {
    pending: 'border-accent-300 bg-accent-50 text-accent-800',
    processing: 'border-primary-300 bg-primary-50 text-primary-800',
    paid: 'border-success-300 bg-success-50 text-success-800',
    failed: 'border-danger-300 bg-danger-50 text-danger-800',
    canceled: 'border-secondary-300 bg-secondary-100 text-secondary-700',
  };

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm font-medium', variants[status])}>
      Status do pagamento: {STATUS_LABELS[status]}
    </div>
  );
}
