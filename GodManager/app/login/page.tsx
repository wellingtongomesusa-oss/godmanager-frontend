import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import { GodManagerLogo } from '@/components/layout/GodManagerLogo';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { Skeleton } from '@/components/ui/skeleton';

/** Rua / skyline ao entardecer (NYC) — full-bleed no painel esquerdo */
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1518391846015-55a9cc003b25?auto=format&fit=crop&w=2000&q=85';

function LoginFormFallback() {
  return (
    <div className="mx-auto w-full max-w-[400px] space-y-4 font-inter">
      <Skeleton className="mx-auto h-10 w-40" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <>
      <SiteHeader active="home" />
      <div className="gm-login-root relative flex min-h-screen flex-col bg-login-cream lg:flex-row">
        {/* Painel esquerdo — desktop 50%; oculto no mobile */}
        <div className="relative hidden min-h-screen w-full lg:flex lg:w-1/2">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          className="object-cover object-center"
          priority
          sizes="50vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-login-navy/92 via-login-navy/55 to-login-navy/35"
          aria-hidden
        />
        <div className="relative z-10 flex min-h-screen w-full flex-col justify-end p-10 pt-24 xl:p-14 xl:pt-28">
          <div className="flex flex-1 flex-col justify-end pb-6 pt-10">
            <div className="max-w-xl space-y-6">
              <h2 className="font-playfair text-[42px] font-semibold leading-[1.08] text-white md:text-[56px] lg:text-[64px]">
                Your finances, handled with precision
              </h2>
              <p className="font-inter text-[15px] leading-relaxed text-white/85">
                Professional bookkeeping, trust compliance, and daily reconciliation — engineered for brokerages and
                property firms across the United States.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-5 font-inter text-sm text-white/75">
            <p className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-playfair text-2xl font-semibold tabular-nums text-login-gold">98%</span>
              <span>Accuracy rate</span>
            </p>
            <p className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-playfair text-2xl font-semibold tabular-nums text-login-gold">3×</span>
              <span>Faster reconciliation</span>
            </p>
            <p className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
              <span className="font-playfair text-2xl font-semibold tabular-nums text-login-gold">24h</span>
              <span>Daily audit coverage</span>
            </p>
          </div>
        </div>
      </div>

      {/* Painel direito — full width mobile; 50% desktop */}
      <div className="relative z-[1] flex min-h-screen w-full flex-1 flex-col items-center justify-center px-6 py-12 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-[440px] rounded-2xl border border-black/[0.06] bg-white p-10 shadow-[0_1px_3px_rgba(10,22,40,0.06),0_12px_32px_rgba(10,22,40,0.08)] sm:p-12">
          <div className="mb-8 flex justify-center">
            <GodManagerLogo size="sm" surface="light" loginBrand />
          </div>
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
          <p className="mt-8 text-center font-inter text-[11px] leading-relaxed text-slate-500">
            <Link
              href="/gm"
              className="font-medium text-[#1a3a5c] underline decoration-[#1a3a5c]/30 underline-offset-2 transition hover:text-[#c9a96e] hover:decoration-[#c9a96e]/50"
            >
              Financial operations console
            </Link>
            <span className="block text-[10px] text-slate-400">Legacy full-page dashboard (HTML)</span>
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
