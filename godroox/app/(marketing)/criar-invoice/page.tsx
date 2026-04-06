import { CriarInvoiceForm } from '@/components/invoice/criar-invoice-form';

export const metadata = {
  title: 'Criar Invoice | Godroox',
  description: 'Crie e compartilhe invoices de forma simples e rápida. Godroox - plataforma de serviços financeiros.',
};

export default function CriarInvoicePage() {
  return (
    <section className="py-16 sm:py-24 min-h-[60vh]">
      <div className="container-custom">
        <CriarInvoiceForm />
      </div>
    </section>
  );
}
