'use client';

import { useCallback, useMemo, useState } from 'react';
import Papa from 'papaparse';
import {
  cell,
  countUnitDirectoryRows,
  isPrimaryTenant,
  matchesTenantFilter,
  parseMoney,
  pastDueByUnit,
  sumPastDueFromRentRoll,
  tenantStatus,
  unitKey,
  type TenantFilter,
} from '@/lib/manager-pro/rentRollMerge';

const LS_PREFIX = 'rent_roll_approval_v1_';

type Approval = '' | 'approved' | 'declined' | 'review';

type MergedRow = {
  id: string;
  unitRaw: string;
  ukey: string;
  address: string;
  city: string;
  tenant: string;
  phone: string;
  statusRaw: string;
  statusNorm: string;
  bdBa: string;
  moveIn: string;
  leaseFrom: string;
  leaseTo: string;
  marketRent: number;
  monthlyRent: number;
  deposit: number;
  pastDue: number;
  nsf: boolean;
  late: boolean;
};

function loadApproval(id: string): Approval {
  if (typeof window === 'undefined') return '';
  const v = localStorage.getItem(LS_PREFIX + id);
  if (v === 'approved' || v === 'declined' || v === 'review') return v;
  return '';
}

function saveApproval(id: string, a: Approval) {
  if (a) localStorage.setItem(LS_PREFIX + id, a);
  else localStorage.removeItem(LS_PREFIX + id);
}

function strictCurrent(statusNorm: string): boolean {
  const x = statusNorm.toLowerCase();
  if (x.includes('notice')) return false;
  if (x.includes('past')) return false;
  return x.includes('current');
}

function mergeTenants(
  tenantRows: Record<string, string>[],
  pastDueMap: Map<string, number>
): MergedRow[] {
  const out: MergedRow[] = [];
  let i = 0;
  for (const r of tenantRows) {
    if (!isPrimaryTenant(r)) continue;
    const unitRaw = cell(r, 'Unit', 'unit', 'Property Unit', 'Unit Name');
    const ukey = unitKey(unitRaw);
    const statusRaw = cell(r, 'Status', 'status', 'Tenant Status');
    const statusNorm = statusRaw.toLowerCase();
    const first = cell(r, 'First Name', 'First', 'first_name', 'Tenant First Name');
    const last = cell(r, 'Last Name', 'Last', 'last_name', 'Tenant Last Name');
    const tenant = [first, last].filter(Boolean).join(' ') || cell(r, 'Tenant', 'tenant', 'Name');
    const phone = cell(r, 'Phone', 'phone', 'Mobile', 'Cell', 'Telephone');
    const addr = cell(r, 'Address', 'address', 'Street', 'Property Address');
    const city = cell(r, 'City', 'city', 'Town');
    const bd = cell(r, 'BD', 'Bedrooms', 'Beds', '# Bed');
    const ba = cell(r, 'BA', 'Bathrooms', 'Baths', '# Bath');
    const bdBa = bd || ba ? `${bd || '—'}/${ba || '—'}` : cell(r, 'BD/BA', 'Beds/Baths', 'Bed/Bath') || '—';
    const nsf =
      /yes|true|1|x/i.test(cell(r, 'NSF', 'nsf', 'NSF Flag')) ||
      cell(r, 'NSF', 'nsf').toUpperCase() === 'X';
    const late =
      /yes|true|1|x/i.test(cell(r, 'Late', 'late', 'Late Flag')) ||
      cell(r, 'Late', 'late').toUpperCase() === 'X';

    const idRaw = `${ukey}|${phone.replace(/\D/g, '')}|${tenant}`.replace(/\s/g, '_');
    const id = idRaw.length > 8 ? idRaw.slice(0, 96) : `rr-${i}`;
    i++;

    /** Past Due só do rent_roll, chave = unitKey(td.Unit) === rr_unit_short */
    const pastDue = pastDueMap.get(ukey) ?? 0;

    out.push({
      id,
      unitRaw,
      ukey,
      address: addr || unitRaw.split(' - ')[0]?.trim() || unitRaw,
      city: city || (unitRaw.includes(' - ') ? unitRaw.split(' - ').slice(1).join(' - ').trim() : ''),
      tenant,
      phone,
      statusRaw: statusRaw || '—',
      statusNorm,
      bdBa,
      moveIn: cell(r, 'Move-in', 'Move In', 'move_in', 'MoveIn'),
      leaseFrom: cell(r, 'Lease From', 'Lease Start', 'lease_from', 'Start'),
      leaseTo: cell(r, 'Lease To', 'Lease End', 'lease_to', 'End'),
      marketRent: parseMoney(cell(r, 'Market Rent', 'market_rent', 'Market')),
      monthlyRent: parseMoney(cell(r, 'Monthly Rent', 'monthly_rent', 'Rent')),
      deposit: parseMoney(cell(r, 'Security Deposit', 'Deposit', 'security_deposit', 'SD')),
      pastDue,
      nsf,
      late,
    });
  }
  return out;
}

