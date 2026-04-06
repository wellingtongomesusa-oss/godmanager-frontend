'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { POBoxCheckbox } from './po-box-checkbox';

export function LLCFormationForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: '',
    businessAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
    mailingAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
    },
    registeredAgent: '',
    usePOBox: false,
    poBoxNumber: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.companyName) newErrors.companyName = 'Company name is required';
    if (!formData.businessAddress.street) newErrors['businessAddress.street'] = 'Business address is required';
    if (formData.usePOBox && !formData.poBoxNumber) newErrors.poBoxNumber = 'PO Box number is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('LLC order:', formData);
      router.push('/dashboard?llc=success');
    } catch (error) {
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as any),
          [child]: value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Florida LLC Formation</CardTitle>
        <CardDescription>
          Complete the form below to start your LLC formation process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              label="Company Name *"
              type="text"
              value={formData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              error={errors.companyName}
              placeholder="My Company LLC"
              required
            />
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Business Address</h3>
            <div className="space-y-4">
              <Input
                label="Street Address *"
                type="text"
                value={formData.businessAddress.street}
                onChange={(e) => updateField('businessAddress.street', e.target.value)}
                error={errors['businessAddress.street']}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="City *"
                  type="text"
                  value={formData.businessAddress.city}
                  onChange={(e) => updateField('businessAddress.city', e.target.value)}
                  required
                />
                <Input
                  label="State *"
                  type="text"
                  value={formData.businessAddress.state}
                  onChange={(e) => updateField('businessAddress.state', e.target.value)}
                  placeholder="FL"
                  required
                />
              </div>
              <Input
                label="ZIP Code *"
                type="text"
                value={formData.businessAddress.zipCode}
                onChange={(e) => updateField('businessAddress.zipCode', e.target.value)}
                required
              />
            </div>
          </div>

          {/* PO Box Option */}
          <div className="border-t pt-6">
            <POBoxCheckbox
              checked={formData.usePOBox}
              onCheckedChange={(checked) => updateField('usePOBox', checked)}
              poBoxNumber={formData.poBoxNumber}
              onPOBoxNumberChange={(value) => updateField('poBoxNumber', value)}
              error={errors.poBoxNumber}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Registered Agent (optional)
            </label>
            <Input
              type="text"
              value={formData.registeredAgent}
              onChange={(e) => updateField('registeredAgent', e.target.value)}
              placeholder="We can provide registered agent service"
            />
          </div>

          {errors.submit && (
            <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
              <p className="text-sm text-accent-600">{errors.submit}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
            Start LLC Formation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
