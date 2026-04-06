'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentLimitsService } from '@/services/payments/payment-limits.service';
import { POBoxCheckbox } from '@/components/forms/po-box-checkbox';

export function InternationalPaymentForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    originCountry: '',
    destinationCountry: '',
    currency: 'USD',
    amount: '',
    paymentMethod: '',
    recipientName: '',
    recipientAccount: '',
    recipientBank: '',
    recipientAddress: '',
    usePOBox: false,
    poBoxNumber: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitCheck, setLimitCheck] = useState<{
    allowed: boolean;
    remaining: number;
    limit: number;
  } | null>(null);

  const handleAmountChange = async (value: string) => {
    setFormData({ ...formData, amount: value });
    
    if (value && formData.originCountry) {
      const amount = parseFloat(value);
      if (!isNaN(amount)) {
        // Convert to USD for limit checking
        const amountUSD = await PaymentLimitsService.convertToUSD(
          amount,
          formData.currency
        );
        
        const check = await PaymentLimitsService.checkLimit(
          formData.originCountry,
          amountUSD,
          formData.currency
        );
        
        setLimitCheck(check);
      }
    }
  };

  const handleCountryChange = async (country: string) => {
    setFormData({ ...formData, originCountry: country });
    
    if (formData.amount && country) {
      const amount = parseFloat(formData.amount);
      if (!isNaN(amount)) {
        const amountUSD = await PaymentLimitsService.convertToUSD(
          amount,
          formData.currency
        );
        
        const check = await PaymentLimitsService.checkLimit(
          country,
          amountUSD,
          formData.currency
        );
        
        setLimitCheck(check);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.originCountry) newErrors.originCountry = 'Origin country is required';
    if (!formData.destinationCountry) newErrors.destinationCountry = 'Destination country is required';
    if (!formData.amount) newErrors.amount = 'Amount is required';
    if (!formData.recipientName) newErrors.recipientName = 'Recipient name is required';
    if (!formData.recipientAccount) newErrors.recipientAccount = 'Recipient account is required';
    if (formData.usePOBox && !formData.poBoxNumber) newErrors.poBoxNumber = 'PO Box number is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Check limit
    const amount = parseFloat(formData.amount);
    const amountUSD = await PaymentLimitsService.convertToUSD(amount, formData.currency);
    const check = await PaymentLimitsService.checkLimit(
      formData.originCountry,
      amountUSD,
      formData.currency
    );

    if (!check.allowed) {
      setErrors({
        amount: `Payment limit exceeded. Maximum ${check.limit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per hour. Remaining: ${check.remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call to payment processor
      // Example providers: Stripe, Wise, PayPal, Western Union
      // const response = await fetch('/api/v1/payments/orders', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });

      // Record payment attempt
      PaymentLimitsService.recordPayment(
        formData.originCountry,
        amountUSD,
        formData.currency
      );

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('Payment order:', formData);

      // Redirect to confirmation or dashboard
      router.push('/dashboard?payment=success');
    } catch (error) {
      console.error('Payment error:', error);
      setErrors({ submit: 'An error occurred processing your payment. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const limit = formData.originCountry
    ? PaymentLimitsService.getLimitForCountry(formData.originCountry)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Send International Payment</CardTitle>
        <CardDescription>
          Complete the form below to send money internationally. Processing fee: 5% with settlement in 3-4 business days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-secondary-900">Payment Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Origin Country *
                </label>
                <select
                  value={formData.originCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select country</option>
                  <option value="US">United States</option>
                  <option value="BR">Brazil</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                  <option value="GB">United Kingdom</option>
                </select>
                {errors.originCountry && (
                  <p className="mt-1 text-sm text-accent-600">{errors.originCountry}</p>
                )}
                {limit && (
                  <p className="mt-1 text-xs text-secondary-500">
                    Limit: {limit.limitPerHour.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per hour
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Destination Country *
                </label>
                <select
                  value={formData.destinationCountry}
                  onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Select country</option>
                  <option value="US">United States</option>
                  <option value="BR">Brazil</option>
                  <option value="CA">Canada</option>
                  <option value="MX">Mexico</option>
                  <option value="GB">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                </select>
                {errors.destinationCountry && (
                  <p className="mt-1 text-sm text-accent-600">{errors.destinationCountry}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  label="Amount *"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  error={errors.amount}
                  placeholder="0.00"
                  required
                />
                {limitCheck && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    limitCheck.allowed
                      ? 'bg-success-50 text-success-700'
                      : 'bg-accent-50 text-accent-700'
                  }`}>
                    {limitCheck.allowed
                      ? `✓ Within limit. Remaining: ${limitCheck.remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
                      : `✗ Limit exceeded. Remaining: ${limitCheck.remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Currency *
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="BRL">BRL - Brazilian Real</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Payment Method *
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Select method</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="wire_transfer">Wire Transfer</option>
                <option value="swift">SWIFT</option>
                <option value="ach">ACH</option>
              </select>
            </div>
          </div>

          {/* Recipient Details */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-secondary-900">Recipient Details</h3>
            
            <Input
              label="Recipient Name *"
              type="text"
              value={formData.recipientName}
              onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
              error={errors.recipientName}
              required
            />

            <Input
              label="Recipient Account Number *"
              type="text"
              value={formData.recipientAccount}
              onChange={(e) => setFormData({ ...formData, recipientAccount: e.target.value })}
              error={errors.recipientAccount}
              required
            />

            <Input
              label="Recipient Bank (optional)"
              type="text"
              value={formData.recipientBank}
              onChange={(e) => setFormData({ ...formData, recipientBank: e.target.value })}
            />

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Recipient Address (optional)
              </label>
              <textarea
                value={formData.recipientAddress}
                onChange={(e) => setFormData({ ...formData, recipientAddress: e.target.value })}
                className="flex min-h-[100px] w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Full address..."
              />
            </div>

            {/* PO Box Option */}
            <div className="border-t pt-4">
              <POBoxCheckbox
                checked={formData.usePOBox}
                onCheckedChange={(checked) => setFormData({ ...formData, usePOBox: checked })}
                poBoxNumber={formData.poBoxNumber}
                onPOBoxNumberChange={(value) => setFormData({ ...formData, poBoxNumber: value })}
                error={errors.poBoxNumber}
              />
            </div>
          </div>

          {/* Fee Information */}
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
            <h4 className="font-semibold text-secondary-900 mb-2">Fee Information</h4>
            <ul className="text-sm text-secondary-700 space-y-1">
              <li>• Processing fee: 5% of transaction amount</li>
              <li>• Settlement time: 3-4 business days</li>
              <li>• Exchange rates: Competitive market rates</li>
            </ul>
          </div>

          {errors.submit && (
            <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
              <p className="text-sm text-accent-600">{errors.submit}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
          >
            Enviar pagamento internacional
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
