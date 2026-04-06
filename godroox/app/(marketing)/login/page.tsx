'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/v1/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo: Check if it's admin (you can set this in localStorage or session)
      // In production, this would come from the API response
      const isAdmin = formData.email === 'admin@godroox.com';
      
      // Check if user exists (in demo, accept any email with any password)
      // In production, verify password hash
      const userExists = true; // Simulated check
      
      if (!userExists) {
        setErrors({ submit: 'Invalid email or password. Please try again.' });
        setIsSubmitting(false);
        return;
      }
      
      // Store auth state (in production, use secure session/JWT)
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify({
          email: formData.email,
          role: isAdmin ? 'admin' : 'user',
          verified: true,
        }));
      }
      
      // Redirect based on role
      if (isAdmin) {
        router.push('/admin/dashboard');
      } else {
        router.push('/services');
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white py-12">
      <div className="container-custom">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                Access your Godroox account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showSuccess && (
                <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-lg">
                  <p className="text-sm text-success-700">
                    Account created successfully! Please sign in.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    error={errors.email}
                    placeholder="john@example.com"
                    required
                  />
                </div>
                <div>
                  <Input
                    label="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    error={errors.password}
                    required
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-secondary-600">Remember me</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Forgot password?
                  </Link>
                </div>

                {errors.submit && (
                  <div className="p-3 bg-accent-50 border border-accent-200 rounded-lg">
                    <p className="text-sm text-accent-600">{errors.submit}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" isLoading={isSubmitting}>
                  Sign In
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-secondary-600">
                  Don't have an account?{' '}
                  <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
                    Sign up
                  </Link>
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-secondary-200">
                <p className="text-xs text-secondary-500 text-center">
                  Demo: Use <code className="bg-secondary-100 px-1 rounded">admin@godroox.com</code> to access admin dashboard
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
