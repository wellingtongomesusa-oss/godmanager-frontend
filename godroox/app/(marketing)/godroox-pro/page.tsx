'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';

export default function GodrooxPROPage() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [accountBalance] = useState(1285.76);
  const [dailyChange] = useState({ amount: -8.03, percent: -0.62 });

  const timeframes = ['LIVE', '1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];

  const services = [
    {
      title: 'Life Insurance',
      subtitle: 'Seguros de Vida',
      description: 'Comprehensive life insurance coverage tailored to your needs.',
      icon: '🛡️',
      href: '/seguros-de-vida',
      change: '+0.33%',
      changeColor: 'text-success-400',
    },
    {
      title: 'Business Account Opening',
      subtitle: 'Abertura de Contas Empresas',
      description: 'Open business accounts and manage your company finances.',
      icon: '🏢',
      href: '/llc-florida',
      change: '-0.52%',
      changeColor: 'text-danger-400',
    },
    {
      title: 'International Payments',
      subtitle: 'Pagamentos Internacionais',
      description: 'Send money internationally with competitive rates.',
      icon: '✈️',
      href: '/pagamentos-internacionais',
      change: '0.00%',
      changeColor: 'text-secondary-400',
    },
  ];

  return (
    <div className="min-h-screen bg-secondary-900 text-white">
      {/* Header */}
      <header className="border-b border-secondary-800 bg-secondary-900">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Logo size="md" />
              </Link>
              <div className="hidden md:flex items-center space-x-6">
                <Link href="/godroox-pro" className="text-sm font-medium text-white hover:text-primary-400">
                  Godroox PRO
                </Link>
                <Link href="/services" className="text-sm font-medium text-secondary-400 hover:text-white">
                  Services
                </Link>
                <Link href="/investing" className="text-sm font-medium text-secondary-400 hover:text-white">
                  Investing
                </Link>
                <Link href="/crypto" className="text-sm font-medium text-secondary-400 hover:text-white">
                  Crypto
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="text-white hover:bg-secondary-800">
                Account
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container-custom py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Account Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Account Balance */}
            <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-secondary-400">Individual</span>
                  <svg className="h-4 w-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="mb-2">
                <div className="text-4xl font-bold text-white mb-1">
                  ${accountBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-danger-400 text-sm">▼${Math.abs(dailyChange.amount).toFixed(2)}</span>
                  <span className="text-danger-400 text-sm">({dailyChange.percent.toFixed(2)}%)</span>
                  <span className="text-secondary-400 text-sm">Today</span>
                </div>
              </div>
            </div>

            {/* Performance Graph */}
            <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700">
              <div className="h-64 bg-secondary-900 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                {/* Simulated Graph Line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <polyline
                    points="0,180 50,170 100,160 150,150 200,140 250,130 300,120 350,110 400,190"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="3"
                  />
                  {/* Dotted baseline */}
                  <line x1="0" y1="180" x2="400" y2="180" stroke="#374151" strokeWidth="1" strokeDasharray="5,5" />
                </svg>
              </div>
              
              {/* Timeframe Selectors */}
              <div className="flex items-center space-x-4 overflow-x-auto">
                {timeframes.map((timeframe) => (
                  <button
                    key={timeframe}
                    onClick={() => setSelectedTimeframe(timeframe)}
                    className={`px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap ${
                      selectedTimeframe === timeframe
                        ? 'text-primary-400 border-b-2 border-primary-400'
                        : 'text-secondary-400 hover:text-white'
                    }`}
                  >
                    {timeframe === 'LIVE' ? '• LIVE' : timeframe}
                  </button>
                ))}
              </div>
            </div>

            {/* Buying Power */}
            <div className="bg-secondary-800 rounded-xl p-6 border border-secondary-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-secondary-400">Buying power</span>
                  <svg className="h-4 w-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-semibold">$0.00</span>
                  <svg className="h-4 w-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <svg className="h-4 w-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Services */}
          <div className="space-y-6">
            {/* Promotional Banner */}
            <div className="bg-primary-600 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <span className="text-2xl">🎁</span>
                <span className="text-white font-semibold">Premium Features</span>
              </div>
              <p className="text-sm text-primary-100">Unlock exclusive benefits</p>
            </div>

            {/* Services Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
              
              {services.map((service, index) => (
                <Link key={index} href={service.href}>
                  <div className="bg-secondary-800 rounded-lg p-4 border border-secondary-700 hover:border-primary-500 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{service.icon}</div>
                        <div>
                          <div className="text-white font-semibold text-sm">{service.title}</div>
                          <div className="text-secondary-400 text-xs">{service.subtitle}</div>
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${service.changeColor}`}>
                        {service.change}
                      </div>
                    </div>
                    <div className="h-8 bg-secondary-900 rounded flex items-center justify-center">
                      {/* Mini graph placeholder */}
                      <div className="w-full h-full flex items-end justify-center space-x-0.5 px-2">
                        {[...Array(20)].map((_, i) => (
                          <div
                            key={i}
                            className={`flex-1 ${
                              service.change.includes('-')
                                ? 'bg-danger-400'
                                : service.change.includes('+')
                                ? 'bg-success-400'
                                : 'bg-secondary-600'
                            }`}
                            style={{ height: `${Math.random() * 60 + 20}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-secondary-400">
                      {service.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
