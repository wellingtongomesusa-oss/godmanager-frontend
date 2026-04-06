'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_INTERVAL_MS = 6000;
const PAUSE_AFTER_INTERACTION_MS = 10000;

/**
 * Hook para carrossel com autoplay a cada N ms.
 * - currentSlide: índice atual (0 até slideCount - 1).
 * - setCurrentSlide: vai para um slide específico (pausa temporariamente).
 * - isPaused: true durante a pausa após interação manual.
 * - pauseTemporarily: pausa o autoplay por PAUSE_AFTER_INTERACTION_MS.
 * - nextSlide / prevSlide: avança/volta e pausa temporariamente.
 * O setInterval é criado uma vez no mount e limpo no unmount; o callback
 * só avança se !pausedRef.current, evitando travamentos.
 */
export function useCarouselAutoplay(
  slideCount: number,
  intervalMs: number = DEFAULT_INTERVAL_MS
) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  pausedRef.current = isPaused;

  useEffect(() => {
    if (slideCount <= 0) return;

    intervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [slideCount, intervalMs]);

  const pauseTemporarily = useCallback(() => {
    setIsPaused(true);
    const t = setTimeout(() => setIsPaused(false), PAUSE_AFTER_INTERACTION_MS);
    return () => clearTimeout(t);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index % slideCount);
    pauseTemporarily();
  }, [slideCount, pauseTemporarily]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slideCount);
    pauseTemporarily();
  }, [slideCount, pauseTemporarily]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);
    pauseTemporarily();
  }, [slideCount, pauseTemporarily]);

  return {
    currentSlide,
    setCurrentSlide: goToSlide,
    isPaused,
    setIsPaused,
    nextSlide,
    prevSlide,
    goToSlide,
  };
}
