import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeroCarousel } from '@/components/banner/hero-carousel';

export const metadata = {
  title: 'Godroox - Financial Services Platform',
  description: 'From invoice payment to company formation, we offer everything you need.',
};

export default function HomePage() {
  return (
    <>
      {/* Hero Carousel Banner */}
      <HeroCarousel />

      {/* Services Section - Layout harmonizado e alinhado */}
      <section className="py-20 bg-secondary-50">
        <div className="container-custom">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-secondary-900 mb-4">
              Solutions for every stage of growth
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
            {/* Life Insurance Card */}
            <Card hover className="bg-white border-2 border-secondary-200 overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-white">
                <Image
                  src="/images/services/life-insurance.png"
                  alt="Life Insurance - Goodrox Life"
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">Life Insurance</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  Comprehensive life insurance coverage tailored to your needs. Protect your loved ones with reliable coverage.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link href="/seguros-de-vida" className="block">
                  <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
                    Learn More
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Business Account Opening Card */}
            <Card hover className="bg-white border-2 border-secondary-200 overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-white">
                <Image
                  src="/images/services/business-account.png"
                  alt="Business Account Opening - Godroox Open"
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">Business Account Opening</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  Open business accounts and manage your company finances. Streamlined process for entrepreneurs.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link href="/llc-florida" className="block">
                  <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
                    Learn More
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* International Payments Card */}
            <Card hover className="bg-white border-2 border-secondary-200 overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-white">
                <Image
                  src="/images/services/international-payments.png"
                  alt="International Payments - Godroox Pay"
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">International Payments</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  Send money internationally with competitive rates. Secure and traceable transfers worldwide.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link href="/pagamentos-internacionais" className="block">
                  <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
                    Learn More
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Godroox PRO Card */}
            <Card hover className="bg-white border-2 border-secondary-200 overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-white">
                <Image
                  src="/images/services/godroox-pro.png"
                  alt="Godroox PRO - Stock Market & Options Education"
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">Godroox PRO</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  Master the stock market and options trading. Comprehensive education programs for all skill levels.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link href="/godroox-pro" className="block">
                  <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
                    Learn More
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold text-secondary-900 mb-4">
              Ready to get started?
            </h2>
            <p className="text-xl text-secondary-600 mb-8">
              Join thousands of businesses using Godroox for their financial needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-primary-600 hover:bg-primary-700 text-white px-8 shadow-lg shadow-primary-500/50">
                  Get started
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-secondary-300 text-secondary-700 hover:bg-secondary-50 px-8">
                  Contato
                </Button>
              </Link>
            </div>
            <p className="text-sm text-secondary-500 mt-6">
              <strong>Note:</strong> Godroox is not a bank. Banking services are provided by our partner financial institutions.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
