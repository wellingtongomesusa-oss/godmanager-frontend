import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InsuranceApplicationForm } from '@/components/forms/insurance-application-form';

export const metadata = {
  title: 'Life Insurance',
  description: 'Comprehensive life insurance coverage tailored to your needs. Get quotes, compare plans, and secure your family\'s future.',
};

export default function LifeInsurancePage() {
  const benefits = [
    {
      title: 'Comprehensive Coverage',
      description: 'Protect your loved ones with coverage options from $100K to $10M+',
      icon: '🛡️',
    },
    {
      title: 'Fast Approval',
      description: 'Get approved in as little as 24 hours with our streamlined process',
      icon: '⚡',
    },
    {
      title: 'Competitive Rates',
      description: 'Compare quotes from top insurers to find the best rates',
      icon: '💰',
    },
    {
      title: 'Expert Support',
      description: 'Dedicated agents to help you choose the right coverage',
      icon: '👥',
    },
  ];

  const plans = [
    {
      name: 'Term Life',
      price: 'From $20/month',
      features: [
        'Coverage for 10, 20, or 30 years',
        'Fixed premiums',
        'No cash value',
        'Best for temporary needs',
      ],
    },
    {
      name: 'Whole Life',
      price: 'From $100/month',
      features: [
        'Lifetime coverage',
        'Cash value accumulation',
        'Fixed premiums',
        'Best for permanent needs',
      ],
    },
    {
      name: 'Universal Life',
      price: 'From $75/month',
      features: [
        'Flexible premiums',
        'Cash value growth',
        'Adjustable coverage',
        'Best for flexibility',
      ],
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              Life Insurance
              <span className="block text-primary-600">
                Protect What Matters Most
              </span>
            </h1>
            <p className="body-large mb-8">
              Secure your family's financial future with comprehensive life
              insurance coverage. Get quotes from top insurers in minutes.
            </p>
            <Link href="/signup">
              <Button size="lg">Get a Quote</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="heading-2 text-secondary-900 mb-4">
              Why Choose Godroox Life Insurance?
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, index) => (
              <Card key={index} hover>
                <CardHeader>
                  <div className="text-4xl mb-4">{benefit.icon}</div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                  <CardDescription>{benefit.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Application Form */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <InsuranceApplicationForm />
        </div>
      </section>

      {/* Plans */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="heading-2 text-secondary-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="body-large">
              Find the right coverage for your needs and budget
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan, index) => (
              <Card key={index} hover className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold text-primary-600 mt-2">
                    {plan.price}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <svg
                          className="h-5 w-5 text-success-500 mr-2 mt-0.5 flex-shrink-0"
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
                        <span className="text-sm text-secondary-600">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="container-custom">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="heading-2 text-white mb-4">
              Ready to Get Covered?
            </h2>
            <p className="body-large text-primary-100 mb-8">
              Get a free quote in minutes. No obligation, no hassle.
            </p>
            <Link href="/signup">
              <Button size="lg" variant="secondary">
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
