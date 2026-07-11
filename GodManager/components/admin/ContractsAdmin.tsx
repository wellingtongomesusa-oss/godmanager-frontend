'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Upload, RefreshCw, Eye, Download, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

type Row = {
  propertyId: string;
  code: string;
  address: string;
  tenantName: string | null;
  hasContract: boolean;
  contract: {
    fileName: string;
    fileSize: number | null;
    uploadedAt: string;
    viewUrl: string | null;
    downloadUrl: string | null;
  } | null;
};
type ClientOpt = { id: string; name: string };

const kb = (n: number | null) => (n ? Math.round(n / 1024) + ' KB' : '');

export function ContractsAdmin() {
  const { user } = useAuth();
  const isSuper = String(user?.role || '').toLowerCase() === 'super_admin';
  const roleOk = !user || ['super_admin', 'admin', 'manager'].includes(String(user.role).toLowerCase());

  // clientId vindo da URL (?clientId=) como padrão
  const urlClientId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('clientId') || '';
  }, []);

  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [clientId, setClientId] = useState(urlClientId);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const pendingProp = useRef<string | null>(null);

  // carrega empresas (super_admin)
  useEffect(() => {
    if (!isSuper) return;
    (async () => {
      try {
        const r = await fetch('/api/admin/clients', { credentials: 'include', cache: 'no-store' });
        const d = await r.json().catch(() => null);
        if (d?.ok && Array.isArray(d.clients)) {
          setClients(
            d.clients.map((c: Record<string, unknown>) => ({
              id: String(c.id),
              name: String(c.companyName || c.company || c.name || c.id),
            })),
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [isSuper]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      const r = await fetch('/api/contracts' + qs, { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        setRows([]);
        return;
      }
      setRows(d.properties || []);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Falha' });
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (isSuper && !clientId) return; // espera escolher empresa
    void load();
  }, [load, isSuper, clientId]);

  const pickFile = (propertyId: string) => {
    pendingProp.current = propertyId;
    fileInput.current?.click();
  };

  const onFile = useCallback(
    async (f: File | null) => {
      const propertyId = pendingProp.current;
      if (!f || !propertyId) return;
      setBusyId(propertyId);
      setMsg(null);
      try {
        const fd = new FormData();
        fd.append('file', f);
        const r = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/contract`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) {
          setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        } else {
          setMsg({ ok: true, text: 'Contrato salvo na casa.' });
          await load();
        }
      } catch (e) {
        setMsg({ ok: false, text: e instanceof Error ? e.message : 'Falha no upload' });
      } finally {
        setBusyId(null);
        pendingProp.current = null;
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [load],
  );

  const del = useCallback(
    async (propertyId: string) => {
      if (!window.confirm('Excluir o contrato desta casa?')) return;
      setBusyId(propertyId);
      try {
        const r = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/contract`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) setMsg({ ok: false, text: d.error || `Erro ${r.status}` });
        else await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.code, r.address, r.tenantName, r.contract?.fileName].join(' ').toLowerCase().includes(s),
    );
  }, [rows, q]);

  const withContract = rows.filter((r) => r.hasContract).length;

  if (!roleOk) {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-slate-500">Acesso restrito.</div>;
  }

  return (
    <div className="w-full px-6 py-6 sm:px-8">
      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] || null)}
      />

      <div className="mb-5 flex items-center gap-3">
        <FileText className="h-6 w-6 text-[#22558c]" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Contratos</h1>
          <p className="text-sm text-slate-500">
            Suba o contrato de cada casa (PDF, DOC ou DOCX). Fica salvo na casa e vinculado ao
            inquilino atual.
          </p>
        </div>
      </div>

      {/* Barra: empresa (super_admin) + busca */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        {isSuper && (
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-600">Empresa:</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#22558c]"
            >
              <option value="">— escolha a empresa —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar casa, inquilino ou arquivo…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#22558c]"
          />
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || (isSuper && !clientId)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {isSuper && !clientId ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-500">
          Escolha a empresa acima para ver as casas e subir os contratos.
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-slate-500">
            {rows.length} casa(s) · {withContract} com contrato
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Casa</th>
                  <th className="px-3 py-2.5">Inquilino atual</th>
                  <th className="px-3 py-2.5">Contrato</th>
                  <th className="px-3 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.propertyId} className={`border-b border-slate-100 align-middle ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-2.5">
                      <div className="truncate font-medium text-slate-800" title={r.address}>
                        {r.address}
                      </div>
                      <div className="truncate text-xs text-slate-400">{r.code}</div>
                    </td>
                    <td className="truncate px-3 py-2.5 text-slate-700" title={r.tenantName || ''}>
                      {r.tenantName || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.contract ? (
                        <div className="truncate text-slate-700" title={r.contract.fileName}>
                          📄 {r.contract.fileName}
                          <span className="ml-1 text-xs text-slate-400">{kb(r.contract.fileSize)}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-amber-600">Sem contrato</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {r.contract?.viewUrl && (
                          <a
                            href={r.contract.viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-[#22558c] hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </a>
                        )}
                        {r.contract?.downloadUrl && (
                          <a
                            href={r.contract.downloadUrl}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            <Download className="h-3.5 w-3.5" /> Baixar
                          </a>
                        )}
                        <button
                          onClick={() => pickFile(r.propertyId)}
                          disabled={busyId === r.propertyId}
                          className="inline-flex items-center gap-1 rounded-md bg-[#22558c] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {busyId === r.propertyId ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {r.contract ? 'Substituir' : 'Upload'}
                        </button>
                        {r.contract && (
                          <button
                            onClick={() => void del(r.propertyId)}
                            disabled={busyId === r.propertyId}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && !loading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-slate-400">
                      Nenhuma casa encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
