/**
 * Navegação GodManager.One — hrefs mapeados para rotas existentes + /manager-pro/extra/*
 */
import type { MasterOneStringKey } from './masterOneStrings';

export type NavLeaf = { labelKey: MasterOneStringKey; href: string; subtitleKey?: MasterOneStringKey };
export type NavGroup = { labelKey: MasterOneStringKey; href?: string; children: NavLeaf[] };
export type NavItem = NavLeaf | NavGroup;

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item && Array.isArray((item as NavGroup).children);
}

export const MASTER_ONE_NAV: NavItem[] = [
  { labelKey: 'nav.home', href: '/manager-pro' },
  {
    labelKey: 'nav.news',
    href: '/manager-pro/news',
    subtitleKey: 'nav.newsSubtitle',
  },
  {
    labelKey: 'nav.properties',
    href: '/manager-pro/properties',
    children: [
      { labelKey: 'nav.propertiesAll', href: '/manager-pro/properties' },
      { labelKey: 'nav.owners', href: '/manager-pro/owners' },
      { labelKey: 'nav.dp', href: '/manager-pro/dp' },
      { labelKey: 'nav.dpRanking', href: '/manager-pro/dp-ranking' },
      { labelKey: 'nav.rentRoll', href: '/manager-pro/rent-roll' },
    ],
  },
  { labelKey: 'nav.renovations', href: '/manager-pro/renovations' },
  {
    labelKey: 'nav.cleaners',
    href: '/manager-pro/housekeeper',
    children: [
      { labelKey: 'nav.cleanersMain', href: '/manager-pro/housekeeper' },
      { labelKey: 'nav.raci', href: '/manager-pro/raci' },
    ],
  },
  {
    labelKey: 'nav.contractors',
    href: '/manager-pro/extra/contractors',
    children: [
      { labelKey: 'nav.contractorsMain', href: '/manager-pro/extra/contractors' },
      { labelKey: 'nav.irs1099', href: '/manager-pro/irs1099' },
    ],
  },
  { labelKey: 'nav.loans', href: '/manager-pro/extra/loans' },
  {
    labelKey: 'nav.payroll',
    href: '/manager-pro/extra/payroll',
    children: [
      { labelKey: 'nav.payrollMain', href: '/manager-pro/extra/payroll' },
      { labelKey: 'nav.payouts', href: '/manager-pro/payouts' },
    ],
  },
  {
    labelKey: 'nav.licenses',
    href: '/manager-pro/licenses',
    children: [{ labelKey: 'nav.licensesMain', href: '/manager-pro/licenses' }],
  },
  {
    labelKey: 'nav.stock',
    href: '/manager-pro/extra/stock',
    children: [{ labelKey: 'nav.stockMain', href: '/manager-pro/extra/stock' }],
  },
  { labelKey: 'nav.divvy', href: '/manager-pro/extra/divvy' },
  { labelKey: 'nav.monthLog', href: '/manager-pro/extra/month-log' },
  { labelKey: 'nav.cards', href: '/manager-pro/extra/cards' },
  { labelKey: 'nav.cars', href: '/manager-pro/cars' },
  { labelKey: 'nav.insurance', href: '/manager-pro/extra/insurance' },
  {
    labelKey: 'nav.longTerm',
    href: '/manager-pro/extra/long-term',
    children: [{ labelKey: 'nav.longTermMain', href: '/manager-pro/extra/long-term' }],
  },
  {
    labelKey: 'nav.agencies',
    href: '/manager-pro/reservations',
    children: [
      { labelKey: 'nav.reservations', href: '/manager-pro/reservations' },
      { labelKey: 'nav.payoutsAg', href: '/manager-pro/payouts' },
    ],
  },
];

export { isGroup };
