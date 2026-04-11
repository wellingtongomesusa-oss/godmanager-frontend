export type MasterOneLocale = 'en' | 'pt';

export const MASTER_ONE_LOCALE_KEY = 'master-one-ui-locale';

export function readMasterOneLocale(): MasterOneLocale {
  if (typeof window === 'undefined') return 'pt';
  return localStorage.getItem(MASTER_ONE_LOCALE_KEY) === 'en' ? 'en' : 'pt';
}

export function writeMasterOneLocale(l: MasterOneLocale) {
  localStorage.setItem(MASTER_ONE_LOCALE_KEY, l);
}
