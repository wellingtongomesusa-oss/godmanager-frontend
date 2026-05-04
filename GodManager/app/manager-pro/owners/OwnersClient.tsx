'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OwnerDrawer from './OwnerDrawer';

export interface OwnerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  clientId: string;
  clientName: string | null;
  propertiesCount: number;
  usersCount: number;
  createdAt: string;
  updatedAt: string;
}

type DrawerState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; ownerId: string };

export default function OwnersClient() {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOwners = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/owners', window.location.origin);
      if (q.trim()) url.searchParams.set('search', q.trim());
      url.searchParams.set('limit', '500');

      const res = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      if (res.status === 401) {
        window.location.href = '/manager-pro/login';
        return;
      }
      if (res.status === 403) {
        setForbidden(true);
        setOwners([]);
        return;
      }

      const json = await res.json();
      if (!json.ok) {
        setError(json.error || 'failed_to_load');
        return;
      }
      setOwners(json.owners as OwnerRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwners('');
  }, [fetchOwners]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchOwners(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchOwners]);

  const ownersWithoutEmail = useMemo(
    () => owners.filter((o) => !o.email).length,
    [owners],
  );

  if (forbidden) {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold mb-2">Owners / Proprietários</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium mb-1">Sem permissão</p>
          <p>
            A tua conta não tem acesso a este módulo. Pede ao administrador
            para adicionar a permissão <code>owners</code> ao teu utilizador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Owners</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {owners.length} owner{owners.length === 1 ? '' : 's'}
            {ownersWithoutEmail > 0 && (
              <>
                {' · '}
                <span className="text-amber-700 font-medium">
                  {ownersWithoutEmail} sem email
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-neutral-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
          />
          <button
            type="button"
            onClick={() => setDrawer({ open: true, mode: 'create' })}
            className="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded-md hover:bg-neutral-700 transition"
          >
            + New owner
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium text-right">Properties</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {loading && owners.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && owners.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                    {search.trim() ? 'No owners match your search.' : 'No owners yet.'}
                  </td>
                </tr>
              )}
              {owners.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">{o.name}</td>
                  <td className="px-4 py-3">
                    {o.email ? (
                      <span className="text-neutral-700">{o.email}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Add email
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{o.phone || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-700">
                    {o.propertiesCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setDrawer({ open: true, mode: 'edit', ownerId: o.id })}
                      className="px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded transition"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawer.open && (
        <OwnerDrawer
          mode={drawer.mode}
          ownerId={drawer.mode === 'edit' ? drawer.ownerId : null}
          onClose={() => setDrawer({ open: false })}
          onSaved={() => {
            setDrawer({ open: false });
            fetchOwners(search);
          }}
        />
      )}
    </div>
  );
}
