'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

export interface ChatFormData {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

const SERVICE_OPTIONS = [
  { value: '', label: 'Selecione um serviço (opcional)' },
  { value: 'life_insurance', label: 'Life Insurance' },
  { value: 'llc_florida', label: 'Florida LLC Formation' },
  { value: 'international_payments', label: 'International Payments' },
  { value: 'godroox_mail', label: 'Godroox Mail' },
  { value: 'godroox_pro', label: 'Godroox PRO' },
  { value: 'other', label: 'Outro' },
];

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

interface ChatFormProps {
  onClose: () => void;
}

/**
 * Formulário de contato do chat (drawer).
 * Estados: idle, loading, success, error.
 */
export function ChatForm({ onClose }: ChatFormProps) {
  const [formData, setFormData] = useState<ChatFormData>({
    name: '',
    email: '',
    phone: '',
    service: '',
    message: '',
  });
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/chat-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar mensagem.');
      }

      setStatus('success');
      setFormData({ name: '', email: '', phone: '', service: '', message: '' });
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }, [formData]);

  const resetToForm = useCallback(() => {
    setStatus('idle');
    setErrorMessage('');
  }, []);

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
        <div className="h-16 w-16 rounded-full bg-success-100 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4 className="text-lg font-semibold text-secondary-900 mb-2">Mensagem Enviada!</h4>
        <p className="text-sm text-secondary-600 mb-6">
          Obrigado pelo contato. Responderemos em breve.
        </p>
        <Button onClick={resetToForm} variant="outline" size="sm">
          Enviar nova mensagem
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start space-x-2 mb-4">
        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary-600">G</span>
        </div>
        <div className="bg-secondary-100 rounded-lg p-3 max-w-[85%]">
          <p className="text-sm text-secondary-900">
            Olá! Preencha o formulário abaixo e entraremos em contato o mais rápido possível.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="chat-name" className="block text-sm font-medium text-secondary-700 mb-1">Nome *</label>
        <input
          id="chat-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Seu nome completo"
          className="w-full h-10 px-3 rounded-lg border border-secondary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="chat-email" className="block text-sm font-medium text-secondary-700 mb-1">E-mail *</label>
        <input
          id="chat-email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder="seu@email.com"
          className="w-full h-10 px-3 rounded-lg border border-secondary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="chat-phone" className="block text-sm font-medium text-secondary-700 mb-1">Telefone / WhatsApp</label>
        <input
          id="chat-phone"
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="+1 (321) 000-0000"
          className="w-full h-10 px-3 rounded-lg border border-secondary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="chat-service" className="block text-sm font-medium text-secondary-700 mb-1">Serviço de interesse</label>
        <select
          id="chat-service"
          name="service"
          value={formData.service}
          onChange={handleChange}
          className="w-full h-10 px-3 rounded-lg border border-secondary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
        >
          {SERVICE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="chat-message" className="block text-sm font-medium text-secondary-700 mb-1">Mensagem *</label>
        <textarea
          id="chat-message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={3}
          placeholder="Como podemos ajudar?"
          className="w-full px-3 py-2 rounded-lg border border-secondary-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
        />
      </div>

      {status === 'error' && (
        <div className="bg-danger-50 text-danger-700 text-sm p-3 rounded-lg">
          {errorMessage || 'Erro ao enviar. Tente novamente.'}
        </div>
      )}

      <Button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white"
      >
        {status === 'loading' ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Enviando...
          </span>
        ) : (
          'Enviar Mensagem'
        )}
      </Button>

      <p className="text-xs text-secondary-500 text-center">
        Você também pode ligar: <a href="tel:+13215194710" className="text-primary-600 hover:underline">+1 (321) 519-4710</a>
      </p>
    </form>
  );
}
