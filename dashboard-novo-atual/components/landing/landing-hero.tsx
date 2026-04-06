'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function LandingHero() {
  const [loadingPro, setLoadingPro] = useState(false);

  async function handleTestePro() {
    setLoadingPro(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successUrl: typeof window !== 'undefined' ? `${window.location.origin}/admin/painel?stripe=success` : undefined,
          cancelUrl: typeof window !== 'undefined' ? `${window.location.origin}` : undefined,
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || 'Erro ao criar sessão');
    } catch (e) {
      console.error(e);
      setLoadingPro(false);
      alert('Não foi possível iniciar o teste. Verifique se o Stripe está configurado.');
    }
  }

  return (
    <main className="min-h-screen pt-20 pb-12">
      <div className="container-custom">
        <section id="acesso" className="mb-14">
          <p className="text-xs font-medium uppercase tracking-wider text-secondary-400 mb-2">Acesso</p>
          <h1 className="text-3xl font-semibold tracking-tight text-secondary-800 sm:text-4xl mb-3">
            Crie seu espaço e comece a usar.
          </h1>
          <p className="text-base text-secondary-500 max-w-xl">
            Plano gratuito ou teste o Pro por 7 dias. Sem cartão no free; trial Pro com cancelamento fácil.
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6 max-w-4xl">
          <Card className="border-secondary-100 bg-white/80 p-5 shadow-sm">
            <CardContent className="p-0">
              <h2 className="text-lg font-medium text-secondary-800 mb-1.5">Plano gratuito</h2>
              <p className="text-sm text-secondary-500 mb-5">
                Acesso ao painel, faturas e recursos básicos.
              </p>
              <Link href="/admin/painel" className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-500 px-6 text-base font-semibold text-white hover:bg-primary-600">
                Free trial
              </Link>
            </CardContent>
          </Card>

          <Card className="border-secondary-100 bg-white/80 p-5 shadow-sm">
            <CardContent className="p-0">
              <h2 className="text-lg font-medium text-secondary-800 mb-1.5">Godroox Pro</h2>
              <p className="text-sm text-secondary-500 mb-5">
                Recursos avançados e suporte. Teste 7 dias grátis.
              </p>
              <Button
                variant="primary"
                size="md"
                className="bg-primary-500 hover:bg-primary-600"
                onClick={handleTestePro}
                isLoading={loadingPro}
                disabled={loadingPro}
              >
                Teste o Pro por 7 dias
              </Button>
            </CardContent>
          </Card>
        </div>

        <section id="como-funciona" className="mt-14 pt-10 border-t border-secondary-100">
          <h3 className="text-sm font-medium text-secondary-600 mb-3">Próximos passos</h3>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-secondary-500">
            <li>Criar conta (free trial ou Pro)</li>
            <li>Entrar no painel</li>
            <li>Usar faturas e recursos</li>
            <li>Desbloquear Pro no app (após trial)</li>
          </ol>
        </section>

        <section id="precos" className="mt-10 pt-10 border-t border-secondary-100">
          <h3 className="text-sm font-medium text-secondary-600 mb-2">Preços</h3>
          <p className="text-sm text-secondary-500 max-w-xl">
            Gratuito: recursos básicos. Pro: trial de 7 dias; depois assinatura mensal. Cancele quando quiser.
          </p>
        </section>

        <section id="faq" className="mt-10 pt-10 border-t border-secondary-100">
          <h3 className="text-sm font-medium text-secondary-600 mb-2">FAQ</h3>
          <p className="text-sm text-secondary-500 max-w-xl">
            Dúvidas? Entre em contato pelo painel ou e-mail de suporte.
          </p>
        </section>
      </div>
    </main>
  );
}
