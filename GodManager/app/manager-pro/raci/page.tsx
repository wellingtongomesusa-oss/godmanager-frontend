'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';

const LS_KEY = 'manager_pro_raci_v1';
const LS_PERIOD = 'manager_pro_raci_period';
const autoKey = (id: string) => `raci_automate_${id}`;

export type Periodo = 'Diário' | 'Mensal' | 'Demanda';

type RaciRow = {
  id: string;
  processo: string;
  detalhe: string;
  tools: string;
  consultado: string;
  informado: string;
  periodo: Periodo | '';
  links: { name: string; url: string }[];
  automate: boolean;
  approval: '' | 'approved' | 'declined' | 'review';
  edited?: boolean;
};

function parseLinksCell(raw: string | undefined): { name: string; url: string }[] {
  if (!raw?.trim()) return [];
  const s = raw.trim();
  if (s.startsWith('[')) {
    try {
      const j = JSON.parse(s) as { name?: string; url?: string }[];
      return Array.isArray(j) ? j.filter((x) => x?.url).map((x) => ({ name: x.name || 'Link', url: x.url! })) : [];
    } catch {
      /* fallthrough */
    }
  }
  return s.split(';').map((part) => {
    const [name, url] = part.split('|').map((x) => x.trim());
    return name && url ? { name, url } : null;
  }).filter(Boolean) as { name: string; url: string }[];
}

function rowFromCsv(row: Record<string, string>, i: number): RaciRow {
  const id = `raci-${String(i + 1).padStart(3, '0')}`;
  const p = (row.Período || row.periodo || row.Periodo || '').trim() as Periodo | '';
  const periodo: Periodo | '' =
    p === 'Diário' || p === 'Mensal' || p === 'Demanda' ? p : '';
  const autoRaw = (row.Automatizar || row.automatizar || '').toLowerCase();
  const automateFromCsv = autoRaw === 'sim' || autoRaw === 's' || autoRaw === 'yes' || autoRaw === '1';
  let automate = automateFromCsv;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(autoKey(id));
    if (stored === '1') automate = true;
    if (stored === '0') automate = false;
  }
  return {
    id,
    processo: row.Processo || row.processo || `Processo ${i + 1}`,
    detalhe: row.Detalhe || row.detalhe || '',
    tools: row.Tools || row.tools || '',
    consultado: row.Consultado || row.consultado || '',
    informado: row.Informado || row.informado || '',
    periodo,
    links: parseLinksCell(row.Links || row.links),
    automate,
    approval: '',
    edited: false,
  };
}

