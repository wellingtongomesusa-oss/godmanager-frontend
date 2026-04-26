'use client';

import { useLocale } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const ITEMS: { id: (typeof routing.locales)[number]; abbr: string; title: string }[] = [
  { id: 'en', abbr: 'EN', title: 'English' },
  { id: 'pt-br', abbr: 'PT', title: 'Português' },
  { id: 'es', abbr: 'ES', title: 'Español' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function setCookie(next: string) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }

  function select(next: (typeof routing.locales)[number]) {
    if (next === locale) {
      setOpen(false);
      return;
    }
    setCookie(next);
    router.replace(pathname, { locale: next });
    setOpen(false);
  }

  const current = ITEMS.find((i) => i.id === locale) || ITEMS[0];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(201,169,110,0.35)',
          color: '#e5e7eb',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '6px 10px',
          borderRadius: 6,
          minWidth: 44,
          fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
      >
        {current.abbr}
      </button>
      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            minWidth: 160,
            margin: '6px 0 0',
            padding: 0,
            listStyle: 'none',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 8,
            zIndex: 200,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === locale}
                onClick={() => select(item.id)}
                style={{
                  display: 'flex',
                  width: '100%',
                  padding: '10px 14px',
                  textAlign: 'left',
                  border: 'none',
                  background: item.id === locale ? '#374151' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 32 }}>{item.abbr}</span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{item.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
