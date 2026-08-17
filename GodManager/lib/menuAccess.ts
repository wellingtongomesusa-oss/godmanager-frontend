/**
 * Menu access keys — espelho de GM_MENU_ACCESS_SECTIONS em GodManager_Premium.html.
 * Fase 2 Passo 1: definições puras; enforcement nas rotas virá depois.
 *
 * Semântica (alinhada ao frontend F1.B):
 * - menuAccess vazio => sem restrição (role-only).
 * - super_admin => bypass total.
 */

export type MenuAccessSectionDef = {
  sectionKey: string;
  itemKeys: string[];
};

export type MenuAccessUser = {
  role?: string | null;
  menuAccess?: string[] | null;
};

/** Espelho fiel de GM_MENU_ACCESS_SECTIONS (~L8600 GodManager_Premium.html). */
export const MENU_ACCESS_SECTIONS: MenuAccessSectionDef[] = [
  {
    sectionKey: 'home',
    itemKeys: ['home', 'longterm'],
  },
  {
    sectionKey: 'communications',
    itemKeys: ['news'],
  },
  {
    sectionKey: 'properties',
    itemKeys: [
      'ltproperties',
      'owner-statement',
      'statement-individual',
      'tenants',
      'leases-history',
      'properties',
      'renovations',
    ],
  },
  {
    sectionKey: 'expenses',
    itemKeys: ['ltexpenses', 'ltcleanings', 'vendors', 'jobs', 'jobs-follow'],
  },
  {
    sectionKey: 'billing',
    itemKeys: ['billing', 'delinquency', 'billing-inbox'],
  },
  {
    sectionKey: 'ownerportal',
    itemKeys: [
      'ownerportal',
      'ltownerpay',
      'owner-statement-detail',
      'owner-audit',
      'listings',
    ],
  },
  {
    sectionKey: 'tenantsgrp',
    itemKeys: ['tenantportal', 'listings-tenants'],
  },
  {
    sectionKey: 'compliance',
    itemKeys: ['licenses', '1099', 'gaap'],
  },
  {
    sectionKey: 'operations',
    itemKeys: ['phonelines', 'vault', 'cars', 'inspections', 'tasks'],
  },
  {
    sectionKey: 'integrations',
    itemKeys: ['integrations', 'ramp', 'quickbooks', 'ap-ar', 'appfolio-upload'],
  },
  {
    sectionKey: 'results',
    itemKeys: ['results', 'results-upload', 'bookkeeping', 'gaap-results'],
  },
  {
    sectionKey: 'dbpr',
    itemKeys: ['dbpr-audit'],
  },
  {
    sectionKey: 'ai-assistant',
    itemKeys: ['bookkeeping-ai', 'analytics', 'auditoria-2026'],
  },
  {
    sectionKey: 'admin',
    itemKeys: [
      'admin-dashboard',
      'clients',
      'admin-users',
      'backup',
      'settings-gm',
      'gross-expenses',
      'forms-received',
      'admin-audit',
      'org-chart',
    ],
  },
  {
    sectionKey: 'mycompany',
    itemKeys: ['client-users', 'audit-log-tenant', 'settings-co'],
  },
];

const sectionByItemKey = buildSectionByItemKeyMap();

function buildSectionByItemKeyMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const sec of MENU_ACCESS_SECTIONS) {
    for (const itemKey of sec.itemKeys) {
      map.set(itemKey, sec.sectionKey);
    }
  }
  return map;
}

export function resolveUserMenuAccess(user: MenuAccessUser | null | undefined): {
  isSuperAdmin: boolean;
  access: string[];
} {
  const isSuperAdmin = user?.role === 'super_admin';
  const access = Array.isArray(user?.menuAccess) ? user.menuAccess.map(String) : [];
  return { isSuperAdmin, access };
}

/**
 * Verifica se uma chave de secao OU de item esta permitida em menuAccess.
 * Hide-only no frontend; aqui e a contrapartida para enforcement futuro.
 */
export function isMenuAccessAllowed(
  user: MenuAccessUser | null | undefined,
  sectionKey: string,
): boolean {
  const { isSuperAdmin, access } = resolveUserMenuAccess(user);
  if (isSuperAdmin) return true;
  if (access.length === 0) return true;

  const allowSet = new Set(access);
  const key = String(sectionKey);

  if (allowSet.has(key)) return true;

  const parentSection = sectionByItemKey.get(key);
  if (parentSection && allowSet.has(parentSection)) return true;

  const sectionDef = MENU_ACCESS_SECTIONS.find((s) => s.sectionKey === key);
  if (sectionDef) {
    for (const itemKey of sectionDef.itemKeys) {
      if (allowSet.has(itemKey)) return true;
    }
  }

  return false;
}
