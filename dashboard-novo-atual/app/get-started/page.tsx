import { InvoiceFormCard } from '@/components/invoice-tool';
import Link from 'next/link';

export const metadata = {
  title: 'Get Started – Invoice Tool',
  description: 'Create your invoice. Choose a plan and fill in the details.',
};

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-medium text-[#333] hover:opacity-90">
            ← Voltar
          </Link>
          <span className="text-sm text-[#666]">Configuração da fatura</span>
        </div>
      </header>
      <main className="py-12">
        <InvoiceFormCard />
      </main>
    </div>
  );
}
