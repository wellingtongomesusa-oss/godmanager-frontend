'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const [language, setLanguage] = useState<'en' | 'pt'>('en');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Get language from localStorage or default to 'en'
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('language') as 'en' | 'pt' | null;
      if (savedLang) {
        setLanguage(savedLang);
      }
    }
  }, []);

  const handleLanguageChange = (lang: 'en' | 'pt') => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
    }
    // Reload to apply language changes
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleLanguageChange('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          language === 'en'
            ? 'bg-primary-600 text-white'
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleLanguageChange('pt')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          language === 'pt'
            ? 'bg-primary-600 text-white'
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100'
        }`}
      >
        PT
      </button>
    </div>
  );
}
