'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SUBJECT_OPTIONS = [
  { value: 'General Inquiry', label: 'General Inquiry' },
  { value: 'Life Insurance', label: 'Life Insurance' },
  { value: 'Florida LLC', label: 'Florida LLC' },
  { value: 'International Payments', label: 'International Payments' },
  { value: 'Technical Support', label: 'Technical Support' },
  { value: 'Partnership', label: 'Partnership' },
];

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = (formData.get('phone') as string) || undefined;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`${base}/api/v1/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone?.trim() || undefined, subject, message: message.trim() }),
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
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Envie sua mensagem</CardTitle>
        <CardDescription>
          Preencha o formulário abaixo. A mensagem será enviada para contact@godroox.com e nossa equipe responderá em até 24 horas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="alert">
            Mensagem enviada com sucesso. Em breve entraremos em contato.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              label="Nome completo"
              name="name"
              type="text"
              placeholder="Seu nome"
              required
              disabled={loading}
            />
          </div>
          <div>
            <Input
              label="E-mail"
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
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Assunto
            </label>
            <select
              name="subject"
              required
              disabled={loading}
              className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            >
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Mensagem
            </label>
            <textarea
              name="message"
              required
              disabled={loading}
              rows={5}
              className="flex min-h-[120px] w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              placeholder="Como podemos ajudar?"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar mensagem'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
