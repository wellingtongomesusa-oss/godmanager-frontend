'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook para controle de abertura/fechamento do chat.
 * - Estado explícito isChatOpen (boolean).
 * - toggle abre/fecha; close fecha; listener de clique fora fecha o painel.
 */
export function useChatOpen() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const open = useCallback(() => setIsChatOpen(true), []);
  const close = useCallback(() => setIsChatOpen(false), []);
  const toggle = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsChatOpen((prev) => !prev);
  }, []);

  // Fechar ao clicar fora do container (botão + painel)
  useEffect(() => {
    if (!isChatOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsChatOpen(false);
      }
    }

    // Usar setTimeout para não fechar no mesmo clique que abriu
    const timeoutId = window.setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isChatOpen]);

  return { isChatOpen, open, close, toggle, containerRef };
}
