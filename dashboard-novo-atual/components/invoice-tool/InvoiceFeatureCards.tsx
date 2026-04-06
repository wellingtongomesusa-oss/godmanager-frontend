'use client';

import Link from 'next/link';

const MAX_WIDTH = 1200;

const features = [
  {
    id: 'custom',
    title: 'Custom Invoices',
    description: 'Design professional invoices with your branding and line items.',
    icon: (
      <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'sharing',
    title: 'Quick Sharing',
    description: 'Send via WhatsApp, email, or download PDF in one click.',
    icon: (
      <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
  },
  {
    id: 'secure',
    title: 'Secure Payments',
    description: 'Your data stays safe. Optional cloud sync for Pro users.',
    icon: (
      <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    id: 'growth',
    title: 'Growth-Ready',
    description: 'Scale from freelancer to small business with unlimited invoices on Pro.',
    icon: (
      <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

export function InvoiceFeatureCards() {
  return (
    <section id="products" className="border-t border-gray-100 bg-gray-50/50 py-16" aria-labelledby="features-heading">
      <div className="mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: MAX_WIDTH }}>
        <h2 id="features-heading" className="sr-only">Key features</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md"
              style={{ borderRadius: 8 }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg text-white"
                style={{ background: 'var(--invoice-primary)' }}
                aria-hidden
              >
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-invoice-heading">{f.title}</h3>
              <p className="mt-2 text-sm text-invoice-body">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
