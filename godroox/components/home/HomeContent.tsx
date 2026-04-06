'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeroCarousel } from '@/components/banner/hero-carousel';
import { useLanguage } from '@/lib/i18n';

export function HomeContent() {
  const { t } = useLanguage();

  return (
    <>
      <HeroCarousel />

      <section className="py-16 sm:py-20 bg-secondary-50/80" aria-label="Serviços">
        <div className="container-custom">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-3 sm:mb-4">
              {t('home.solutionsTitle')}
            </h2>
            <p className="text-secondary-600 max-w-2xl mx-auto text-lg">
              {t('home.solutionsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch">
            <Card variant="outlined" hover className="bg-white overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-secondary-50/50">
                <Image
                  src="/images/services/life-insurance.png"
                  alt={t('home.lifeInsurance')}
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">{t('home.lifeInsurance')}</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  {t('home.lifeInsuranceDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link
                  href="/seguros-de-vida"
                  className="inline-flex items-center justify-center h-12 w-full px-6 text-base font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/30 hover:shadow-lg transition-all"
                >
                  {t('home.learnMore')}
                </Link>
              </CardContent>
            </Card>

            <Card variant="outlined" hover className="bg-white overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-secondary-50/50">
                <Image
                  src="/images/services/business-account.png"
                  alt={t('home.businessAccount')}
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">{t('home.businessAccount')}</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  {t('home.businessAccountDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link
                  href="/llc-florida"
                  className="inline-flex items-center justify-center h-12 w-full px-6 text-base font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/30 hover:shadow-lg transition-all"
                >
                  {t('home.learnMore')}
                </Link>
              </CardContent>
            </Card>

            <Card variant="outlined" hover className="bg-white overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-secondary-50/50">
                <Image
                  src="/images/services/international-payments.png"
                  alt={t('home.internationalPayments')}
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">{t('home.internationalPayments')}</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  {t('home.internationalPaymentsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link
                  href="/pagamentos-internacionais"
                  className="inline-flex items-center justify-center h-12 w-full px-6 text-base font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/30 hover:shadow-lg transition-all"
                >
                  {t('home.learnMore')}
                </Link>
              </CardContent>
            </Card>

            <Card variant="outlined" hover className="bg-white overflow-hidden flex flex-col h-full">
              <div className="h-52 sm:h-64 shrink-0 relative bg-secondary-50/50">
                <Image
                  src="/images/services/godroox-pro.png"
                  alt={t('home.godrooxPro')}
                  fill
                  className="object-contain p-4"
                  priority
                />
              </div>
              <CardHeader className="flex-1 flex flex-col min-h-0 p-6 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-secondary-900 mb-2 shrink-0">{t('home.godrooxPro')}</CardTitle>
                <CardDescription className="text-base text-secondary-600 min-h-[4.25rem] line-clamp-3 flex-1">
                  {t('home.godrooxProDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 mt-auto shrink-0">
                <Link
                  href="/godroox-pro"
                  className="inline-flex items-center justify-center h-12 w-full px-6 text-base font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/30 hover:shadow-lg transition-all"
                >
                  {t('home.learnMore')}
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20 bg-white" aria-label="Call to action">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-900 mb-3 sm:mb-4">
              {t('home.ctaTitle')}
            </h2>
            <p className="text-lg sm:text-xl text-secondary-600 mb-6 sm:mb-8">
              {t('home.ctaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-11 sm:h-12 w-full sm:w-auto px-6 sm:px-8 text-base sm:text-lg font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/30 hover:shadow-lg transition-all"
              >
                {t('home.getStarted')}
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center h-11 sm:h-12 w-full sm:w-auto px-6 sm:px-8 text-base sm:text-lg font-semibold rounded-lg border-2 border-secondary-300 text-secondary-700 hover:bg-secondary-50 hover:border-secondary-400 transition-all"
              >
                {t('home.contact')}
              </Link>
            </div>
            <p className="text-xs sm:text-sm text-secondary-500 mt-6 px-2">
              <strong>{t('home.ctaNote')}:</strong> {t('home.ctaDisclaimer')}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
