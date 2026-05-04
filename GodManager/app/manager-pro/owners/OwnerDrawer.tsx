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
