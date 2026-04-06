'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

interface BannerSlide {
  id: number;
  title: string;
  description: string;
  image: string;
  link: string;
  imageAlt: string;
}

const banners: BannerSlide[] = [
  {
    id: 1,
    title: 'Life Insurance',
    description: 'Protect your loved ones with comprehensive life insurance coverage. Secure your family\'s financial future with reliable protection tailored to your needs.',
    image: '/images/services/life-insurance.png',
    link: '/seguros-de-vida',
    imageAlt: 'Life Insurance - Goodrox Life',
  },
  {
    id: 2,
    title: 'Business Account Opening',
    description: 'Open your business in Florida quickly and easily. Complete company formation with expert guidance and professional support at every step.',
    image: '/images/services/business-account.png',
    link: '/llc-florida',
    imageAlt: 'Business Account Opening - Godroox Open',
  },
  {
    id: 3,
    title: 'International Payments',
    description: 'Send money internationally with competitive rates and low fees. Fast, secure, and traceable transfers worldwide in 120+ countries.',
    image: '/images/services/international-payments.png',
    link: '/pagamentos-internacionais',
    imageAlt: 'International Payments - Godroox Pay',
  },
  {
    id: 4,
    title: 'Godroox PRO',
    description: 'Master the stock market and options trading. Comprehensive education programs designed to help you succeed in trading and investing.',
    image: '/images/services/godroox-pro.png',
    link: '/godroox-pro',
    imageAlt: 'Godroox PRO - Stock Market Education',
  },
];

export function HeroCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 6000); // 6 seconds

    return () => clearInterval(interval);
  }, [isPaused]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000); // Resume after 10 seconds
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 10000);
  };

  const currentBanner = banners[currentSlide];

  return (
    <section className="relative w-full h-[500px] lg:h-[600px] overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div className="relative w-full h-full">
          <Image
            src={currentBanner.image}
            alt={currentBanner.imageAlt}
            fill
            className="object-cover"
            priority
          />
          {/* Dark overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-secondary-900/90 via-secondary-900/70 to-secondary-900/40" />
        </div>
      </div>

      {/* Content - Left Side */}
      <div className="relative z-10 container-custom h-full flex items-center">
        <div className="max-w-2xl text-white">
          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 lg:mb-6 leading-tight">
            {currentBanner.title}
          </h1>
          <p className="text-lg lg:text-xl text-white/90 mb-6 lg:mb-8 max-w-xl leading-relaxed">
            {currentBanner.description}
          </p>
          <Link href={currentBanner.link}>
            <Button 
              size="lg" 
              className="bg-secondary-900 hover:bg-secondary-800 text-white px-8 py-6 text-base lg:text-lg font-semibold rounded-lg shadow-lg"
            >
              Learn More
            </Button>
          </Link>
        </div>
      </div>

      {/* Carousel Controls - Bottom Center */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex items-center space-x-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
        <button
          onClick={prevSlide}
          className="text-white hover:text-primary-400 transition-colors p-1.5"
          aria-label="Previous slide"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => setIsPaused(!isPaused)}
          className="text-white hover:text-primary-400 transition-colors p-1.5"
          aria-label={isPaused ? 'Play' : 'Pause'}
        >
          {isPaused ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        {/* Slide Indicators */}
        <div className="flex items-center space-x-1.5">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`rounded-full transition-all ${
                index === currentSlide
                  ? 'w-6 h-2 bg-white'
                  : 'w-2 h-2 bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        <button
          onClick={nextSlide}
          className="text-white hover:text-primary-400 transition-colors p-1.5"
          aria-label="Next slide"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
