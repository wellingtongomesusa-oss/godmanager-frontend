'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactForm } from '@/components/contact/contact-form';
import { useLanguage } from '@/lib/i18n';

export function ContactPageContent() {
  const { t } = useLanguage();

  return (
    <>
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              {t('contact.heading')}
              <span className="block text-primary-600">
                {t('contact.heroSubtitle')}
              </span>
            </h1>
            <p className="body-large mb-8">
              {t('contact.heroDesc')}
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="grid gap-12 lg:grid-cols-2">
            <ContactForm />

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{t('contact.officialContact')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                      {t('contact.email')}
                    </h3>
                    <a
                      href="mailto:contact@godroox.com"
                      className="text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      contact@godroox.com
                    </a>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                      {t('contact.phone')}
                    </h3>
                    <a
                      href="https://wa.me/13215194710"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      +1 (321) 519-4710
                    </a>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                      {t('contact.businessHours')}
                    </h3>
                    <p className="text-secondary-600 whitespace-pre-line">
                      {t('contact.businessHoursValue')}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                      {t('contact.responseTime')}
                    </h3>
                    <p className="text-secondary-600">
                      {t('contact.responseTimeValue')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{t('contact.whyChoose')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-secondary-600">
                    <li className="flex items-start">
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
                      {t('contact.why1')}
                    </li>
                    <li className="flex items-start">
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
                      {t('contact.why2')}
                    </li>
                    <li className="flex items-start">
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
                      {t('contact.why3')}
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
