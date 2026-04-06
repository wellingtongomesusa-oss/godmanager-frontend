'use client';

const MAX_WIDTH = 1200;

export function InvoiceHero() {
  return (
    <section className="bg-white py-16 sm:py-24" aria-labelledby="hero-heading">
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8 text-center"
        style={{ maxWidth: MAX_WIDTH }}
      >
        <h1
          id="hero-heading"
          className="font-bold tracking-tight text-invoice-heading"
          style={{ fontSize: 'clamp(2rem, 5vw, 48px)' }}
        >
          Create Invoices Effortlessly
        </h1>
        <p
          className="mt-4 text-invoice-body"
          style={{ fontSize: 24 }}
        >
          Streamline billing with smart tools – no manual hassle.
        </p>
      </div>
    </section>
  );
}
