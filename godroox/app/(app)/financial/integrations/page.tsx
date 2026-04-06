'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const INTEGRATIONS = [
  { name: 'OCR', description: 'Extração de dados de notas fiscais e recibos', status: 'connected' },
  { name: 'APIs Bancárias', description: 'Importação de extratos e transações', status: 'connected' },
  { name: 'Mastercard Insights', description: 'Análise de transações com cartão', status: 'pending' },
  { name: 'Stripe / Plaid', description: 'Pagamentos e conectividade bancária', status: 'pending' },
  { name: 'KYC/AML', description: 'Verificação de identidade e compliance', status: 'pending' },
];

export default function IntegrationsPage() {
  return (
    <ModulePageShell
      title="Integrações Financeiras"
      description="OCR • APIs Bancárias • Mastercard • Stripe/Plaid • KYC/AML"
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {INTEGRATIONS.map((i) => (
            <Card key={i.name}>
              <CardHeader>
                <CardTitle className="text-base">{i.name}</CardTitle>
                <p className="text-sm text-secondary-500">{i.description}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      i.status === 'connected' ? 'bg-success-100 text-success-700' : 'bg-secondary-100 text-secondary-600'
                    }`}
                  >
                    {i.status === 'connected' ? 'Conectado' : 'Pendente'}
                  </span>
                  <Button size="sm" variant="outline">
                    {i.status === 'connected' ? 'Configurar' : 'Conectar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ModulePageShell>
  );
}
