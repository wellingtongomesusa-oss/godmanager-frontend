'use client';

import Script from 'next/script';
import { useLocale } from 'next-intl';
import { useEffect } from 'react';

const CRISP_WEBSITE_ID = 'bd9df422-0b22-497f-8f9f-eab0d777efe6';

// next-intl locale -> Crisp locale
const LOCALE_MAP: Record<string, string> = {
  en: 'en',
  es: 'es',
  'pt-br': 'pt',
  'pt-BR': 'pt',
  pt: 'pt',
};

declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}

export default function CrispChat() {
  const locale = useLocale();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.$crisp = window.$crisp || [];
    const crispLocale = LOCALE_MAP[locale] || 'en';
    window.$crisp.push(['config', 'locale', crispLocale]);
  }, [locale]);

  return (
    <Script
      id="crisp-chat"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          window.$crisp = window.$crisp || [];
          window.CRISP_WEBSITE_ID = "${CRISP_WEBSITE_ID}";
          (function(){
            var d = document;
            var s = d.createElement("script");
            s.src = "https://client.crisp.chat/l.js";
            s.async = 1;
            d.getElementsByTagName("head")[0].appendChild(s);
          })();
        `,
      }}
    />
  );
}
