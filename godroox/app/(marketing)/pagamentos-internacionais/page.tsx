import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InternationalPaymentForm } from '@/components/payments/international-payment-form';

export const metadata: Metadata = {
  title: 'International Payments',
  description: 'Send money internationally with competitive rates and low fees. Fast, secure, and transparent transactions.',
};

export default function InternationalPaymentsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              International Payments
              <span className="block text-primary-600">
                Send Money Worldwide
              </span>
            </h1>
            <p className="body-large mb-8">
              Send money internationally with competitive rates, low fees, and fast processing.
              Secure and compliant with international regulations.
            </p>
          </div>
        </div>
      </section>

      {/* Payment Form */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl">
            <InternationalPaymentForm />
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-20 bg-secondary-50">
        <div className="container-custom">
          <div className="text-center mb-12">
            <h2 className="heading-2 text-secondary-900 mb-4">
              Why Choose Godroox for International Payments?
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Secure & Compliant</CardTitle>
                <CardDescription>
                  All transactions are encrypted and comply with international regulations.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fast Processing</CardTitle>
                <CardDescription>
                  Most payments are processed within 3-4 business days.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Competitive Rates</CardTitle>
                <CardDescription>
                  Transparent fees and competitive exchange rates.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
