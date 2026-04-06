'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PLAN_OPTIONS = [
  { value: 'mailing', label: 'Virtual Mailing Address ($9.99/mês)' },
  { value: 'business', label: 'Virtual Business Address ($14.99/mês)' },
  { value: 'office', label: 'Virtual Office ($39.99/mês)' },
];

export function GodrooxMailForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const phone = (formData.get('phone') as string)?.trim() || undefined;
    const plan = formData.get('plan') as string;
    const message = (formData.get('message') as string)?.trim() || '';

    if (!name || !email) {
      setError('Preencha nome e e-mail.');
      return;
    }

    const planLabel = PLAN_OPTIONS.find((p) => p.value === plan)?.label ?? plan;
    const subject = `Godroox Mail - ${planLabel}`;
    const body = `Plano escolhido: ${planLabel}\n\n${message}`.trim();

    setLoading(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message: body }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'Erro ao enviar. Tente novamente.');
        return;
      }
      setSuccess(true);
      form.reset();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-secondary-200 bg-white p-6 shadow-lg">
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="alert">
          Cadastro enviado com sucesso. Nossa equipe entrará em contato em breve.
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <div>
          <Input
            label="Nome completo *"
            name="name"
            type="text"
            placeholder="Seu nome"
            required
            disabled={loading}
          />
        </div>
        <div>
          <Input
            label="E-mail *"
            name="email"
            type="email"
            placeholder="seu@email.com"
            required
            disabled={loading}
          />
        </div>
        <div>
          <Input
            label="Telefone (opcional)"
            name="phone"
            type="tel"
            placeholder="+1 (321) 519-4710"
            disabled={loading}
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">
            Plano de interesse *
          </label>
          <select
            name="plan"
            required
            disabled={loading}
            className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">Selecione um plano</option>
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary-700">
            Observações (opcional)
          </label>
          <textarea
            name="message"
            rows={3}
            disabled={loading}
            className="flex w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            placeholder="Alguma dúvida ou informação adicional?"
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar cadastro'}
        </Button>
      </div>
    </form>
  );
}
