/**
 * Módulo Licenças empresariais — dados demo, paleta warm, links úteis (localStorage)
 */

export const LICENSE_LINKS_STORAGE_KEY = 'godmanager-license-useful-links-v1';

/** Ícone Font Awesome padrão (classe completa) */
export const DEFAULT_LINK_ICON = 'fa-regular fa-circle-question';

export type LicenseUsefulLink = {
  id: string;
  linkTitle: string;
  linkSubtitle: string;
  linkUrl: string;
  linkIcon: string;
};

export type LicenseStatus = 'ativa' | 'pendente' | 'expirada';

export type LicenseRankRow = {
  id: string;
  tipo: string;
  status: LicenseStatus;
  validade: string;
};

/** Paleta warm / semântica */
export const LICENSE_WARM = {
  ativa: '#2d7252',
  pendente: '#c47b28',
  expirada: '#b83030',
  donutEmpty: ['#cbd5e1', '#e2e8f0'] as string[],
  barMuted: '#e2d9cc',
} as const;

/** Participação por categoria (demo alinhado a 712) */
export const DEMO_CATEGORY = {
  ativas: 520,
  pendentes: 120,
  expiradas: 72,
} as const;

export const LICENSE_TOTAL =
  DEMO_CATEGORY.ativas + DEMO_CATEGORY.pendentes + DEMO_CATEGORY.expiradas;

export const EMPTY_STATE_COPY =
  '712 licenças ativas · alertas de vencimento';

export const DEMO_RANKING: LicenseRankRow[] = [
  { id: '1', tipo: 'Alvará municipal', status: 'ativa', validade: '2030-12-31' },
  { id: '2', tipo: 'Licença de ocupação', status: 'ativa', validade: '2028-06-15' },
  { id: '3', tipo: 'Short-term rental', status: 'pendente', validade: '2026-04-01' },
  { id: '4', tipo: 'Fire safety', status: 'ativa', validade: '2027-09-30' },
  { id: '5', tipo: 'Pool / spa county', status: 'expirada', validade: '2025-11-01' },
  { id: '6', tipo: 'Signage permit', status: 'pendente', validade: '2026-02-28' },
  { id: '7', tipo: 'Business tax receipt', status: 'ativa', validade: '2026-09-30' },
  { id: '8', tipo: 'Vacation rental cert.', status: 'ativa', validade: '2029-01-15' },
  { id: '9', tipo: 'Elevator inspection', status: 'pendente', validade: '2026-05-20' },
  { id: '10', tipo: 'Food handler (área comum)', status: 'ativa', validade: '2028-03-10' },
];

function seedLinks(): LicenseUsefulLink[] {
  return [
    {
      id: 'seed-1',
      linkTitle: 'Portal do condado',
      linkSubtitle: 'Consulta de licenças e taxas',
      linkUrl: 'https://example.com/county',
      linkIcon: 'fa-solid fa-building-columns',
    },
    {
      id: 'seed-2',
      linkTitle: 'Calendário de renovações',
      linkSubtitle: 'Planilha interna',
      linkUrl: 'https://example.com/renewals',
      linkIcon: 'fa-regular fa-calendar',
    },
  ];
}

export function loadLicenseLinks(): LicenseUsefulLink[] {
  if (typeof window === 'undefined') return seedLinks();
  try {
    const raw = localStorage.getItem(LICENSE_LINKS_STORAGE_KEY);
    if (!raw) {
      const s = seedLinks();
      localStorage.setItem(LICENSE_LINKS_STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const p = JSON.parse(raw) as LicenseUsefulLink[];
    if (!Array.isArray(p)) return seedLinks();
    if (p.length === 0) return [];
    return p.map((x) => ({
      ...x,
      linkIcon: x.linkIcon?.trim() || DEFAULT_LINK_ICON,
    }));
  } catch {
    return seedLinks();
  }
}

export function saveLicenseLinks(links: LicenseUsefulLink[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LICENSE_LINKS_STORAGE_KEY, JSON.stringify(links));
}

export function createLinkId() {
  return `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
