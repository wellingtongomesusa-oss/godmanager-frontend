/**
 * Configuração do menu lateral – dashboard-novo (GodCRM)
 * Regras por plano:
 * - Plano 1: Painel, Cadastro, Novos Projetos (apenas 3 itens)
 * - Plano 2: Plan 1 + Invoice, Juros, Calc, Bills, GAAP, AR/AP, 1099
 * - Plano 3: Todo o menu + Cadastro vira dropdown de departamentos
 */

import type { TranslationKey } from '@/lib/i18n/translations';
import type { PlanLevel } from '@/lib/plans';

export type MenuItemType = 'link' | 'external' | 'action' | 'dropdown';

export interface MenuItem {
  key: string;
  href?: string;
  labelKey: TranslationKey;
  /** 0 = sempre visível, 1/2/3 = plano mínimo */
  minPlan: PlanLevel | 0;
  type: MenuItemType;
  external?: boolean;
  matchPrefix?: string;
  /** Para type=dropdown: chave que indica submenu de departamentos */
  isCadastroDropdown?: boolean;
}

/** Ordem: 1-2-3 fixos (Painel, Cadastro, Novos Projetos). Demais por minPlan. */
export const MENU_ITEMS: MenuItem[] = [
  // Plano 1 – Painel, Cadastro, Novos Projetos, Invoice
  { key: 'painel', href: '/admin/painel', labelKey: 'sidebar.painel', minPlan: 1, type: 'link', matchPrefix: '/admin/painel' },
  { key: 'cadastro', href: '/admin/cadastro', labelKey: 'sidebar.godrooxOpen', minPlan: 1, type: 'link', matchPrefix: '/admin/cadastro', isCadastroDropdown: true },
  { key: 'novos-projetos', href: '/admin/projeto', labelKey: 'sidebar.novosProjetos', minPlan: 1, type: 'link', matchPrefix: '/admin/projeto' },
  { key: 'invoice', href: '/admin/invoices', labelKey: 'sidebar.invoice', minPlan: 1, type: 'link', matchPrefix: '/admin/invoices' },
  // Plano 2 – 6 adicionais + 1099
  { key: 'juros-compostos', href: '/admin/juros-compostos', labelKey: 'sidebar.jurosCompostos', minPlan: 2, type: 'link', matchPrefix: '/admin/juros-compostos' },
  { key: 'calc', labelKey: 'sidebar.calcFinanceira', minPlan: 2, type: 'action' },
  { key: 'bills', href: '/admin/bills/approval', labelKey: 'sidebar.contasPagar', minPlan: 2, type: 'link', matchPrefix: '/admin/bills' },
  { key: 'gaap', href: '/admin/gaap', labelKey: 'sidebar.gaap', minPlan: 2, type: 'link', matchPrefix: '/admin/gaap' },
  { key: 'reports', href: '/admin/reports/ap', labelKey: 'sidebar.arAp', minPlan: 2, type: 'link', matchPrefix: '/admin/reports' },
  { key: '1099', href: '/admin/1099', labelKey: 'sidebar.1099', minPlan: 2, type: 'link', matchPrefix: '/admin/1099' },
  // Plano 3 – demais
  { key: 'tax', href: '/admin/tax', labelKey: 'sidebar.tax', minPlan: 3, type: 'link', matchPrefix: '/admin/tax' },
  { key: 'automation', href: '/admin/automation', labelKey: 'sidebar.automation', minPlan: 3, type: 'link', matchPrefix: '/admin/automation' },
  { key: 'email', href: '/admin/email', labelKey: 'sidebar.caixaEmail', minPlan: 3, type: 'link', matchPrefix: '/admin/email' },
  { key: 'payments', href: '/admin/payments', labelKey: 'sidebar.payments', minPlan: 3, type: 'link', matchPrefix: '/admin/payments' },
  { key: 'payout', href: '/admin/payout', labelKey: 'sidebar.payout', minPlan: 3, type: 'link', matchPrefix: '/admin/payout' },
  { key: 'andamento', href: '/admin/andamento', labelKey: 'sidebar.andamento', minPlan: 3, type: 'link', matchPrefix: '/admin/andamento' },
];

export const GODROOX_MENU_ITEM: MenuItem = {
  key: 'godroox',
  href: typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GODROOX_DASHBOARD_URL
    ? process.env.NEXT_PUBLIC_GODROOX_DASHBOARD_URL
    : 'http://localhost:3001',
  labelKey: 'sidebar.dashboardGodroox',
  minPlan: 1,
  type: 'external',
  external: true,
};

/**
 * Retorna itens do menu permitidos para o plano.
 * Plano 1: minPlan 1; Plano 2: minPlan 1 e 2; Plano 3: todos.
 */
export function getMenuItemsForPlan(plan: PlanLevel): MenuItem[] {
  return MENU_ITEMS.filter((m) => plan >= m.minPlan);
}
