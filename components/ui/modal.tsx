'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  showClose = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
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
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4" role="presentation">
          <motion.button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            className={cn(
              'relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-gm-lg border border-gm-border bg-gm-paper p-6 shadow-[0_20px_60px_rgba(0,0,0,.25)]',
              className,
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              {title ? (
                <h2 id="modal-title" className="font-heading text-xl font-semibold text-gm-ink">
                  {title}
                </h2>
              ) : (
                <span />
              )}
              {showClose ? (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="rounded-lg p-1 text-gm-ink-tertiary transition-colors hover:bg-gm-cream hover:text-gm-amber"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
