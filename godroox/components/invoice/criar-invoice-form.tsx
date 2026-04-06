'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n';

const WHATSAPP_NUMBER = '13215194710';

export function CriarInvoiceForm() {
  const { t } = useLanguage();
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saved, setSaved] = useState(false);

  const invoiceData = {
    clientName,
    description,
    value,
    date,
    invoiceNumber,
  };

  const hasData = clientName || description || value || date || invoiceNumber;

  const handleSave = () => {
    const invoices = JSON.parse(localStorage.getItem('godroox-invoices') || '[]');
    invoices.push({
      ...invoiceData,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('godroox-invoices', JSON.stringify(invoices));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const formatInvoiceText = () => {
    return [
      `Invoice ${invoiceNumber || 'N/A'}`,
      `Client: ${clientName || 'N/A'}`,
      `Date: ${date || 'N/A'}`,
      `Description: ${description || 'N/A'}`,
      `Amount: $${value || '0.00'}`,
    ].join('\n');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Invoice ${invoiceNumber || 'N/A'} - ${clientName || 'Client'}`);
    const body = encodeURIComponent(formatInvoiceText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(formatInvoiceText());
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl text-secondary-900">
          {t('invoice.title')}
        </CardTitle>
        <p className="text-sm text-secondary-600 mt-1">
          {t('invoice.subtitle')}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Input
          label={t('invoice.clientName')}
          placeholder={t('invoice.placeholder.clientName')}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">
            {t('invoice.description')}
          </label>
          <textarea
            placeholder={t('invoice.placeholder.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="flex w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label={t('invoice.value')}
            type="text"
            inputMode="decimal"
            placeholder={t('invoice.placeholder.value')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Input
            label={t('invoice.date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Input
          label={t('invoice.number')}
          placeholder={t('invoice.placeholder.number')}
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />

        {saved && (
          <p className="text-sm font-medium text-success-600 animate-fade-in">
            {t('invoice.saved')}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          <Button
            onClick={handleSave}
            disabled={!hasData}
            className="flex-1 sm:flex-none"
          >
            {t('invoice.save')}
          </Button>
          <Button
            variant="outline"
            onClick={handleShareEmail}
            disabled={!hasData}
            className="flex-1 sm:flex-none"
          >
            {t('invoice.shareEmail')}
          </Button>
          <Button
            variant="outline"
            onClick={handleShareWhatsApp}
            disabled={!hasData}
            className="flex-1 sm:flex-none"
          >
            {t('invoice.shareWhatsApp')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
