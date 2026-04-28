'use client';

import { useMessages, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

export type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

type FaqSectionProps = {
  limit?: number;
  hideSearch?: boolean;
  hideCategoryFilter?: boolean;
};

const CAT_ORDER = ['about', 'comparison', 'pricing', 'compliance', 'technical', 'objections'] as const;

export function FaqSection({
  limit,
  hideSearch = false,
  hideCategoryFilter = false,
}: FaqSectionProps) {
  const t = useTranslations('faq');
  const messages = useMessages() as {
    faq: { items: FaqItem[] };
  };
  const allItems = messages.faq.items;
  const items = useMemo(
    () => (limit != null ? allItems.slice(0, limit) : allItems),
    [allItems, limit]
  );

  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    function onChange() {
      setNarrow(mq.matches);
    }
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (cat !== 'all' && it.category !== cat) return false;
      if (!q) return true;
      return (
        it.question.toLowerCase().includes(q) || it.answer.toLowerCase().includes(q)
      );
    });
  }, [items, search, cat]);

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    if (!hash) return;
    const match = allItems.find(
      (it) => `q-${allItems.indexOf(it) + 1}` === hash || it.id === hash
    );
    if (match) {
      setOpenId(match.id);
      const el = document.getElementById(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
    }
  }, [allItems]);

  return (
    <div>
      {!hideSearch && (
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#6b7280',
              display: 'block',
              marginBottom: 8,
            }}
          >
            {t('searchPlaceholder')}
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            style={{
              width: '100%',
              maxWidth: 480,
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontSize: 14,
              fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
              outline: 'none',
            }}
          />
        </label>
      )}

      {!hideCategoryFilter && !narrow && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {(['all', ...CAT_ORDER] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCat(key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: cat === key ? '1px solid #2d7252' : '1px solid #e5e7eb',
                  background: cat === key ? 'rgba(45,114,82,0.1)' : '#fff',
                  color: cat === key ? '#2d7252' : '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
                }}
              >
                {t(`categories.${key}` as 'categories.all')}
              </button>
            ))}
          </div>
        </div>
      )}

      {!hideCategoryFilter && narrow && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
            {t('categoryLabel')}
          </label>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 14,
              fontFamily: 'inherit',
              background: '#fff',
            }}
          >
            {(['all', ...CAT_ORDER] as const).map((key) => (
              <option key={key} value={key}>
                {t(`categories.${key}` as 'categories.all')}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: 14 }}>{t('noResults')}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((it) => {
          const globalIndex = allItems.findIndex((x) => x.id === it.id);
          const anchorId = `q-${globalIndex >= 0 ? globalIndex + 1 : 1}`;
          const expanded = openId === it.id;

          return (
            <article
              key={it.id}
              id={anchorId}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                background: '#fff',
                overflow: 'hidden',
                scrollMarginTop: 100,
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : it.id)}
                aria-expanded={expanded}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 18px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: 'var(--font-inter, "DM Sans"), sans-serif',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: '#1f2937' }}>{it.question}</span>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#c9a96e',
                    transform: expanded ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  v
                </span>
              </button>
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: expanded ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.25s ease',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '0 18px 18px',
                      fontSize: 14,
                      lineHeight: 1.65,
                      color: '#4b5563',
                      borderTop: expanded ? '1px solid rgba(229,231,235,0.6)' : 'none',
                      paddingTop: expanded ? 14 : 0,
                    }}
                  >
                    {it.answer}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
