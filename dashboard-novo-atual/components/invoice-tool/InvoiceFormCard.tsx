'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  formatCurrency,
  getSubtotal,
  getTotal,
  generateId,
  type LineItem,
  loadDraft,
  saveDraft,
  CURRENCY_SYMBOL,
} from '@/lib/invoice-utils';
import { cn } from '@/lib/utils';
import { InvoicePreviewModal } from './InvoicePreviewModal';
import { InvoiceShareButtons } from './InvoiceShareButtons';

const PLAN_FREE = 'free';
const PLAN_PRO = 'pro';

const initialLineItem = (): LineItem => ({
  id: generateId(),
  description: '',
  quantity: 1,
  unitPrice: 0,
});

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function InvoiceFormCard() {
  const [plan, setPlan] = useState<string>(PLAN_FREE);
  const [payerCompany, setPayerCompany] = useState('');
  const [billingCompany, setBillingCompany] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => formatDateForInput(new Date()));
  const [lineItems, setLineItems] = useState<LineItem[]>(() => [initialLineItem()]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [invoiceNumber] = useState(() => `#${String(Date.now()).slice(-8)}`);

  const total = useMemo(() => getTotal(lineItems), [lineItems]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (touched.payerCompany && !payerCompany.trim()) e.payerCompany = 'Campo obrigatório';
    if (touched.billingCompany && !billingCompany.trim()) e.billingCompany = 'Campo obrigatório';
    if (touched.serviceDate && !serviceDate) e.serviceDate = 'Campo obrigatório';
    if (touched.invoiceDate && !invoiceDate) e.invoiceDate = 'Campo obrigatório';
    lineItems.forEach((item, i) => {
      if (touched[`desc-${item.id}`] && !item.description.trim()) e[`desc-${item.id}`] = 'Campo obrigatório';
    });
    return e;
  }, [payerCompany, billingCompany, serviceDate, invoiceDate, lineItems, touched]);

  useEffect(() => {
    const draft = loadDraft();
    if (draft && typeof draft.plan === 'string') setPlan(draft.plan);
    if (draft && typeof draft.payerCompany === 'string') setPayerCompany(draft.payerCompany);
    if (draft && typeof draft.billingCompany === 'string') setBillingCompany(draft.billingCompany);
    if (draft && typeof draft.serviceDate === 'string') setServiceDate(draft.serviceDate);
    if (draft && typeof draft.invoiceDate === 'string') setInvoiceDate(draft.invoiceDate);
    if (draft && Array.isArray(draft.lineItems) && draft.lineItems.length > 0) {
      setLineItems(
        (draft.lineItems as LineItem[]).map((item) => ({
          ...item,
          id: item.id || generateId(),
        }))
      );
    }
  }, []);

  useEffect(() => {
    saveDraft({
      plan,
      payerCompany,
      billingCompany,
      serviceDate,
      invoiceDate,
      lineItems,
    });
  }, [plan, payerCompany, billingCompany, serviceDate, invoiceDate, lineItems]);

  const setTouchedField = useCallback((field: string) => {
    setTouched((t) => ({ ...t, [field]: true }));
  }, []);

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, initialLineItem()]);
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }, []);

  const updateLineItem = useCallback((id: string, updates: Partial<LineItem>) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const invoiceData = useMemo(
    () => ({
      plan,
      payerCompany,
      billingCompany,
      serviceDate,
      invoiceDate,
      lineItems,
      total,
      invoiceNumber,
    }),
    [plan, payerCompany, billingCompany, serviceDate, invoiceDate, lineItems, total, invoiceNumber]
  );

  const isValid = Boolean(!Object.keys(errors).length && payerCompany.trim() && billingCompany.trim() && serviceDate && invoiceDate && lineItems.every((i) => i.description.trim()));

  return (
    <div
      className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-8 shadow-lg"
      style={{
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        borderRadius: 16,
      }}
      role="form"
      aria-labelledby="invoice-form-heading"
    >
      <h2 id="invoice-form-heading" className="text-xl font-semibold text-invoice-heading mb-6">
        Nova fatura
      </h2>

      {/* Plan */}
      <fieldset className="mb-6" aria-label="Plano">
        <legend className="text-sm font-medium text-invoice-body mb-2">Plano</legend>
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="plan"
              value={PLAN_FREE}
              checked={plan === PLAN_FREE}
              onChange={() => setPlan(PLAN_FREE)}
              className="h-4 w-4 accent-invoice-primary"
              aria-describedby="plan-free-desc"
            />
            <span className="text-invoice-heading">Free Trial</span>
            <span id="plan-free-desc" className="text-sm text-invoice-body">(recursos básicos, sem cartão)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="plan"
              value={PLAN_PRO}
              checked={plan === PLAN_PRO}
              onChange={() => setPlan(PLAN_PRO)}
              className="h-4 w-4 accent-invoice-primary"
              aria-describedby="plan-pro-desc"
            />
            <span className="text-invoice-heading">Pro com 7 dias grátis</span>
            <span id="plan-pro-desc" className="text-sm text-invoice-body">(faturas ilimitadas, suporte prioritário)</span>
          </label>
        </div>
      </fieldset>

      <div className="space-y-5">
        <div>
          <label htmlFor="payer" className="mb-1 block text-sm font-medium text-invoice-body">
            Empresa que vai pagar <span className="text-[var(--invoice-primary)]">*</span>
          </label>
          <input
            id="payer"
            type="text"
            value={payerCompany}
            onChange={(e) => setPayerCompany(e.target.value)}
            onBlur={() => setTouchedField('payerCompany')}
            placeholder="e.g., Cliente XYZ Ltda."
            className={cn(
              'w-full rounded-lg border px-4 py-3 text-invoice-heading transition-all duration-300',
              errors.payerCompany ? 'border-red-500' : 'border-gray-300',
              !errors.payerCompany && touched.payerCompany && payerCompany.trim() && 'border-green-500'
            )}
            aria-invalid={!!errors.payerCompany}
            aria-describedby={errors.payerCompany ? 'err-payer' : undefined}
          />
          {errors.payerCompany && (
            <p id="err-payer" className="mt-1 text-sm text-red-600" role="alert">{errors.payerCompany}</p>
          )}
        </div>

        <div>
          <label htmlFor="billing" className="mb-1 block text-sm font-medium text-invoice-body">
            Empresa que está cobrando ou recebendo <span className="text-[var(--invoice-primary)]">*</span>
          </label>
          <input
            id="billing"
            type="text"
            value={billingCompany}
            onChange={(e) => setBillingCompany(e.target.value)}
            onBlur={() => setTouchedField('billingCompany')}
            placeholder="e.g., Sua Empresa Serviços"
            className={cn(
              'w-full rounded-lg border px-4 py-3 text-invoice-heading transition-all duration-300',
              errors.billingCompany ? 'border-red-500' : 'border-gray-300',
              !errors.billingCompany && touched.billingCompany && billingCompany.trim() && 'border-green-500'
            )}
            aria-invalid={!!errors.billingCompany}
            aria-describedby={errors.billingCompany ? 'err-billing' : undefined}
          />
          {errors.billingCompany && (
            <p id="err-billing" className="mt-1 text-sm text-red-600" role="alert">{errors.billingCompany}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="serviceDate" className="mb-1 block text-sm font-medium text-invoice-body">
              Data do Serviço <span className="text-[var(--invoice-primary)]">*</span>
            </label>
            <input
              id="serviceDate"
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              onBlur={() => setTouchedField('serviceDate')}
              className={cn(
                'w-full rounded-lg border px-4 py-3 text-invoice-heading transition-all duration-300',
                errors.serviceDate ? 'border-red-500' : 'border-gray-300',
                !errors.serviceDate && touched.serviceDate && serviceDate && 'border-green-500'
              )}
              aria-invalid={!!errors.serviceDate}
            />
            {errors.serviceDate && <p className="mt-1 text-sm text-red-600" role="alert">{errors.serviceDate}</p>}
          </div>
          <div>
            <label htmlFor="invoiceDate" className="mb-1 block text-sm font-medium text-invoice-body">
              Data da Fatura <span className="text-[var(--invoice-primary)]">*</span>
            </label>
            <input
              id="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              onBlur={() => setTouchedField('invoiceDate')}
              className={cn(
                'w-full rounded-lg border px-4 py-3 text-invoice-heading transition-all duration-300',
                errors.invoiceDate ? 'border-red-500' : 'border-gray-300',
                !errors.invoiceDate && touched.invoiceDate && invoiceDate && 'border-green-500'
              )}
              aria-invalid={!!errors.invoiceDate}
            />
            {errors.invoiceDate && <p className="mt-1 text-sm text-red-600" role="alert">{errors.invoiceDate}</p>}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-invoice-body mb-3">
          Descrição do Serviço <span className="text-[var(--invoice-primary)]">*</span>
        </h3>
        <div className="space-y-4">
          {lineItems.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              error={errors[`desc-${item.id}`]}
              touched={touched[`desc-${item.id}`]}
              onTouched={() => setTouchedField(`desc-${item.id}`)}
              onUpdate={(updates) => updateLineItem(item.id, updates)}
              onRemove={() => removeLineItem(item.id)}
              canRemove={lineItems.length > 1}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addLineItem}
          className="mt-3 flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-300 hover:scale-110 focus:ring-2 focus:ring-offset-2"
          style={{ background: 'var(--invoice-primary)' }}
          aria-label="Adicionar linha"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>

      <div className="mt-6 rounded-lg border border-invoice-border bg-gray-50 p-4">
        <p className="text-sm text-invoice-body">Valor Total da Fatura</p>
        <p className="text-2xl font-bold text-invoice-heading" aria-live="polite">
          {CURRENCY_SYMBOL} {formatCurrency(total)}
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!isValid}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all duration-300 disabled:opacity-50"
          style={{ background: 'var(--invoice-primary)' }}
        >
          Preview Invoice
        </button>
        <InvoiceShareButtons
          invoiceNumber={invoiceNumber}
          invoiceDate={invoiceDate}
          total={total}
          isValid={isValid}
          payerCompany={payerCompany}
          billingCompany={billingCompany}
          lineItems={lineItems}
        />
      </div>

      <InvoicePreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={invoiceData}
      />
    </div>
  );
}

function LineItemRow({
  item,
  error,
  touched,
  onTouched,
  onUpdate,
  onRemove,
  canRemove,
}: {
  item: LineItem;
  error?: string;
  touched?: boolean;
  onTouched: () => void;
  onUpdate: (u: Partial<LineItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const subtotal = getSubtotal(item);
  const [priceInput, setPriceInput] = useState(item.unitPrice ? item.unitPrice.toFixed(2).replace('.', ',') : '');

  useEffect(() => {
    if (item.unitPrice > 0) setPriceInput(item.unitPrice.toFixed(2).replace('.', ','));
  }, [item.unitPrice]);

  const handlePriceChange = (raw: string) => {
    setPriceInput(raw);
    const num = parseFloat(raw.replace(',', '.')) || 0;
    onUpdate({ unitPrice: num });
  };

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 transition-all duration-300">
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          value={item.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          onBlur={onTouched}
          placeholder="e.g., Consultoria em Marketing Digital"
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm text-invoice-heading transition-all duration-300',
            error ? 'border-red-500' : 'border-gray-300',
            !error && touched && item.description.trim() && 'border-green-500'
          )}
          aria-invalid={!!error}
        />
        {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onUpdate({ quantity: Math.max(0, item.quantity - 1) })}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-invoice-body transition-colors hover:border-invoice-primary hover:text-invoice-primary"
          aria-label="Diminuir quantidade"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          className="h-8 w-12 rounded border border-gray-300 text-center text-sm text-invoice-heading"
          aria-label="Quantidade"
        />
        <button
          type="button"
          onClick={() => onUpdate({ quantity: item.quantity + 1 })}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 text-invoice-body transition-colors hover:border-invoice-primary hover:text-invoice-primary"
          aria-label="Aumentar quantidade"
        >
          +
        </button>
      </div>
      <div className="w-28">
        <input
          type="text"
          value={priceInput}
          onChange={(e) => handlePriceChange(e.target.value)}
          placeholder="R$ 0,00"
          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-invoice-heading transition-all duration-300"
        />
      </div>
      <div className="w-20 text-right text-sm font-semibold text-invoice-heading">
        {formatCurrency(subtotal)}
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
          aria-label="Remover linha"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
