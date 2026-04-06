'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

export default function TrabalheConoscoPage() {
  const { t } = useLanguage();

  return (
    <>
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              {t('workWithUs.heading')}
              <span className="block text-primary-600">
                {t('workWithUs.subtitle')}
              </span>
            </h1>
            <p className="body-large mb-8 text-secondary-600">
              {t('workWithUs.intro')}
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-secondary-600 mb-6">
              {t('workWithUs.emailLabel')}:{' '}
              <a
                href="mailto:contact@godroox.com?subject=Candidatura"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                contact@godroox.com
              </a>
            </p>
            <Link
              href="mailto:contact@godroox.com?subject=Candidatura"
              className="inline-flex items-center justify-center h-12 px-8 text-base font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/30 transition-colors"
            >
              {t('workWithUs.sendResume')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
