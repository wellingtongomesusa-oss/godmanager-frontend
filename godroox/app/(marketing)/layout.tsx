import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MarketTicker } from '@/components/market/market-ticker';
import { ChatWidget } from '@/components/chat/chat-widget';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketTicker />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
