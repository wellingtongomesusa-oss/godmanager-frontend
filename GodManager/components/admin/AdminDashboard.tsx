'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Home,
  UserCheck,
  Wrench,
  Briefcase,
  DollarSign,
  TrendingUp,
  Settings,
  Shield,
  FileText,
  Mail,
  Banknote,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

type Kpis = {
  ok: boolean;
  clients: { total: number; active: number; suspended: number; newLast30Days: number };
  users: {
    total: number;
    active: number;
    suspended: number;
    byType: { staff: number; tenant: number; owner: number; vendor: number };
  };
  portfolio: { totalProperties: number; totalTenants: number; totalVendors: number; totalJobs: number };
  financials: {
    yearMonth: string;
    expensesCurrentMonth: number;
    rentCurrentMonth: number;
    netOwnerCurrentMonth: number;
    mrrEstimated: number;
  };
  updatedAt: string;
};

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
const num = (n: number) => (n || 0).toLocaleString('pt-BR');

const SECTIONS = [
  { href: '/admin/users', label: 'Usuários', desc: 'Criar, editar e remover usuários', icon: Users },
  { href: '/admin/roles', label: 'Papéis & Permissões', desc: 'Controle de acesso por perfil', icon: Shield },
  { href: '/admin/transfers', label: 'Transferências ACH', desc: 'Débito e crédito via Plaid Transfer', icon: Banknote },
  { href: '/admin/settings', label: 'Configurações', desc: 'Ajustes globais do sistema', icon: Settings },
  { href: '/admin/audit', label: 'Auditoria', desc: 'Log de ações administrativas', icon: FileText },
  { href: '/admin/demo-leads', label: 'Demo Leads', desc: 'Solicitações de demonstração', icon: Mail },
  { href: '/admin/contact-leads', label: 'Contact Leads', desc: 'Contatos recebidos', icon: Mail },
];

export function AdminDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/dashboard/kpis', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (d && d.ok) setKpis(d as Kpis);
        else setError(d?.error || 'Falha ao carregar indicadores.');
      })
      .catch(() => setError('Erro de rede ao carregar indicadores.'))
      .finally(() => setLoading(false));
  }, []);

  if (user && String(user.role).toLowerCase() !== 'super_admin') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-slate-500">
        Acesso restrito ao super administrador da plataforma.
      </div>
    );
  }

  const kpiCards = kpis
    ? [
        { label: 'Clientes', value: num(kpis.clients.total), sub: `${num(kpis.clients.active)} ativos`, icon: Building2, color: 'text-blue-600 bg-blue-50' },
        { label: 'Usuários', value: num(kpis.users.total), sub: `${num(kpis.users.active)} ativos`, icon: Users, color: 'text-violet-600 bg-violet-50' },
        { label: 'Properties', value: num(kpis.portfolio.totalProperties), sub: 'imóveis', icon: Home, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Tenants', value: num(kpis.portfolio.totalTenants), sub: 'inquilinos', icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
        { label: 'Vendors', value: num(kpis.portfolio.totalVendors), sub: 'fornecedores', icon: Wrench, color: 'text-slate-600 bg-slate-100' },
        { label: 'Jobs', value: num(kpis.portfolio.totalJobs), sub: 'ações registradas', icon: Briefcase, color: 'text-rose-600 bg-rose-50' },
      ]
    : [];

  const loginTypeCards = kpis
    ? [
        { label: 'Equipe / Staff', value: num(kpis.users.byType.staff), sub: 'admin, supervisor, manutenção', icon: Shield, color: 'text-slate-700 bg-slate-100' },
        { label: 'Inquilinos', value: num(kpis.users.byType.tenant), sub: 'login tenant', icon: UserCheck, color: 'text-amber-600 bg-amber-50' },
        { label: 'Proprietários', value: num(kpis.users.byType.owner), sub: 'login owner', icon: Home, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Fornecedores', value: num(kpis.users.byType.vendor), sub: 'login vendor', icon: Wrench, color: 'text-blue-600 bg-blue-50' },
      ]
    : [];

  const financeCards = kpis
    ? [
        { label: 'Rent (mês)', value: money(kpis.financials.rentCurrentMonth), color: 'text-emerald-600' },
        { label: 'Despesas (mês)', value: money(kpis.financials.expensesCurrentMonth), color: 'text-rose-600' },
        { label: 'Net Owner (mês)', value: money(kpis.financials.netOwnerCurrentMonth), color: 'text-blue-600' },
        { label: 'MRR estimado', value: money(kpis.financials.mrrEstimated), color: 'text-violet-600' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Painel Administrativo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Controle total do GodManager
          {kpis ? ` · atualizado ${new Date(kpis.updatedAt).toLocaleString('pt-BR')}` : ''}
        </p>
      </header>

      {loading && <div className="py-10 text-center text-slate-400">Carregando indicadores…</div>}
      {error && <div className="mb-6 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {kpis && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {kpiCards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="mt-3 text-2xl font-bold text-slate-900">{c.value}</div>
                  <div className="text-xs font-medium text-slate-500">{c.label}</div>
                  <div className="text-[11px] text-slate-400">{c.sub}</div>
                </div>
              );
            })}
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Logins por tipo ({num(kpis.users.total)} no total)
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {loginTypeCards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="mt-3 text-2xl font-bold text-slate-900">{c.value}</div>
                  <div className="text-xs font-medium text-slate-500">{c.label}</div>
                  <div className="text-[11px] text-slate-400">{c.sub}</div>
                </div>
              );
            })}
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Financeiro ({kpis.financials.yearMonth})
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {financeCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <DollarSign size={14} className={c.color} />
                  {c.label}
                </div>
                <div className={`mt-2 text-xl font-bold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wide text-slate-400">Gestão</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                <Icon size={20} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{s.label}</div>
                <div className="text-xs text-slate-500">{s.desc}</div>
              </div>
              <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
