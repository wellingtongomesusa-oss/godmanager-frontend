'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function RequestServicePage() {
  const [selectedService, setSelectedService] = useState<'insurance' | 'llc' | 'payments' | ''>('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    country: '',
    serviceType: '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const services = [
    {
      id: 'insurance',
      title: 'Life Insurance',
      description: 'Get information about life insurance coverage options',
      icon: '🛡️',
    },
    {
      id: 'llc',
      title: 'Florida LLC Formation',
      description: 'Learn about forming an LLC in Florida',
      icon: '🏢',
    },
    {
      id: 'payments',
      title: 'International Payments',
      description: 'Information about international payment services',
      icon: '💸',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.country) newErrors.country = 'Country is required';
    if (!formData.serviceType) newErrors.serviceType = 'Service type is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/v1/services/request', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('Service request:', formData);

      // In production, this would:
      // 1. Save to database
      // 2. Send email notification to contact@godroox.com
      // 3. Send confirmation email to user
      // 4. Create ticket in support system

      setSubmitted(true);
    } catch (error) {
      console.error('Request error:', error);
      setErrors({ submit: 'An error occurred. Please try again or contact us directly at contact@godroox.com' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-100 mb-4">
                <svg
                  className="w-8 h-8 text-success-600"
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
              </div>
              <h1 className="heading-2 text-secondary-900 mb-4">Request Submitted!</h1>
              <p className="body-large text-secondary-600 mb-8">
                Thank you for your interest. We've received your request and will contact you within 24 hours.
              </p>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-6 mb-8">
                <p className="text-sm text-primary-800">
                  <strong>Next Steps:</strong> Our team will review your request and reach out to you at{' '}
                  <a href={`mailto:${formData.email}`} className="text-primary-600 hover:underline">
                    {formData.email}
                  </a>
                  {' '}with more information.
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => window.location.href = '/'}>Back to Home</Button>
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Submit Another Request
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20">
        <div className="container-custom">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="heading-1 text-secondary-900 mb-6">
              Request Service Information
              <span className="block text-primary-600">
                We're Here to Help
              </span>
            </h1>
            <p className="body-large mb-8">
              Interested in our services? Fill out the form below and we'll get back to you with detailed information.
            </p>
          </div>
        </div>
      </section>

      {/* Service Selection */}
      <section className="py-12 bg-white">
        <div className="container-custom">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-semibold text-secondary-900 mb-6 text-center">
              Select a Service
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {services.map((service) => (
                <Card
                  key={service.id}
                  hover
                  className={`cursor-pointer transition-all ${
                    selectedService === service.id
                      ? 'ring-2 ring-primary-500 border-primary-500'
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedService(service.id as any);
                    setFormData({ ...formData, serviceType: service.id });
                  }}
                >
                  <CardHeader>
                    <div className="text-4xl mb-4">{service.icon}</div>
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Request Form */}
      <section className="py-20 bg-secondary-50">
        <div className="container-custom">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Service Request Form</CardTitle>
                <CardDescription>
                  Provide your information and we'll contact you with details about the selected service.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Input
                      label="Full Name *"
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      error={errors.fullName}
                      required
                    />
                  </div>

                  <div>
                    <Input
                      label="Email *"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      error={errors.email}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Country *
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a country</option>
                      <option value="US">United States</option>
                      <option value="BR">Brazil</option>
                      <option value="CA">Canada</option>
                      <option value="MX">Mexico</option>
                      <option value="GB">United Kingdom</option>
                      <option value="OTHER">Other</option>
                    </select>
                    {errors.country && (
                      <p className="mt-1 text-sm text-accent-600">{errors.country}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Service Type *
                    </label>
                    <select
                      value={formData.serviceType}
                      onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                      className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select service type</option>
                      <option value="insurance">Life Insurance</option>
                      <option value="llc">Florida LLC Formation</option>
                      <option value="payments">International Payments</option>
                    </select>
                    {errors.serviceType && (
                      <p className="mt-1 text-sm text-accent-600">{errors.serviceType}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Additional Details / Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="flex min-h-[120px] w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Tell us more about what you're looking for..."
                    />
                  </div>

                  {errors.submit && (
                    <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
                      <p className="text-sm text-accent-600">{errors.submit}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
                    Submit Request
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-secondary-200 text-center">
                  <p className="text-sm text-secondary-600">
                    Or contact us directly at{' '}
                    <a
                      href="mailto:contact@godroox.com"
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      contact@godroox.com
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
