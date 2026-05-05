'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OwnerProperty {
  id: string;
  code: string;
  address: string;
  status: string;
}

interface OwnerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  clientName: string | null;
  properties: OwnerProperty[];
  usersCount: number;
}

interface OwnerDrawerProps {
  mode: 'create' | 'edit';
  ownerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function PasswordPanel({
  ownerId,
  email,
  ownerName,
}: {
  ownerId: string;
  email: string;
  ownerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<{
    email: string;
    password: string;
    action: 'created' | 'updated';
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'err';
    msg: string;
  } | null>(null);

  const handleCopy = async () => {
    if (!lastSaved) return;
    const firstName = ownerName.trim().split(/\s+/)[0] || 'proprietario';
    const text = `Ola ${firstName},

Seu acesso ao Portal do Proprietario Manager Prop:

URL: https://www.godmanager.us/portal
Email: ${lastSaved.email}
Senha temporaria: ${lastSaved.password}

Recomendamos alterar a senha apos o primeiro acesso.

Em caso de duvida, entre em contato.

Atenciosamente,
Equipe Manager Prop`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setFeedback({ kind: 'err', msg: 'Falha ao copiar. Selecione manualmente o texto abaixo.' });
    }
  };

  const handleSave = async () => {
    setFeedback(null);
    if (password.length < 8) {
      setFeedback({ kind: 'err', msg: 'Senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (password !== confirm) {
      setFeedback({ kind: 'err', msg: 'Senhas nao coincidem.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/owners/${ownerId}/set-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!json.ok) {
        let msg: string = json.error || 'falha';
        if (json.error === 'email_in_use') msg = json.message ?? msg;
        if (json.error === 'owner_email_required')
          msg = 'Owner sem email — preencha o email primeiro.';
        if (json.error === 'validation') msg = 'Senha invalida (min 8 chars).';
        setFeedback({ kind: 'err', msg });
        setSaving(false);
        return;
      }
      const action = json.action === 'created' ? 'criada' : 'actualizada';
      const actionTyped = json.action === 'created' ? 'created' : 'updated';
      setFeedback({
        kind: 'ok',
        msg: `Conta ${action}. Owner pode logar em /owner-portal/login com email ${json.email}.`,
      });
      setLastSaved({
        email: json.email,
        password,
        action: actionTyped,
      });
      setPassword('');
      setConfirm('');
      setSaving(false);
    } catch (e) {
      setFeedback({
        kind: 'err',
        msg: e instanceof Error ? e.message : 'erro',
      });
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="border-t border-gm-border pt-4 mt-2">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gm-ink-secondary">
          Acesso ao Portal
        </h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-gm-amber hover:underline"
        >
          Definir / redefinir senha
        </button>
        <p className="mt-1 text-xs text-gm-ink-secondary">
          Permite ao proprietario logar em /owner-portal/login.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gm-border pt-4 mt-2">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gm-ink-secondary">
        Definir Senha do Portal
      </h3>
      <div className="space-y-2">
        <input
          type="password"
          placeholder="Nova senha (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-gm-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gm-amber"
          autoComplete="new-password"
        />
        <input
          type="password"
          placeholder="Confirmar senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-md border border-gm-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gm-amber"
          autoComplete="new-password"
        />

        {feedback ? (
          <div
            className={`rounded-md border p-2 text-xs ${
              feedback.kind === 'ok'
                ? 'border-gm-amber-bd bg-gm-amber-bg text-gm-ink'
                : 'border-gm-red-bg bg-gm-red-bg text-gm-red'
            }`}
          >
            {feedback.msg}
          </div>
        ) : null}

        {lastSaved ? (
          <div className="mt-3 space-y-2 rounded-md border border-gm-amber bg-gm-amber/10 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gm-ink">
              Compartilhar com proprietario
            </h4>
            <dl className="space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-16 font-semibold text-gm-ink-secondary">Portal:</dt>
                <dd className="font-mono text-gm-ink">godmanager.us/portal</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 font-semibold text-gm-ink-secondary">Email:</dt>
                <dd className="break-all font-mono text-gm-ink">{lastSaved.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 font-semibold text-gm-ink-secondary">Senha:</dt>
                <dd className="font-mono text-gm-ink">{lastSaved.password}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full rounded-md bg-gm-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gm-ink/90"
            >
              {copied ? 'Copiado para a area de transferencia' : 'Copiar texto pronto para email / WhatsApp'}
            </button>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !password || !confirm}
            className="rounded-md bg-gm-amber px-3 py-1.5 text-xs font-semibold text-white shadow-gm-amber hover:bg-gm-amber-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar senha'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setPassword('');
              setConfirm('');
              setFeedback(null);
              setLastSaved(null);
            }}
            className="rounded-md border border-gm-border px-3 py-1.5 text-xs text-gm-ink-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OwnerDrawer({ mode, ownerId, onClose, onSaved }: OwnerDrawerProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [active, setActive] = useState(true);
  const [properties, setProperties] = useState<OwnerProperty[]>([]);
  const [clientName, setClientName] = useState<string | null>(null);

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'edit' || !ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/owners/${ownerId}`, { credentials: 'include' });
        if (res.status === 401) {
          window.location.href = '/manager-pro/login';
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || 'failed_to_load');
          return;
        }
        const o: OwnerDetail = json.owner;
        setName(o.name);
        setEmail(o.email ?? '');
        setPhone(o.phone ?? '');
        setNotes(o.notes ?? '');
        setActive(o.active);
        setProperties(o.properties);
        setClientName(o.clientName);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'unknown');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, ownerId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = mode === 'create' ? '/api/owners' : `/api/owners/${ownerId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      let body: Record<string, unknown>;
      if (mode === 'create') {
        body = { name: name.trim() };
        const em = email.trim();
        if (em) body.email = em.toLowerCase();
        const ph = phone.trim();
        if (ph) body.phone = ph;
        const nt = notes.trim();
        if (nt) body.notes = nt;
      } else {
        body = {
          name: name.trim(),
          email: email.trim() === '' ? null : email.trim().toLowerCase(),
          phone: phone.trim() === '' ? null : phone.trim(),
          notes: notes.trim() === '' ? null : notes.trim(),
          active,
        };
      }

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!json.ok) {
        if (json.error === 'duplicate_email' || json.error === 'duplicate') {
          setError('Já existe um owner com este email neste cliente.');
        } else if (json.error === 'validation') {
          setError('Dados inválidos. Verifica nome e email.');
        } else if (res.status === 403) {
          setError('Sem permissão para esta acção.');
        } else {
          setError(json.error || 'failed_to_save');
        }
        setSaving(false);
        return;
      }

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
        role="dialog"
        aria-label={mode === 'create' ? 'New owner' : 'Edit owner'}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'New owner' : 'Edit owner'}
            </h2>
            {clientName && mode === 'edit' && (
              <p className="text-xs text-neutral-500 mt-0.5">{clientName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-neutral-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  placeholder="owner@example.com"
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Required for owner to access their portal.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={60}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              {mode === 'edit' && (
                <div className="flex items-center gap-2">
                  <input
                    id="active-toggle"
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="active-toggle" className="text-sm text-neutral-700">
                    Active
                  </label>
                </div>
              )}

              {mode === 'edit' && email.trim() !== '' && ownerId ? (
                <PasswordPanel ownerId={ownerId!} email={email} ownerName={name} />
              ) : null}

              {mode === 'edit' && properties.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-700 mb-2 uppercase tracking-wide">
                    Properties ({properties.length})
                  </h3>
                  <div className="border border-neutral-200 rounded-md divide-y divide-neutral-200 max-h-48 overflow-y-auto">
                    {properties.map((p) => (
                      <Link
                        key={p.id}
                        href={`/manager-pro/properties?code=${encodeURIComponent(p.code)}`}
                        className="flex items-center justify-between px-3 py-2 text-xs hover:bg-neutral-50"
                      >
                        <div>
                          <div className="font-medium text-neutral-900">{p.code}</div>
                          <div className="text-neutral-500 truncate max-w-xs">{p.address}</div>
                        </div>
                        <span className="text-neutral-400">{p.status}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 px-6 py-4 bg-neutral-50 flex items-center justify-end gap-2 sticky bottom-0">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm border border-neutral-300 rounded-md hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </aside>
    </>
  );
}
