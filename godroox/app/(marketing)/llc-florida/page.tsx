import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LLCFormationForm } from '@/components/forms/llc-formation-form';

export const metadata = {
  title: 'Florida LLC Formation',
  description: 'Form your LLC in Florida quickly and easily. Complete registration process with expert guidance and support.',
};

export default function FloridaLLCPage() {
  const steps = [
    {
      number: '01',
      title: 'Choose Your Name',
      description: 'Select a unique business name and check availability',
    },
    {
      number: '02',
      title: 'File Articles of Organization',
      description: 'We handle all paperwork and filing with the state',
    },
    {
      number: '03',
      title: 'Get Your EIN',
      description: 'Obtain your Employer Identification Number from the IRS',
    },
    {
      number: '04',
      title: 'You\'re Ready!',
      description: 'Start operating your Florida LLC immediately',
    },
  ];

  const features = [
    'Fast processing (1-3 business days)',
    'Registered agent service included',
    'Operating agreement template',
    'EIN application assistance',
    'Compliance monitoring',
    'Expert support throughout',
    'PO Box mail forwarding service available',
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              Form Your Florida LLC
              <span className="block text-primary-600">
                Fast, Easy, and Professional
              </span>
            </h1>
            <p className="body-large mb-8">
              Start your business in Florida with our streamlined LLC formation
              service. Expert guidance every step of the way.
            </p>
            <Link href="/signup">
              <Button size="lg">Start Formation</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="heading-2 text-secondary-900 mb-4">
              How It Works
            </h2>
            <p className="body-large">
              Simple process, professional results
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                <div className="text-6xl font-bold text-primary-100 mb-4">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-secondary-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-secondary-600">{step.description}</p>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-primary-200 transform translate-x-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formation Form */}
      <section className="py-20 bg-secondary-50">
        <div className="container-custom">
          <div className="mx-auto max-w-2xl">
            <LLCFormationForm />
          </div>
        </div>
      </section>

      {/* Features & Pricing */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="heading-2 text-secondary-900 mb-6">
                What's Included
              </h2>
              <ul className="space-y-4">
                {features.map((feature, index) => (
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
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-3xl">Standard Package</CardTitle>
                <div className="text-4xl font-bold text-primary-600 mt-4">
                  $299
                  <span className="text-lg font-normal text-secondary-600">
                    {' '}
                    one-time
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-secondary-600 mb-6">
                  Everything you need to form your Florida LLC quickly and
                  correctly.
                </p>
                <Link href="/signup">
                  <Button className="w-full" size="lg">
                    Get Started
                  </Button>
                </Link>
                <p className="text-sm text-secondary-500 mt-4 text-center">
                  No hidden fees. 100% satisfaction guaranteed.
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
              Ready to Form Your LLC?
            </h2>
            <p className="body-large text-primary-100 mb-8">
              Join thousands of entrepreneurs who formed their Florida LLC with
              Godroox.
            </p>
            <Link href="/signup">
              <Button size="lg" variant="secondary">
                Start Formation Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
