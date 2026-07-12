'use client';

import { useState } from 'react';

type Props = { locale: string; title: string; sub: string };

export function GodrealtorPromo({ locale, title, sub }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const loc = locale === 'pt-br' ? 'pt-br' : locale === 'es' ? 'es' : 'en';
  const L = {
    en: { sub: 'Subscribe to GodManager', god: 'Get GODREALTOR', opening: 'Opening checkout…', errCfg: 'Checkout unavailable right now.', err: 'Could not start checkout.', net: 'Network error.' },
    'pt-br': { sub: 'Assinar GodManager', god: 'Contratar GODREALTOR', opening: 'Abrindo checkout…', errCfg: 'Checkout indisponível no momento.', err: 'Não foi possível iniciar o checkout.', net: 'Falha de rede.' },
    es: { sub: 'Suscribirse a GodManager', god: 'Contratar GODREALTOR', opening: 'Abriendo checkout…', errCfg: 'Checkout no disponible ahora.', err: 'No se pudo iniciar el checkout.', net: 'Error de red.' },
  }[loc];

  const checkoutGodrealtor = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/godrealtor/checkout', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.url) {
        window.location.href = d.url;
        return;
      }
      setErr(d?.error === 'stripe_not_configured' ? L.errCfg : L.err);
    } catch {
      setErr(L.net);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-[#c9a96e]/40 bg-[#c9a96e]/5 px-4 py-3 text-center">
      <div className="font-inter text-[12px] font-medium text-[#1a3a5c]">{title}</div>
      <div className="mt-0.5 font-inter text-[10px] text-slate-400">{sub}</div>
      <div className="mt-3 flex flex-col gap-2">
        <a
          href={`/${loc}/subscribe`}
          className="inline-flex items-center justify-center rounded-md bg-[#1a3a5c] px-4 py-2 font-inter text-[12px] font-semibold text-white transition hover:bg-[#22558c]"
        >
          {L.sub}
        </a>
        <button
          type="button"
          onClick={() => void checkoutGodrealtor()}
          disabled={busy}
          className="inline-flex items-center justify-center rounded-md bg-[#c9a96e] px-4 py-2 font-inter text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? L.opening : L.god}
        </button>
      </div>
      {err && <div className="mt-2 font-inter text-[10px] text-red-500">{err}</div>}
    </div>
  );
}
