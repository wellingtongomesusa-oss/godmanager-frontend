'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { SiteHeader } from '@/components/landing/SiteHeader';

function RequestAccessContent() {
  const params = useSearchParams();
  const segment = params.get('segment') || '';
  const email = params.get('email') || '';

  return (
    <main className="min-h-screen bg-[#f5f0e8] py-16 px-6">
      <div className="mx-auto max-w-xl">
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-200/60 text-center">
          <p className="text-xs uppercase tracking-wider text-slate-500 mb-4">Coming soon</p>
          <h1 className="font-playfair text-3xl text-[#1e2b3d] mb-3">We are getting ready for you</h1>
          <p className="text-sm text-slate-600 mb-3 leading-relaxed">
            Self-serve signup is launching soon. In the meantime, we set up your account personally so you get a clean start with your data,
            your team, and your branding.
          </p>
          {email && (
            <p className="text-xs text-slate-500 mb-6">
              We have your contact ({email}) and will reach out within 1 business day.
            </p>
          )}

          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link
              href={`/contacto${email ? `?email=${encodeURIComponent(email)}&lead=true` : ''}`}
              className="px-7 py-3 rounded-lg bg-[#c9a961] text-white font-semibold text-sm hover:bg-[#b08f4a] transition-all"
            >
              Contact us now
            </Link>
            <Link
              href="/savings"
              className="px-7 py-3 rounded-lg bg-transparent text-[#1e2b3d] font-semibold text-sm hover:bg-slate-50 border border-[#1e2b3d] transition-all"
            >
              Back to pricing
            </Link>
          </div>

          {segment && (
            <p className="text-[10px] text-slate-400 mt-8 font-mono">Plan reference: {segment}</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SignupTrialClient() {
  return (
    <>
      <SiteHeader active="savings" />
      <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading...</div>}>
        <RequestAccessContent />
      </Suspense>
    </>
  );
}