/** Referência: unit_directory limpo 90 · primary Cur+Notice 68 · aluguel/deposit só Current */
const DEMO_KPIS = {
  totalUnits: 90,
  rented: 68,
  vacant: 22,
  monthly: 160259,
  deposit: 183550,
  pastDue: 17202,
};

const DEMO_ROWS: MergedRow[] = [
  {
    id: 'demo-1',
    unitRaw: '4512 Storey Lake - Kissimmee',
    ukey: '4512 storeylake',
    address: '4512 Storey Lake Dr',
    city: 'Kissimmee',
    tenant: 'Jane Smith',
    phone: '(407) 555-0101',
    statusRaw: 'Current',
    statusNorm: 'current',
    bdBa: '5/4',
    moveIn: '2024-06-01',
    leaseFrom: '2024-06-01',
    leaseTo: '2025-05-31',
    marketRent: 5200,
    monthlyRent: 4850,
    deposit: 4850,
    pastDue: 0,
    nsf: false,
    late: false,
  },
  {
    id: 'demo-2',
    unitRaw: '8820 Champions Gate - Davenport',
    ukey: '8820 champions',
    address: '8820 Palm Pkwy',
    city: 'Davenport',
    tenant: 'John Doe',
    phone: '(863) 555-0199',
    statusRaw: 'Notice',
    statusNorm: 'notice',
    bdBa: '4/3',
    moveIn: '2023-01-15',
    leaseFrom: '2023-01-15',
    leaseTo: '2026-01-14',
    marketRent: 3800,
    monthlyRent: 3600,
    deposit: 3600,
    pastDue: 1200,
    nsf: false,
    late: true,
  },
  {
    id: 'demo-3',
    unitRaw: '1209 Windsor West - Kissimmee',
    ukey: '1209 windsor',
    address: '1209 Windsor W Loop',
    city: 'Kissimmee',
    tenant: 'Maria Garcia',
    phone: '(321) 555-0144',
    statusRaw: 'Current',
    statusNorm: 'current',
    bdBa: '6/5',
    moveIn: '2025-02-01',
    leaseFrom: '2025-02-01',
    leaseTo: '2026-01-31',
    marketRent: 6200,
    monthlyRent: 5995,
    deposit: 5995,
    pastDue: 5995,
    nsf: true,
    late: true,
  },
];

