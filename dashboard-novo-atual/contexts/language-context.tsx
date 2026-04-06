'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { translations, type Locale, type TranslationKey } from '@/lib/i18n/translations';

const STORAGE_KEY = 'language';

interface LanguageContextValue {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'pt';
  const s = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return s === 'en' || s === 'pt' ? s : 'pt';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>('pt');

  useEffect(() => {
    setLanguageState(getStoredLocale());
  }, []);

  const setLanguage = useCallback((lang: Locale) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = translations[language];
      return (dict as Record<string, string>)[key] ?? (translations.pt as Record<string, string>)[key] ?? key;
    },
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
