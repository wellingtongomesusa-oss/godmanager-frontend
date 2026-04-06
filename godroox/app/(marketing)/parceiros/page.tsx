import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Partner Program',
  description: 'Integrate Godroox services into your platform. Powerful B2B API for life insurance, LLC formation, and international payments.',
};

export default function PartnersPage() {
  const features = [
    {
      title: 'Life Insurance API',
      description: 'Integrate insurance quotes and applications into your platform',
      endpoint: '/api/v1/insurance/*',
    },
    {
      title: 'LLC Formation API',
      description: 'Offer Florida LLC formation services to your customers',
      endpoint: '/api/v1/llc/*',
    },
    {
      title: 'Payments API',
      description: 'Enable international payments in your application',
      endpoint: '/api/v1/payments/*',
    },
    {
      title: 'Webhooks',
      description: 'Real-time notifications for all events and transactions',
      endpoint: '/api/v1/webhooks',
    },
  ];

  const benefits = [
    'Revenue sharing opportunities',
    'Dedicated partner support',
    'Comprehensive API documentation',
    'Sandbox environment for testing',
    'Rate limits tailored to your needs',
    'Priority support and SLA',
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              Partner with Godroox
              <span className="block text-primary-600">
                Powerful B2B API Integration
              </span>
            </h1>
            <p className="body-large mb-8">
              Integrate life insurance, LLC formation, and international
              payments into your platform. Grow your business with our
              comprehensive API.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup?type=partner">
                <Button size="lg">Become a Partner</Button>
              </Link>
              <Link href="/parceiros/api">
                <Button variant="outline" size="lg">
                  View API Docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* API Features */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="heading-2 text-secondary-900 mb-4">
              API Capabilities
            </h2>
            <p className="body-large">
              Everything you need to integrate Godroox services
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {features.map((feature, index) => (
              <Card key={index} hover>
                <CardHeader>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="text-sm bg-secondary-100 px-3 py-1 rounded text-primary-600">
                    {feature.endpoint}
                  </code>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-secondary-50">
        <div className="container-custom">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="heading-2 text-secondary-900 mb-6">
                Partner Benefits
              </h2>
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start">
                    <svg
                      className="h-6 w-6 text-success-500 mr-3 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-lg text-secondary-700">
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <CardDescription>
                  Join our partner program and start integrating today
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/signup?type=partner">
                  <Button className="w-full" size="lg">
                    Apply for Partnership
                  </Button>
                </Link>
                <Link href="/parceiros/api">
                  <Button variant="outline" className="w-full">
                    View API Documentation
                  </Button>
                </Link>
                <p className="text-sm text-secondary-500 text-center">
                  Already a partner?{' '}
                  <Link href="/login" className="text-primary-600 hover:underline">
                    Sign in to your dashboard
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="container-custom">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-white mb-4">
              Ready to Partner with Us?
            </h2>
            <p className="body-large text-primary-100 mb-8">
              Join leading platforms integrating Godroox services.
            </p>
            <Link href="/signup?type=partner">
              <Button size="lg" variant="secondary">
                Apply Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
