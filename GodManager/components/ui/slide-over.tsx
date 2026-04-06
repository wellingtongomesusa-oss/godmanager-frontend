'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SlideOver({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-[480px]',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[550]" role="presentation">
          <motion.button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'slide-title' : undefined}
            className={cn(
              'absolute right-0 top-0 flex h-full w-full flex-col border-l border-gm-border bg-gm-paper shadow-[0_20px_60px_rgba(0,0,0,.18)]',
              widthClass,
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between border-b border-gm-border px-6 py-4">
              {title ? (
                <h2 id="slide-title" className="font-heading text-lg font-semibold text-gm-ink">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="rounded-lg p-2 text-gm-ink-tertiary hover:bg-gm-cream hover:text-gm-amber"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