export default function RaciPage() {
  const [rows, setRows] = useState<RaciRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [period, setPeriod] = useState<Periodo>('Mensal');
  const [search, setSearch] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [rowForLink, setRowForLink] = useState<string | null>(null);

  const applyAutomateLs = useCallback((list: RaciRow[]) => {
    if (typeof window === 'undefined') return list;
    return list.map((r) => {
      const s = localStorage.getItem(autoKey(r.id));
      if (s === '1') return { ...r, automate: true };
      if (s === '0') return { ...r, automate: false };
      return r;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as RaciRow[];
          if (!cancelled && Array.isArray(parsed) && parsed.length) {
            setRows(applyAutomateLs(parsed));
            const p = localStorage.getItem(LS_PERIOD) as Periodo | null;
            if (p && ['Diário', 'Mensal', 'Demanda'].includes(p)) setPeriod(p);
            setHydrated(true);
            return;
          }
        }
        const res = await fetch('/RACI_FINANCEIRO.csv');
        const text = await res.text();
        if (cancelled) return;
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const data = res.data as Record<string, string>[];
            const next = data.map((row, i) => rowFromCsv(row, i));
            setRows(next.length ? applyAutomateLs(next) : []);
          },
        });
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyAutomateLs]);

  useEffect(() => {
    const t = setInterval(() => {
      try {
        if (!rows.length) return;
        localStorage.setItem(LS_KEY, JSON.stringify(rows));
        localStorage.setItem(LS_PERIOD, period);
      } catch {
        /* quota */
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [rows, period]);

  const saveNow = () => {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
    localStorage.setItem(LS_PERIOD, period);
    alert('Salvo no navegador.');
  };

  const exportCsv = () => {
    const cols = [
      'Processo',
      'Detalhe',
      'Tools',
      'Consultado',
      'Informado',
      'Período',
      'Automatizar',
      'Links',
      'StatusAprovacao',
    ];
    const lines = [
      cols.join(','),
      ...rows.map((r) => {
        const links = r.links.map((l) => `${l.name}|${l.url}`).join(';');
        const vals = [
          r.processo,
          r.detalhe,
          r.tools,
          r.consultado,
          r.informado,
          r.periodo || '',
          r.automate ? 'SIM' : 'NÃO',
          links,
          r.approval,
        ];
        return vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'RACI_FINANCEIRO_export.csv';
    a.click();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data as Record<string, string>[];
        const next = data.map((row, i) => rowFromCsv(row, i));
        setRows(applyAutomateLs(next));
        e.target.value = '';
      },
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      const matchPeriod = !r.periodo || r.periodo === period;
      if (!matchPeriod) return false;
      if (!q) return true;
      const blob = [
        r.processo,
        r.detalhe,
        r.tools,
        r.consultado,
        r.informado,
        ...r.links.map((l) => `${l.name} ${l.url}`),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, period, search]);

  const setField = (id: string, field: keyof RaciRow, value: string | boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value, edited: true } : r))
    );
  };

  const toggleAutomate = (id: string, current: boolean) => {
    const next = !current;
    localStorage.setItem(autoKey(id), next ? '1' : '0');
    setField(id, 'automate', next);
  };

  const resetRow = (id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, approval: '', edited: false } : r
      )
    );
  };

  const addLink = (id: string) => {
    if (!linkName.trim() || !linkUrl.trim()) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              links: [...r.links, { name: linkName.trim(), url: linkUrl.trim() }],
              edited: true,
            }
          : r
      )
    );
    setLinkName('');
    setLinkUrl('');
    setRowForLink(null);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm" style={{ color: '#6b5c48' }}>
        Carregando RACI…
      </div>
    );
  }

  return (
    <div className="min-h-screen rounded-xl pb-8" style={{ background: '#fdf6ee', color: '#2c1f12' }}>
      {/* Header sticky — badge MVH · exportação à direita */}
      <header
        className="sticky top-0 z-[30] mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#e2d9cc] px-1 py-3 shadow-sm"
        style={{ background: 'rgba(253, 246, 238, 0.98)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="shrink-0 rounded px-2 py-1 text-[10px] font-bold tracking-wide"
            style={{ background: 'rgba(181, 96, 26, 0.18)', color: '#b5601a' }}
          >
            MVH
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-[#2c1f12]">RACI Financeiro</h1>
            <p className="text-[11px] text-[#6b5c48]">
              45 processos MVH/HOPM · auto-save 60s · localStorage
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="cursor-pointer rounded-lg border border-[#b5601a] px-3 py-2 text-xs font-semibold text-[#b5601a] hover:bg-[#b5601a]/10">
            Upload CSV
            <input type="file" accept=".csv" className="hidden" onChange={onFile} />
          </label>
          <a
            href="/RACI_FINANCEIRO.csv"
            download
            className="rounded-lg border border-[#e2d9cc] bg-white px-3 py-2 text-xs font-semibold text-[#2c1f12] hover:bg-[#faf7f2]"
          >
            Modelo 45
          </a>
          <button
            type="button"
            onClick={saveNow}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: '#b5601a' }}
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border-2 px-3 py-2 text-xs font-semibold"
            style={{ borderColor: '#b5601a', color: '#b5601a' }}
          >
            Exportar CSV
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9e8e7c]">Período</span>
        {(['Diário', 'Mensal', 'Demanda'] as Periodo[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              period === p ? 'text-white shadow-sm' : 'bg-white/90 text-[#2c1f12] ring-1 ring-[#e2d9cc]'
            }`}
            style={period === p ? { background: '#b5601a' } : undefined}
          >
            {p}
          </button>
        ))}
        <input
          placeholder="Buscar texto (processo, campos, links)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto min-w-[200px] flex-1 rounded-lg border border-[#e2d9cc] bg-white px-3 py-2 text-sm text-[#2c1f12] placeholder:text-[#9e8e7c] sm:max-w-md"
        />
        <span className="text-xs text-[#6b5c48]">
          {filtered.length}/{rows.length} linhas
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#e2d9cc] bg-white shadow-sm">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#e2d9cc] bg-[#f4efe6] text-xs uppercase tracking-wide text-[#6b5c48]">
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Processo</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Detalhe</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Tools</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Consultado</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Informado</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Automatizar</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Links</th>
              <th className="sticky top-0 z-10 bg-[#f4efe6] p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-t border-[#e2d9cc] transition-colors hover:bg-[#fdf5e8]"
                style={
                  r.edited
                    ? { boxShadow: 'inset 3px 0 0 0 #16a34a' }
                    : undefined
                }
              >
                <td className="p-2">
                  <div className="flex items-start gap-2">
                    {r.edited && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-green-600"
                        title="Editado"
                        aria-hidden
                      />
                    )}
                    <span className="font-medium leading-snug">{r.processo}</span>
                  </div>
                </td>
                <td className="p-1">
                  <input
                    className="w-full min-w-[120px] rounded border border-transparent bg-transparent px-1 py-1.5 text-xs text-[#2c1f12] hover:border-[#e2d9cc] focus:border-[#b5601a] focus:outline-none"
                    value={r.detalhe}
                    onChange={(e) => setField(r.id, 'detalhe', e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full min-w-[100px] rounded border border-transparent px-1 py-1.5 text-xs focus:border-[#b5601a] focus:outline-none"
                    value={r.tools}
                    onChange={(e) => setField(r.id, 'tools', e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full min-w-[100px] rounded border border-transparent px-1 py-1.5 text-xs focus:border-[#b5601a] focus:outline-none"
                    value={r.consultado}
                    onChange={(e) => setField(r.id, 'consultado', e.target.value)}
                  />
                </td>
                <td className="p-1">
                  <input
                    className="w-full min-w-[100px] rounded border border-transparent px-1 py-1.5 text-xs focus:border-[#b5601a] focus:outline-none"
                    value={r.informado}
                    onChange={(e) => setField(r.id, 'informado', e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => toggleAutomate(r.id, r.automate)}
                    className="rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{
                      background: r.automate ? 'rgba(181, 96, 26, 0.2)' : '#f4efe6',
                      color: '#b5601a',
                    }}
                  >
                    {r.automate ? 'SIM' : 'NÃO'}
                  </button>
                </td>
                <td className="p-2 align-top text-xs">
                  <div className="max-w-[200px] space-y-1">
                    {r.links.map((l, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1">
                        <a
                          href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                          className="font-medium text-[#22558c] underline underline-offset-2"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {l.name || 'Abrir'}
                        </a>
                        <button
                          type="button"
                          className="text-[11px] text-[#b83030] hover:underline"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x.id === r.id
                                  ? { ...x, links: x.links.filter((_, j) => j !== i), edited: true }
                                  : x
                              )
                            )
                          }
                          title="Remover"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {rowForLink === r.id ? (
                      <div className="mt-1 flex flex-col gap-1 rounded border border-[#e2d9cc] bg-[#fffdf9] p-2">
                        <input
                          placeholder="Nome do link"
                          value={linkName}
                          onChange={(e) => setLinkName(e.target.value)}
                          className="rounded border border-[#e2d9cc] px-1 py-1 text-xs"
                        />
                        <input
                          placeholder="https://…"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          className="rounded border border-[#e2d9cc] px-1 py-1 text-xs"
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => addLink(r.id)}
                            className="text-xs font-semibold text-[#2d7252]"
                          >
                            Adicionar
                          </button>
                          <button type="button" onClick={() => setRowForLink(null)} className="text-xs text-[#6b5c48]">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#22558c] hover:underline"
                        onClick={() => setRowForLink(r.id)}
                      >
                        + Link
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-2 align-top">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap gap-1">
                      {(['approved', 'declined', 'review'] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() =>
                            setField(r.id, 'approval', r.approval === a ? ('' as const) : a)
                          }
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            r.approval === a ? 'bg-[#2c1f12] text-white' : 'bg-[#f4efe6] text-[#2c1f12]'
                          }`}
                        >
                          {a === 'approved' ? 'Aprovar' : a === 'declined' ? 'Recusar' : 'Rever'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => resetRow(r.id)}
                      className="self-start text-[10px] font-medium text-[#9e8e7c] underline hover:text-[#b5601a]"
                    >
                      Reset aprovação
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="mt-6 text-center text-sm text-[#6b5c48]">
          Nenhum dado. Use <strong>Upload CSV</strong> ou o arquivo modelo <strong>RACI_FINANCEIRO.csv</strong> na pasta{' '}
          <code className="rounded bg-white px-1">public</code>.
        </p>
      )}
    </div>
  );
}
