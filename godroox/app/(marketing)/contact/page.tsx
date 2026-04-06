import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContactForm } from '@/components/contact/contact-form';

export const metadata = {
  title: 'Contato | Godroox',
  description: 'Entre em contato com a Godroox. E-mail: contact@godroox.com | WhatsApp: +1 (321) 519-4710',
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              Contato
              <span className="block text-primary-600">
                Estamos aqui para ajudar
              </span>
            </h1>
            <p className="body-large mb-8">
              Dúvidas ou suporte? Envie sua mensagem; a equipe Godroox responde em até 24 horas. Mensagens são enviadas para contact@godroox.com e nosso telefone +1 (321) 519-4710 é alertado.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 bg-white">
        <div className="container-custom">
          <div className="grid gap-12 lg:grid-cols-2">
            {/* Contact Form */}
            <ContactForm />

            {/* Contact Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Contato oficial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                      E-mail
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
                      Telefone / WhatsApp
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
                      Business Hours
                    </h3>
                    <p className="text-secondary-600">
                      Monday - Friday: 9:00 AM - 6:00 PM EST<br />
                      Saturday: 10:00 AM - 2:00 PM EST<br />
                      Sunday: Closed
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-secondary-900 mb-2">
                      Response Time
                    </h3>
                    <p className="text-secondary-600">
                      We typically respond within 24 hours during business days.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Why Choose Godroox?</CardTitle>
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
                      Secure and compliant financial services
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
                      Expert support team
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
                      Fast and reliable service
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
