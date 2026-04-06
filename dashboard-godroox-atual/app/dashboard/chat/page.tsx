'use client';

import { AiChat } from '@/components/chat/ai-chat';

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-brex-black tracking-tight">Assistente Grok AI</h2>
        <p className="mt-1.5 text-sm text-secondary-600">
          Converse com o assistente inteligente powered by xAI (Grok).
        </p>
      </div>
      <div className="h-[calc(100vh-220px)] min-h-[500px]">
        <AiChat />
      </div>
    </div>
  );
}
