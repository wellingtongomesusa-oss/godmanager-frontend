'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import {
  getCompany,
  getPaymentTermsOptions,
  createInvoice,
  updateInvoice,
  addDays,
  type InvoiceClient,
  type InvoiceCurrency,
  type PaymentTerms,
} from '@/services/invoices/invoices.service';
import type { Invoice } from '@/services/invoices/invoices.service';
import type { CompanyData } from '@/lib/company';

const CURRENCIES: InvoiceCurrency[] = ['USD', 'BRL', 'EUR'];
const TERMS_TO_DAYS: Record<PaymentTerms, number> = {
  'Net 7': 7,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60,
  'Due on receipt': 0,
};

type FormItem = { id: string; description: string; quantity: number; unitPrice: number; taxPercent: number };

function formItemId(): string {
  return `fi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface InvoiceFormProps {
  /** When provided, form is in edit mode; otherwise create. */
  invoice?: Invoice | null;
  onSuccess?: (id: string) => void;
}

export function InvoiceForm({ invoice, onSuccess }: InvoiceFormProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isEdit = Boolean(invoice);
  const termsOpts = getPaymentTermsOptions();

  const [client, setClient] = useState<InvoiceClient>({
    name: '',
    address: '',
    country: '',
    email: '',
    phone: '',
  });
  const [company, setCompany] = useState<CompanyData>(getCompany());
  const [emissionDate, setEmissionDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState<InvoiceCurrency>('USD');
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>('Net 30');
  const [items, setItems] = useState<FormItem[]>(() =>
    invoice ? [] : [{ id: formItemId(), description: '', quantity: 1, unitPrice: 0, taxPercent: 0 }]
  );
  const [discounts, setDiscounts] = useState(0);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = getCompany();
    setCompany(c);
    const today = new Date().toISOString().slice(0, 10);
    setEmissionDate((prev) => prev || today);
    setDueDate((prev) => prev || addDays(today, 30));
  }, []);

  useEffect(() => {
    if (!invoice) return;
    setClient({ ...invoice.client });
    setCompany({ ...invoice.company });
    setEmissionDate(invoice.emissionDate);
    setDueDate(invoice.dueDate);
    setCurrency(invoice.currency);
    setPaymentTerms(invoice.paymentTerms);
    setItems(
      invoice.items.map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxPercent: i.taxPercent,
      }))
    );
    setDiscounts(invoice.discounts);
    setNotes(invoice.notes);
  }, [invoice]);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { id: formItemId(), description: '', quantity: 1, unitPrice: 0, taxPercent: 0 }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<FormItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const onEmissionDateChange = (v: string) => {
    setEmissionDate(v);
    const d = TERMS_TO_DAYS[paymentTerms];
    if (d > 0) setDueDate(addDays(v, d));
  };

  const onPaymentTermsChange = (v: PaymentTerms) => {
    setPaymentTerms(v);
    const d = TERMS_TO_DAYS[v];
    if (d > 0 && emissionDate) setDueDate(addDays(emissionDate, d));
  };

  const { subtotal, taxes, total } = React.useMemo(() => {
    let st = 0;
    let tx = 0;
    items.forEach((it) => {
      const line = it.quantity * it.unitPrice;
      st += line;
      tx += line * (it.taxPercent / 100);
    });
    st = Math.round(st * 100) / 100;
    tx = Math.round(tx * 100) / 100;
    const tot = Math.round((st + tx - discounts) * 100) / 100;
    return { subtotal: st, taxes: tx, total: tot };
  }, [items, discounts]);

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!client.name?.trim()) e.clientName = 'Required';
    if (!client.email?.trim()) e.clientEmail = 'Required';
    if (!emissionDate) e.emissionDate = 'Required';
    if (!dueDate) e.dueDate = 'Required';
    const validItems = items.filter((it) => it.description.trim() && it.quantity > 0 && it.unitPrice >= 0);
    if (validItems.length === 0) e.items = 'Add at least one item';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [client, emissionDate, dueDate, items]);

  const handleGenerate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setLoading(true);
      try {
        const validItems = items.filter((it) => it.description.trim() && it.quantity > 0 && it.unitPrice >= 0);
        if (isEdit && invoice) {
          const updated = updateInvoice(invoice.id, {
            client,
            company,
            emissionDate,
            dueDate,
            currency,
            paymentTerms,
            items: validItems,
            discounts,
            notes,
          });
          if (updated) {
            onSuccess?.(updated.id);
            router.push(`/admin/invoices/${updated.id}`);
          }
        } else {
          const created = createInvoice({
            client,
            company,
            emissionDate,
            dueDate,
            currency,
            paymentTerms,
            items: validItems,
            discounts,
            notes,
          });
          onSuccess?.(created.id);
          router.push(`/admin/invoices/${created.id}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [
      validate,
      client,
      company,
      emissionDate,
      dueDate,
      currency,
      paymentTerms,
      items,
      discounts,
      notes,
      isEdit,
      invoice,
      onSuccess,
      router,
    ]
  );

  const handleSaveDraft = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!client.name?.trim() || !emissionDate || !dueDate) {
        setErrors({ draft: 'Fill client name and dates to save draft.' });
        return;
      }
      setLoading(true);
      try {
        const validItems = items.filter((it) => it.description.trim() && it.quantity > 0 && it.unitPrice >= 0);
        const input = {
          client,
          company,
          emissionDate,
          dueDate,
          currency,
          paymentTerms,
          items: validItems.length ? validItems : [{ description: 'Draft', quantity: 1, unitPrice: 0, taxPercent: 0 }],
          discounts,
          notes,
        };
        if (isEdit && invoice) {
          const updated = updateInvoice(invoice.id, { ...input, status: 'em_aberto' as const });
          if (updated) router.push(`/admin/invoices/${updated.id}`);
        } else {
          const created = createInvoice({ ...input, status: 'em_aberto' });
          router.push(`/admin/invoices/${created.id}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [client, company, emissionDate, dueDate, currency, paymentTerms, items, discounts, notes, isEdit, invoice, router]
  );

  return (
    <form onSubmit={handleGenerate} className="space-y-6">
      {errors.draft && (
        <div className="rounded-lg border border-accent-300 bg-accent-50 px-4 py-2 text-sm text-accent-700">
          {errors.draft}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('inv.form.clientTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('inv.form.clientName')}
            value={client.name}
            onChange={(e) => setClient((c: InvoiceClient) => ({ ...c, name: e.target.value }))}
            required
            disabled={loading}
            error={errors.clientName}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('inv.form.clientAddress')}
              value={client.address}
              onChange={(e) => setClient((c: InvoiceClient) => ({ ...c, address: e.target.value }))}
              disabled={loading}
            />
          </div>
          <Input
            label={t('inv.form.clientCountry')}
            value={client.country}
            onChange={(e) => setClient((c: InvoiceClient) => ({ ...c, country: e.target.value }))}
            disabled={loading}
          />
          <Input
            label={t('inv.form.clientEmail')}
            type="email"
            value={client.email}
            onChange={(e) => setClient((c: InvoiceClient) => ({ ...c, email: e.target.value }))}
            required
            disabled={loading}
            error={errors.clientEmail}
          />
          <Input
            label={t('inv.form.clientPhone')}
            value={client.phone}
            onChange={(e) => setClient((c: InvoiceClient) => ({ ...c, phone: e.target.value }))}
            disabled={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('inv.form.companyTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('inv.form.companyName')}
            value={company.name}
            onChange={(e) => setCompany((c: CompanyData) => ({ ...c, name: e.target.value }))}
            disabled={loading}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('inv.form.clientAddress')}
              value={company.address}
              onChange={(e) => setCompany((c: CompanyData) => ({ ...c, address: e.target.value }))}
              disabled={loading}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="City"
              value={company.city}
              onChange={(e) => setCompany((c: CompanyData) => ({ ...c, city: e.target.value }))}
              disabled={loading}
            />
            <Input
              label="State"
              value={company.state}
              onChange={(e) => setCompany((c: CompanyData) => ({ ...c, state: e.target.value }))}
              disabled={loading}
            />
            <Input
              label="ZIP"
              value={company.zip}
              onChange={(e) => setCompany((c: CompanyData) => ({ ...c, zip: e.target.value }))}
              disabled={loading}
            />
          </div>
          <Input
            label={t('inv.form.clientCountry')}
            value={company.country}
            onChange={(e) => setCompany((c: CompanyData) => ({ ...c, country: e.target.value }))}
            disabled={loading}
          />
          <Input
            label={t('inv.form.clientEmail')}
            type="email"
            value={company.email}
            onChange={(e) => setCompany((c: CompanyData) => ({ ...c, email: e.target.value }))}
            disabled={loading}
          />
          <Input
            label={t('inv.form.clientPhone')}
            value={company.phone}
            onChange={(e) => setCompany((c: CompanyData) => ({ ...c, phone: e.target.value }))}
            disabled={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('inv.form.invoiceTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isEdit && invoice && (
            <Input label={t('inv.number')} value={invoice.number} disabled />
          )}
          <Input
            label={t('inv.emissionDate')}
            type="date"
            value={emissionDate}
            onChange={(e) => onEmissionDateChange(e.target.value)}
            required
            disabled={loading}
            error={errors.emissionDate}
          />
          <Input
            label={t('inv.dueDate')}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            disabled={loading}
            error={errors.dueDate}
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('inv.form.currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as InvoiceCurrency)}
              className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-secondary-700">{t('inv.form.paymentTerms')}</label>
            <select
              value={paymentTerms}
              onChange={(e) => onPaymentTermsChange(e.target.value as PaymentTerms)}
              className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={loading}
            >
              {termsOpts.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('inv.form.items')}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={loading}>
            {t('inv.form.addItem')}
          </Button>
        </CardHeader>
        <CardContent>
          {errors.items && (
            <p className="mb-2 text-sm text-accent-600">{errors.items}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 text-left text-secondary-600">
                  <th className="pb-2 pr-2">{t('inv.form.description')}</th>
                  <th className="w-20 pb-2 pr-2">{t('inv.form.quantity')}</th>
                  <th className="w-28 pb-2 pr-2">{t('inv.form.unitPrice')}</th>
                  <th className="w-20 pb-2 pr-2">{t('inv.form.tax')}</th>
                  <th className="w-24 pb-2 pr-2">{t('inv.form.lineTotal')}</th>
                  <th className="w-16 pb-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const line = it.quantity * it.unitPrice;
                  const tax = line * (it.taxPercent / 100);
                  const lineTotal = Math.round((line + tax) * 100) / 100;
                  return (
                    <tr key={it.id} className="border-b border-secondary-100">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={it.description}
                          onChange={(e) => updateItem(it.id, { description: e.target.value })}
                          className="w-full rounded border border-secondary-300 px-2 py-1.5 text-secondary-900 focus:ring-2 focus:ring-primary-500"
                          placeholder={t('inv.form.description')}
                          disabled={loading}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={it.quantity}
                          onChange={(e) => updateItem(it.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full rounded border border-secondary-300 px-2 py-1.5 text-secondary-900 focus:ring-2 focus:ring-primary-500"
                          disabled={loading}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.unitPrice}
                          onChange={(e) => updateItem(it.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full rounded border border-secondary-300 px-2 py-1.5 text-secondary-900 focus:ring-2 focus:ring-primary-500"
                          disabled={loading}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={it.taxPercent}
                          onChange={(e) => updateItem(it.id, { taxPercent: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-full rounded border border-secondary-300 px-2 py-1.5 text-secondary-900 focus:ring-2 focus:ring-primary-500"
                          disabled={loading}
                        />
                      </td>
                      <td className="py-2 pr-2 font-medium">{formatCurrency(lineTotal, currency)}</td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(it.id)}
                          disabled={loading || items.length <= 1}
                          className="text-accent-600 hover:text-accent-700"
                        >
                          {t('inv.form.removeItem')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('inv.form.total')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('inv.form.subtotal')}</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>{t('inv.form.taxes')}</span>
            <span>{formatCurrency(taxes, currency)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{t('inv.form.discounts')}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={discounts}
                onChange={(e) => setDiscounts(Math.max(0, Number(e.target.value) || 0))}
                disabled={loading}
                className="w-24 rounded-lg border border-secondary-300 px-2 py-1.5 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-secondary-600">-{formatCurrency(discounts, currency)}</span>
            </div>
          </div>
          <div className="flex justify-between border-t border-secondary-200 pt-2 text-base font-semibold">
            <span>{t('inv.form.total')}</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('inv.form.notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder={t('inv.form.notes')}
            disabled={loading}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={loading}>
          {t('inv.form.generate')}
        </Button>
        <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={loading}>
          {t('inv.form.saveDraft')}
        </Button>
        <Link href="/admin/invoices">
          <Button type="button" variant="ghost" disabled={loading}>
            {t('inv.form.cancel')}
          </Button>
        </Link>
      </div>
    </form>
  );
}
