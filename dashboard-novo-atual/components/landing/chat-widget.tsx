'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/language-context';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      <div
        className={`fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 transition-all duration-200 ${
          open ? 'pointer-events-auto' : ''
        }`}
      >
        {open && (
          <div className="w-[340px] max-w-[calc(100vw-3rem)] rounded-2xl border border-secondary-200 bg-white p-4 shadow-xl">
            <p className="font-semibold text-secondary-900">{t('chat.welcome')}</p>
            <p className="mt-1 text-sm text-secondary-600">{t('chat.question')}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/admin/painel"
                className="rounded-lg border-2 border-secondary-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-secondary-900 transition hover:border-primary-500 hover:bg-primary-50"
              >
                {t('chat.talkAI')}
              </Link>
              <Link
                href="#acesso"
                className="rounded-lg border-2 border-secondary-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-secondary-900 transition hover:border-primary-500 hover:bg-primary-50"
              >
                {t('chat.signUp')}
              </Link>
              <Link
                href="#acesso"
                className="rounded-lg border-2 border-secondary-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-secondary-900 transition hover:border-primary-500 hover:bg-primary-50"
              >
                {t('chat.scheduleDemo')}
              </Link>
              <button
                type="button"
                className="rounded-lg border-2 border-secondary-300 bg-white px-4 py-2.5 text-sm font-medium text-secondary-900 transition hover:border-primary-500 hover:bg-primary-50"
              >
                {t('chat.support')}
              </button>
            </div>
            <p className="mt-3 text-xs text-secondary-500">{t('chat.disclaimer')}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-400 text-white shadow-md transition hover:bg-primary-500"
          aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>
    </>
  );
}
