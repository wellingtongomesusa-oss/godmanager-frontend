'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/language-context';
import { usePlan } from '@/contexts/plan-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getEmailConfig,
  connectEmail,
  disconnectEmail,
  listInboxEmails,
  sendInboxEmail,
  type EmailProvider,
  type InboxEmail,
} from '@/services/email-inbox.service';
import {
  requestProfessionalEmail,
  listProfessionalEmailRequests,
  getEmailDomain,
  type ProfessionalEmailRequest,
} from '@/services/professional-email.service';

const PROVIDERS: { value: EmailProvider; label: string }[] = [
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook / Microsoft 365' },
  { value: 'sendgrid', label: 'SendGrid' },
  { value: 'mailgun', label: 'Mailgun' },
  { value: 'ses', label: 'Amazon SES' },
];

export default function EmailPage() {
  const { t } = useLanguage();
  const { isPlan3 } = usePlan();
  const [config, setConfig] = useState(getEmailConfig());
  const [provider, setProvider] = useState<EmailProvider>('gmail');
  const [address, setAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [inbox, setInbox] = useState<InboxEmail[]>([]);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [proRequests, setProRequests] = useState<ProfessionalEmailRequest[]>([]);
  const [proLocal, setProLocal] = useState('');
  const [proSubmitting, setProSubmitting] = useState(false);

  useEffect(() => {
    setConfig(getEmailConfig());
  }, []);

  useEffect(() => {
    listInboxEmails().then(setInbox);
  }, [config?.connected]);

  useEffect(() => {
    if (isPlan3) listProfessionalEmailRequests().then(setProRequests);
  }, [isPlan3]);

  const handleConnect = async () => {
    if (!address.trim()) return;
    setConnecting(true);
    try {
      const c = await connectEmail(provider, address.trim());
      setConfig(c);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectEmail();
    setConfig(getEmailConfig());
    setInbox([]);
  };

  const handleSend = async () => {
    if (!composeTo.trim()) return;
    setSending(true);
    try {
      const r = await sendInboxEmail({ to: composeTo, subject: composeSubject, body: composeBody });
      if (r.success) {
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
      }
    } finally {
      setSending(false);
    }
  };

  const handleRequestPro = async () => {
    setProSubmitting(true);
    try {
      await requestProfessionalEmail(proLocal);
      setProLocal('');
      const list = await listProfessionalEmailRequests();
      setProRequests(list);
    } catch (e) {
      // toast or inline error
    } finally {
      setProSubmitting(false);
    }
  };

  const domain = getEmailDomain();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-secondary-900">{t('email.title')}</h1>
        <p className="text-secondary-600 mt-1">{t('email.subtitle')}</p>
      </div>

      <Card variant="outlined">
        <CardHeader>
          <CardTitle>{config?.connected ? t('email.disconnect') : t('email.connect')}</CardTitle>
          <CardDescription>
            {config?.connected
              ? `Conectado como ${config.email} (${config.provider}).`
              : 'Conecte Gmail, Outlook ou outro provedor para visualizar e enviar e-mails.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config?.connected ? (
            <Button variant="outline" onClick={handleDisconnect}>
              {t('email.disconnect')}
            </Button>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary-700">{t('email.provider')}</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as EmailProvider)}
                    className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-secondary-900"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary-700">{t('email.address')}</label>
                  <Input
                    type="email"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? '...' : t('email.connect')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {config?.connected && (
        <>
          <Card variant="outlined">
            <CardHeader>
              <CardTitle>{t('email.inbox')}</CardTitle>
              <CardDescription>Últimas mensagens (mock).</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-secondary-200">
                {inbox.map((m) => (
                  <li key={m.id} className="py-3">
                    <p className="font-medium text-secondary-900">{m.subject}</p>
                    <p className="text-sm text-secondary-600">{m.from} → {m.to}</p>
                    <p className="text-sm text-secondary-500 truncate">{m.snippet}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>{t('email.compose')}</CardTitle>
              <CardDescription>Enviar e-mail (mock).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">{t('email.to')}</label>
                <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="destinatario@email.com" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">{t('email.subject')}</label>
                <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Assunto" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary-700">{t('email.body')}</label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-secondary-300 px-4 py-2 text-secondary-900"
                  placeholder="Mensagem..."
                />
              </div>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? '...' : t('email.send')}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {isPlan3 && (
        <Card variant="outlined" className="border-primary-200 bg-primary-50/30">
          <CardHeader>
            <CardTitle>{t('emailPro.title')}</CardTitle>
            <CardDescription>{t('emailPro.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-secondary-700">
              Deseja criar um e-mail profissional? O endereço será <strong>nome@{domain}</strong>.
            </p>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-sm font-medium text-secondary-700">{t('emailPro.local')}</label>
                <Input
                  value={proLocal}
                  onChange={(e) => setProLocal(e.target.value)}
                  placeholder="contato, vendas, suporte..."
                />
              </div>
              <div className="text-sm text-secondary-600">
                {t('emailPro.preview')}: {proLocal.trim() ? `${proLocal.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || '...'}@${domain}` : `...@${domain}`}
              </div>
              <Button onClick={handleRequestPro} disabled={proSubmitting || !proLocal.trim()}>
                {proSubmitting ? '...' : t('emailPro.request')}
              </Button>
            </div>
            {proRequests.length > 0 && (
              <div className="mt-4 pt-4 border-t border-secondary-200">
                <p className="text-sm font-medium text-secondary-800 mb-2">Solicitações recentes</p>
                <ul className="space-y-2">
                  {proRequests.slice(0, 5).map((r) => (
                    <li key={r.id} className="text-sm text-secondary-600">
                      {r.fullEmail} — {r.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
