'use client';

import { useLanguage } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n/translations';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  const handleLanguageChange = (next: Locale) => {
    setLocale(next);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleLanguageChange('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          locale === 'en'
            ? 'bg-primary-600 text-white'
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleLanguageChange('pt')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          locale === 'pt'
            ? 'bg-primary-600 text-white'
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
        }`}
      >
        PT
      </button>
    </div>
  );
}
