/** Locale curto usado em gm_lang (localStorage) e dicionários Premium. */
export type GmLangShort = 'en' | 'pt' | 'es';

/** IDs canónicos para cookie NEXT_LOCALE e document.documentElement.lang. */
export type GmLocaleCanonical = 'en-US' | 'pt-BR' | 'es-ES';

/** Normaliza qualquer input (en, pt-BR, pt-br, es-ES, …) para forma interna en/pt/es. */
export function toGmLangShort(input: string): GmLangShort {
  const s = String(input || '')
    .toLowerCase()
    .replace(/_/g, '-');
  if (s === 'pt' || s === 'pt-br' || s.startsWith('pt-')) return 'pt';
  if (s === 'es' || s === 'es-es' || s.startsWith('es-')) return 'es';
  return 'en';
}

/** Forma interna → ID canónico (cookie / html lang). */
export function toGmLocaleCanonical(short: GmLangShort): GmLocaleCanonical {
  if (short === 'pt') return 'pt-BR';
  if (short === 'es') return 'es-ES';
  return 'en-US';
}

/** Locale do App Router (en | pt-br | es) → canónico. */
export function appLocaleToCanonical(appLocale: string): GmLocaleCanonical {
  return toGmLocaleCanonical(toGmLangShort(appLocale));
}

/** Persiste gm_lang + NEXT_LOCALE antes do redirect ao Premium (client-only). */
export function persistGmLocaleForPremium(appOrAnyLocale: string): void {
  if (typeof window === 'undefined') return;
  const short = toGmLangShort(appOrAnyLocale);
  const canonical = toGmLocaleCanonical(short);
  try {
    localStorage.setItem('gm_lang', short);
  } catch {
    /* ignore */
  }
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `NEXT_LOCALE=${canonical}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