export default function RentRollPage() {
  const [tenantRows, setTenantRows] = useState<Record<string, string>[]>([]);
  const [unitDirRows, setUnitDirRows] = useState<Record<string, string>[]>([]);
  const [rentRollRows, setRentRollRows] = useState<Record<string, string>[]>([]);
  const [filter, setFilter] = useState<TenantFilter>('all');
  const [search, setSearch] = useState('');
  const [, bump] = useState(0);

  const pastDueMap = useMemo(() => pastDueByUnit(rentRollRows), [rentRollRows]);

  const merged = useMemo(() => {
    if (!tenantRows.length) return DEMO_ROWS;
    return mergeTenants(tenantRows, pastDueMap);
  }, [tenantRows, pastDueMap]);

  const kpis = useMemo(() => {
    if (!tenantRows.length) {
      return { ...DEMO_KPIS, needsUnitDirectory: false };
    }

    const primary = tenantRows.filter(isPrimaryTenant);
    const currentOrNotice = primary.filter((r) => {
      const s = tenantStatus(r);
      return s.includes('current') || s.includes('notice');
    });
    /** Casas alugadas: unidades distintas com primary + Current/Notice (fonte: tenant_directory) */
    const rented = new Set(
      currentOrNotice.map((r) => unitKey(cell(r, 'Unit', 'unit', 'Property Unit', 'Unit Name')))
    ).size;

    /** Total Units: somente unit_directory (linhas limpas) — não usar rent_roll nem property_directory */
    const totalUnits =
      unitDirRows.length > 0 ? countUnitDirectoryRows(unitDirRows) : 0;
    const needsUnitDirectory = unitDirRows.length === 0;
    const vacant = totalUnits > 0 ? Math.max(0, totalUnits - rented) : 0;

    const currentOnly = primary.filter((r) => strictCurrent(tenantStatus(r)));
    const monthly = currentOnly.reduce(
      (s, r) => s + parseMoney(cell(r, 'Monthly Rent', 'monthly_rent', 'Rent')),
      0
    );
    const deposit = currentOnly.reduce(
      (s, r) => s + parseMoney(cell(r, 'Security Deposit', 'Deposit', 'security_deposit')),
      0
    );

    /** Past Due: só rent_roll, 1× por unidade — nunca somar com colunas do tenant_directory */
    const pastDue = sumPastDueFromRentRoll(pastDueMap);

    return { totalUnits, rented, vacant, monthly, deposit, pastDue, needsUnitDirectory };
  }, [tenantRows, unitDirRows, pastDueMap]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return merged.filter((r) => {
      if (!matchesTenantFilter(filter, r.statusNorm, r.pastDue, r.nsf, r.late)) return false;
      if (!q) return true;
      const blob = [
        r.address,
        r.city,
        r.tenant,
        r.phone,
        r.unitRaw,
        r.statusRaw,
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [merged, filter, search]);

  const parseFile = useCallback(
    (f: File, setter: (rows: Record<string, string>[]) => void) => {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => setter((res.data as Record<string, string>[]) || []),
      });
    },
    []
  );

  const setApproval = (id: string, a: Approval) => {
    const cur = loadApproval(id);
    const next = cur === a ? '' : a;
    saveApproval(id, next);
    bump((x) => x + 1);
  };

  const statusPillClass = (s: string) => {
    const x = s.toLowerCase();
    if (x.includes('notice')) return 'bg-amber-100 text-amber-900 ring-amber-200';
    if (x.includes('current')) return 'bg-emerald-100 text-emerald-900 ring-emerald-200';
    if (x.includes('past')) return 'bg-red-100 text-red-800 ring-red-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
  };

  const FILTERS: { key: TenantFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'current', label: 'Current' },
    { key: 'past_due', label: 'Past Due' },
    { key: 'notice', label: 'Notice' },
    { key: 'nsf_late', label: 'NSF/Late' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--ink)]">Long Term</h1>
        <p className="text-xs font-medium text-[var(--ink3)]">Rent Roll · dashboard operacional</p>
        <p className="mt-2 text-sm text-[var(--ink2)]">
          <strong>Fonte primária:</strong> tenant_directory (Primary Tenant = Yes).{' '}
          <strong>Past Due:</strong> só rent_roll, chave td.Unit = parte antes de &quot; - &quot; no RR.{' '}
          <strong>Total Units:</strong> unit_directory — Unit Name sem -&gt; e sem linha Total.
        </p>
      </div>

      {tenantRows.length > 0 && kpis.needsUnitDirectory && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Envie <strong>unit_directory.csv</strong> para exibir <strong>Total Units</strong> e <strong>Vacant</strong>{' '}
          corretos (ex.: 90 unidades). Sem esse arquivo, Total Units = 0 no painel.
        </div>
      )}

      <div className="flex flex-wrap gap-4 rounded-lg border border-[var(--border)] bg-[var(--cream)] p-4">
        <label className="flex cursor-pointer flex-col gap-1 text-xs font-medium text-[var(--ink2)]">
          1. tenant_directory.csv
          <input
            type="file"
            accept=".csv"
            className="text-[11px]"
            onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0], setTenantRows)}
          />
        </label>
        <label className="flex cursor-pointer flex-col gap-1 text-xs font-medium text-[var(--ink2)]">
          2. unit_directory.csv
          <input
            type="file"
            accept=".csv"
            className="text-[11px]"
            onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0], setUnitDirRows)}
          />
        </label>
        <label className="flex cursor-pointer flex-col gap-1 text-xs font-medium text-[var(--ink2)]">
          3. rent_roll.csv
          <input
            type="file"
            accept=".csv"
            className="text-[11px]"
            onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0], setRentRollRows)}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {(
          [
            {
              label: 'Total Units',
              value: 'needsUnitDirectory' in kpis && kpis.needsUnitDirectory ? '—' : kpis.totalUnits,
              money: false,
              hint: 'Unit Name sem -> · exclui Total',
            },
            {
              label: 'Rented',
              value: kpis.rented,
              money: false,
              hint: 'Current + Notice · Primary Tenant = Yes · unique units',
            },
            {
              label: 'Vacant',
              value: 'needsUnitDirectory' in kpis && kpis.needsUnitDirectory ? '—' : kpis.vacant,
              money: false,
              hint: 'Total Units − Rented',
            },
            { label: 'Monthly Rent', value: kpis.monthly, money: true, hint: 'primary · Current only' },
            { label: 'Security Dep.', value: kpis.deposit, money: true, hint: 'primary · Current only' },
            {
              label: 'Past Due',
              value: kpis.pastDue,
              money: true,
              hint: 'só rent_roll · 1× por rr_unit_short (sem dup.)',
            },
          ] as const
        ).map((k) => (
          <div key={k.label} className="mp-card p-4" style={{ ['--bar-color' as string]: 'var(--amber)' }}>
            <p className="mp-label">{k.label}</p>
            <p className="mp-value mt-1">
              {k.money ? `$${Number(k.value).toLocaleString()}` : k.value}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-[var(--ink3)]">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase text-[var(--ink3)]">Filtros</span>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
              filter === key
                ? 'bg-[var(--ink)] text-white ring-[var(--ink)]'
                : 'bg-[var(--paper)] text-[var(--ink2)] ring-[var(--border)] hover:bg-[var(--cream)]'
            }`}
          >
            {label}
          </button>
        ))}
        <input
          type="search"
          placeholder="Busca: endereço, cidade, inquilino, telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm sm:max-w-md"
        />
        <span className="text-xs text-[var(--ink3)]">
          {filteredRows.length} / {merged.length}
        </span>
      </div>

      <div className="mp-table-wrap">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left">Endereço / Cidade</th>
              <th className="p-2 text-left">Inquilino / Telefone</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">BD/BA</th>
              <th className="p-2 text-left">Move-in</th>
              <th className="p-2 text-left">Lease</th>
              <th className="p-2 text-right">Mkt Rent</th>
              <th className="p-2 text-right">Monthly</th>
              <th className="p-2 text-right">Deposit</th>
              <th className="p-2 text-left">Past Due / Flags</th>
              <th className="p-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const appr = loadApproval(r.id);
              return (
                <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[#fdf5e8]">
                  <td className="p-2 align-top">
                    <div className="font-medium text-[var(--ink)]">{r.address}</div>
                    <div className="text-xs text-[var(--ink2)]">{r.city}</div>
                  </td>
                  <td className="p-2 align-top">
                    <div className="font-medium">{r.tenant || '—'}</div>
                    <div className="font-mono text-xs text-[var(--ink2)]">{r.phone || '—'}</div>
                  </td>
                  <td className="p-2 align-top">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${statusPillClass(r.statusRaw)}`}>
                      {r.statusRaw}
                    </span>
                  </td>
                  <td className="p-2 align-top font-mono text-xs">{r.bdBa}</td>
                  <td className="p-2 align-top font-mono text-xs">{r.moveIn || '—'}</td>
                  <td className="p-2 align-top font-mono text-xs">
                    {r.leaseFrom || '—'} → {r.leaseTo || '—'}
                  </td>
                  <td className="p-2 align-top text-right font-mono text-xs">${r.marketRent.toLocaleString()}</td>
                  <td className="p-2 align-top text-right font-mono text-xs">${r.monthlyRent.toLocaleString()}</td>
                  <td className="p-2 align-top text-right font-mono text-xs">${r.deposit.toLocaleString()}</td>
                  <td className="p-2 align-top">
                    {r.pastDue > 0 ? (
                      <span className="mb-1 inline-block rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 ring-1 ring-red-200">
                        Past Due ${r.pastDue.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--ink3)]">—</span>
                    )}
                    <div className="mt-1 flex gap-2 text-[10px] font-bold">
                      {r.nsf && <span className="text-red-600">NSF ×</span>}
                      {r.late && <span className="text-amber-700">Late ×</span>}
                      {!r.nsf && !r.late && <span className="font-normal text-[var(--ink3)]">—</span>}
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex flex-col gap-1">
                      {(['approved', 'declined', 'review'] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setApproval(r.id, a)}
                          className={`rounded px-2 py-1 text-left text-[10px] font-semibold ${
                            appr === a ? 'bg-[var(--ink)] text-white' : 'bg-[var(--cream)] text-[var(--ink)]'
                          }`}
                        >
                          {a === 'approved' ? 'Approve' : a === 'declined' ? 'Decline' : 'Review'}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!tenantRows.length && (
        <p className="text-center text-xs text-[var(--ink3)]">
          Demo: 90 unidades (unit_directory) · 68 alugadas · 22 vagas · $160,259 / $183,550 (primary Current) ·
          Past Due $17,202 (rent_roll). Carregue os 3 CSVs.
        </p>
      )}
    </div>
  );
}
