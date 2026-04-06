'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { POBoxCheckbox } from './po-box-checkbox';

export function InsuranceApplicationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: '',
    fullAddress: '',
    contactEmail: '',
    phoneNumber: '',
    useMailService: false,
    discountCode: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.companyName) newErrors.companyName = 'Company name is required';
    if (!formData.fullAddress) newErrors.fullAddress = 'Full address is required';
    if (!formData.contactEmail) newErrors.contactEmail = 'Contact email is required';
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Insurance application:', formData);
      router.push('/dashboard?insurance=success');
    } catch (error) {
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-white border-2 border-secondary-200 shadow-lg">
        <CardHeader className="pb-6">
          <CardTitle className="text-3xl font-bold text-secondary-900 mb-2">
            Company Information
          </CardTitle>
          <CardDescription className="text-base text-secondary-600">
            Fill in the required details to start your company formation process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-semibold text-secondary-900 mb-2">
                Company Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <Input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  error={errors.companyName}
                  placeholder="Enter your company name"
                  className="pl-12 h-12 bg-secondary-50 border-secondary-300 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Full Address */}
            <div>
              <label className="block text-sm font-semibold text-secondary-900 mb-2">
                Full Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <Input
                  type="text"
                  value={formData.fullAddress}
                  onChange={(e) => updateField('fullAddress', e.target.value)}
                  error={errors.fullAddress}
                  placeholder="Enter your full address"
                  className="pl-12 h-12 bg-secondary-50 border-secondary-300 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-semibold text-secondary-900 mb-2">
                Contact Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <Input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                  error={errors.contactEmail}
                  placeholder="Enter your email"
                  className="pl-12 h-12 bg-secondary-50 border-secondary-300 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-secondary-900 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value)}
                  error={errors.phoneNumber}
                  placeholder="Enter your phone number"
                  className="pl-12 h-12 bg-secondary-50 border-secondary-300 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* Mail Service Option */}
            <div className="flex items-start space-x-3 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
              <input
                type="checkbox"
                id="mailService"
                checked={formData.useMailService}
                onChange={(e) => updateField('useMailService', e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-secondary-300 text-success-500 focus:ring-success-500"
              />
              <label htmlFor="mailService" className="flex-1 cursor-pointer">
                <div className="flex items-center space-x-2">
                  <div className="h-5 w-5 bg-success-500 rounded flex items-center justify-center">
                    <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-secondary-900">
                    I want Mail Service (US Address & Mail forwarding)
                  </span>
                </div>
              </label>
            </div>

            {/* Discount Code */}
            <div>
              <label className="block text-sm font-semibold text-secondary-900 mb-2">
                Discount Code
              </label>
              <Input
                type="text"
                value={formData.discountCode}
                onChange={(e) => updateField('discountCode', e.target.value)}
                placeholder="Enter discount code (optional)"
                className="h-12 bg-secondary-50 border-secondary-300 focus:bg-white"
              />
            </div>

            {errors.submit && (
              <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-sm text-danger-600">{errors.submit}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-secondary-900 hover:bg-secondary-800 text-white font-semibold text-base"
              isLoading={isSubmitting}
            >
              Submit Application
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
