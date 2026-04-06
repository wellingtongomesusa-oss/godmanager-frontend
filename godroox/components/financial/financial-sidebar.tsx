'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

export const FINANCIAL_NAV_ITEMS = [
  { href: '/financial', label: 'Dashboard Financeiro', icon: '📊' },
  { href: '/financial/gaap', label: 'GAAP Financials', icon: '📋' },
  { href: '/financial/ap', label: 'AP – Contas a Pagar', icon: '💳' },
  { href: '/financial/ar', label: 'AR – Contas a Receber', icon: '📥' },
  { href: '/financial/month-end-close', label: 'Fechamento Contábil', icon: '📅' },
  { href: '/financial/journal-entries', label: 'Lançamentos Contábeis', icon: '📝' },
  { href: '/financial/reconciliations', label: 'Reconciliações', icon: '🏦' },
  { href: '/financial/sox-404', label: 'SOX 404 & IPO Readiness', icon: '✅' },
  { href: '/financial/icfr', label: 'ICFR Controls (COSO 2013)', icon: '🛡️' },
  { href: '/financial/control-tests', label: 'Testes de Controles', icon: '🔬' },
  { href: '/financial/audit-trail', label: 'Trilha de Auditoria', icon: '📜' },
  { href: '/financial/deficiencies', label: 'Deficiências e Remediações', icon: '⚠️' },
  { href: '/financial/reports', label: 'Relatórios Financeiros', icon: '📈' },
  { href: '/financial/sox-reports', label: 'Relatórios SOX / ICFR / IPO', icon: '📑' },
  { href: '/financial/integrations', label: 'Integrações Financeiras', icon: '🔌' },
  { href: '/financial/settings', label: 'Configurações e Permissões', icon: '⚙️' },
];

export function FinancialSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 border-r border-secondary-200 bg-white shadow-sm overflow-y-auto">
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-secondary-200 px-6">
          <Logo size="sm" />
          <div>
            <span className="text-lg font-semibold text-secondary-900 block">
              Financial Dashboard
            </span>
            <span className="text-xs text-secondary-500">GAAP • SOX 404 • ICFR • IPO</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-4">
          {FINANCIAL_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/financial' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900'
                )}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-secondary-200 p-4">
          <p className="text-xs text-secondary-500">
            © Godroox Financial • GAAP • PCAOB • SEC
          </p>
        </div>
      </div>
    </aside>
  );
}
