'use client';

interface ChatButtonProps {
  isOpen: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

/**
 * Botão flutuante que abre/fecha o chat.
 * Acessibilidade: aria-expanded, aria-label, focus visible.
 */
export function ChatButton({ isOpen, onToggle }: ChatButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="h-14 w-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/50 flex items-center justify-center transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      {isOpen ? (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )}
    </button>
  );
}
