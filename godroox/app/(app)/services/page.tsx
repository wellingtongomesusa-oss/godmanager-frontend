import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Services - Godroox',
  description: 'Access all your Godroox services in one place.',
};

export default function ServicesPage() {
  const services = [
    {
      title: 'Life Insurance',
      description: 'Insurance offered by a licensed US agent. Protect your loved ones with comprehensive coverage.',
      icon: '🛡️',
      href: '/seguros-de-vida',
      color: 'bg-orange-100',
      iconBg: 'bg-orange-500',
    },
    {
      title: 'US LLC Formation',
      description: 'Company formation and maintenance for foreigners in the United States. Fast and professional.',
      icon: '🏢',
      href: '/llc-florida',
      color: 'bg-purple-100',
      iconBg: 'bg-purple-500',
    },
    {
      title: 'International Remittances',
      description: 'Secure and traceable transfers from Brazil to the US. Competitive rates and low fees.',
      icon: '✈️',
      href: '/pagamentos-internacionais',
      color: 'bg-green-100',
      iconBg: 'bg-green-500',
    },
  ];

  return (
    <div className="min-h-screen bg-secondary-50 py-12">
      <div className="container-custom">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-secondary-900 mb-4">
            Your Services
          </h1>
          <p className="text-xl text-secondary-600">
            Manage all your Godroox services from one place
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <Card key={index} hover className="bg-white border-2 border-secondary-200">
              <CardHeader>
                <div className={`h-16 w-16 rounded-xl ${service.color} flex items-center justify-center mb-4`}>
                  <span className="text-3xl">{service.icon}</span>
                </div>
                <CardTitle className="text-2xl text-secondary-900">
                  {service.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {service.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={service.href}>
                  <Button className="w-full bg-primary-600 hover:bg-primary-700 text-white">
                    Access Service
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link href="/dashboard">
            <Button variant="outline" className="border-secondary-300 text-secondary-700 hover:bg-secondary-50">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
