'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { verificationService } from '@/services/auth/verification.service';
import { POBoxCheckbox } from '@/components/forms/po-box-checkbox';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [verificationStep, setVerificationStep] = useState<'email' | 'sms' | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [formData, setFormData] = useState({
    // Basic Information (Step 1)
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    country: '',
    
    // AML/KYC Compliance Data (Step 2)
    dateOfBirth: '',
    documentType: '',
    documentNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    
    // Account Purpose (Step 3)
    accountPurpose: '',
    additionalInfo: '',
    
    // PO Box option
    usePOBox: false,
    poBoxNumber: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    if (!formData.phone) newErrors.phone = 'Phone is required';
    if (!formData.country) newErrors.country = 'Country is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.dateOfBirth) newErrors.dateOfBirth = 'Date of birth is required';
    if (!formData.documentType) newErrors.documentType = 'Document type is required';
    if (!formData.documentNumber) newErrors.documentNumber = 'Document number is required';
    if (!formData.address.street) newErrors['address.street'] = 'Street address is required';
    if (!formData.address.city) newErrors['address.city'] = 'City is required';
    if (!formData.address.state) newErrors['address.state'] = 'State/Province is required';
    if (!formData.address.zipCode) newErrors['address.zipCode'] = 'ZIP/Postal code is required';
    if (!formData.address.country) newErrors['address.country'] = 'Country is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendCode = async (method: 'email' | 'sms') => {
    setIsSendingCode(true);
    setErrors({});
    
    try {
      if (method === 'email') {
        await verificationService.sendEmailCode(formData.email);
        setVerificationStep('email');
      } else {
        await verificationService.sendSMSCode(formData.phone);
        setVerificationStep('sms');
      }
      setCodeSent(true);
    } catch (error) {
      setErrors({ submit: 'Failed to send verification code. Please try again.' });
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const emailOrPhone = verificationStep === 'email' ? formData.email : formData.phone;
    const isValid = await verificationService.verifyCode(emailOrPhone, verificationCode);
    
    if (isValid) {
      setVerificationStep(null);
      setCodeSent(false);
      setVerificationCode('');
      // Continue to next step
      if (step === 1) {
        setStep(2);
      }
    } else {
      setErrors({ verification: 'Invalid verification code. Please try again.' });
    }
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      // Show verification step
      setVerificationStep('email');
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (verificationStep) {
      setVerificationStep(null);
      setCodeSent(false);
      setVerificationCode('');
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Sign up data:', formData);
      
      // Redirect to login
      router.push('/login?registered=true');
    } catch (error) {
      console.error('Sign up error:', error);
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

  // Verification step UI
  if (verificationStep) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white py-12">
        <div className="container-custom">
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl text-center">Verify Your {verificationStep === 'email' ? 'Email' : 'Phone'}</CardTitle>
                <CardDescription className="text-center">
                  We've sent a verification code to your {verificationStep === 'email' ? 'email' : 'phone'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-primary-800">
                      Code sent to: <strong>{verificationStep === 'email' ? formData.email : formData.phone}</strong>
                    </p>
                    {!codeSent && (
                      <p className="text-xs text-primary-600 mt-2">
                        Click the button below to receive your verification code.
                      </p>
                    )}
                  </div>

                  {!codeSent ? (
                    <div className="space-y-4">
                      <Button
                        type="button"
                        onClick={() => handleSendCode(verificationStep)}
                        className="w-full"
                        isLoading={isSendingCode}
                      >
                        Send Verification Code
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setVerificationStep(null);
                        }}
                        className="w-full"
                      >
                        Back
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Input
                          label="Verification Code"
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          error={errors.verification}
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          required
                        />
                        <p className="text-xs text-secondary-500 mt-1">
                          Enter the 6-digit code sent to your {verificationStep === 'email' ? 'email' : 'phone'}
                        </p>
                      </div>

                      {errors.verification && (
                        <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
                          <p className="text-sm text-accent-600">{errors.verification}</p>
                        </div>
                      )}

                      <div className="flex gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleBack}
                          className="flex-1"
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          onClick={handleVerifyCode}
                          className="flex-1"
                          disabled={verificationCode.length !== 6}
                        >
                          Verify
                        </Button>
                      </div>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => handleSendCode(verificationStep)}
                          className="text-sm text-primary-600 hover:text-primary-700"
                          disabled={isSendingCode}
                        >
                          Resend Code
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white py-12">
      <div className="container-custom">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-center">Create Your Account</CardTitle>
              <CardDescription className="text-center">
                Step {step} of 3: {step === 1 ? 'Basic Information' : step === 2 ? 'Identity Verification' : 'Account Purpose'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                {/* Step 1: Basic Information */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <Input
                        label="Full Name"
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        error={errors.fullName}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        error={errors.email}
                        placeholder="john@example.com"
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        error={errors.phone}
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Country of Residence *
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => updateField('country', e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select a country</option>
                        <option value="US">United States</option>
                        <option value="BR">Brazil</option>
                        <option value="CA">Canada</option>
                        <option value="MX">Mexico</option>
                        <option value="GB">United Kingdom</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="ES">Spain</option>
                        <option value="PT">Portugal</option>
                        <option value="OTHER">Other</option>
                      </select>
                      {errors.country && (
                        <p className="mt-1 text-sm text-accent-600">{errors.country}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        label="Password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        error={errors.password}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        label="Confirm Password"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => updateField('confirmPassword', e.target.value)}
                        error={errors.confirmPassword}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: AML/KYC Compliance */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-primary-800">
                        <strong>AML/KYC Compliance:</strong> We are required to collect this information
                        to comply with Anti-Money Laundering regulations. This data will be securely
                        processed and stored.
                      </p>
                    </div>
                    
                    <div>
                      <Input
                        label="Date of Birth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => updateField('dateOfBirth', e.target.value)}
                        error={errors.dateOfBirth}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Document Type *
                      </label>
                      <select
                        value={formData.documentType}
                        onChange={(e) => updateField('documentType', e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select document type</option>
                        <option value="passport">Passport</option>
                        <option value="drivers_license">Driver's License</option>
                        <option value="national_id">National ID</option>
                        <option value="ssn">Social Security Number (SSN)</option>
                      </select>
                      {errors.documentType && (
                        <p className="mt-1 text-sm text-accent-600">{errors.documentType}</p>
                      )}
                    </div>
                    <div>
                      <Input
                        label="Document Number"
                        type="text"
                        value={formData.documentNumber}
                        onChange={(e) => updateField('documentNumber', e.target.value)}
                        error={errors.documentNumber}
                        placeholder="Enter your document number"
                        required
                      />
                    </div>
                    <div className="border-t pt-4">
                      <h3 className="text-lg font-semibold mb-4">Complete Address</h3>
                      <div className="space-y-4">
                        <Input
                          label="Street Address"
                          type="text"
                          value={formData.address.street}
                          onChange={(e) => updateField('address.street', e.target.value)}
                          error={errors['address.street']}
                          required
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            label="City"
                            type="text"
                            value={formData.address.city}
                            onChange={(e) => updateField('address.city', e.target.value)}
                            error={errors['address.city']}
                            required
                          />
                          <Input
                            label="State/Province"
                            type="text"
                            value={formData.address.state}
                            onChange={(e) => updateField('address.state', e.target.value)}
                            error={errors['address.state']}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            label="ZIP/Postal Code"
                            type="text"
                            value={formData.address.zipCode}
                            onChange={(e) => updateField('address.zipCode', e.target.value)}
                            error={errors['address.zipCode']}
                            required
                          />
                          <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Country *
                            </label>
                            <select
                              value={formData.address.country}
                              onChange={(e) => updateField('address.country', e.target.value)}
                              className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              required
                            >
                              <option value="">Select a country</option>
                              <option value="US">United States</option>
                              <option value="BR">Brazil</option>
                              <option value="CA">Canada</option>
                              <option value="OTHER">Other</option>
                            </select>
                            {errors['address.country'] && (
                              <p className="mt-1 text-sm text-accent-600">{errors['address.country']}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Account Purpose */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Account Purpose *
                      </label>
                      <select
                        value={formData.accountPurpose}
                        onChange={(e) => updateField('accountPurpose', e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select purpose</option>
                        <option value="international_payments">International Payments</option>
                        <option value="receiving_payments">Receiving Payments</option>
                        <option value="investments">Investments</option>
                        <option value="business_operations">Business Operations</option>
                        <option value="personal_use">Personal Use</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Additional Information (optional)
                      </label>
                      <textarea
                        value={formData.additionalInfo}
                        onChange={(e) => updateField('additionalInfo', e.target.value)}
                        className="flex min-h-[120px] w-full rounded-lg border border-secondary-300 bg-white px-4 py-2 text-sm text-secondary-900 placeholder:text-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Tell us more about how you plan to use your account..."
                      />
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
                  </div>
                )}

                {errors.submit && (
                  <div className="mt-4 p-3 bg-accent-50 border border-accent-200 rounded-lg">
                    <p className="text-sm text-accent-600">{errors.submit}</p>
                  </div>
                )}

                <div className="flex gap-4 mt-6">
                  {(step > 1 || verificationStep) && (
                    <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                      Back
                    </Button>
                  )}
                  {step < 3 ? (
                    <Button type="button" onClick={handleNext} className="flex-1">
                      Next
                    </Button>
                  ) : (
                    <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                      Create Account
                    </Button>
                  )}
                </div>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-secondary-600">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
