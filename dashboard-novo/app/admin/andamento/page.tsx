'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AddAndamentoModal } from '@/components/admin/add-andamento-modal';
import { useLanguage } from '@/contexts/language-context';
import { formatCurrency } from '@/lib/utils';
import {
  getProjetos,
  togglePagamento,
  type ProjetoAndamento,
} from '@/services/admin/andamento.service';

export default function AndamentoPage() {
  const { t } = useLanguage();
  const [projetos, setProjetos] = useState<ProjetoAndamento[]>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const refresh = useCallback(() => {
    setProjetos(getProjetos());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    (projetoId: string, pagamentoId: string) => {
      togglePagamento(projetoId, pagamentoId);
      refresh();
    },
    [refresh]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-secondary-900">{t('andamento.title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            {t('sidebar.refresh')}
          </Button>
          <Button onClick={() => setAddModalOpen(true)} size="lg" className="shadow-lg">
            {t('andamento.add')}
          </Button>
        </div>
      </div>

      {projetos.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('andamento.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-secondary-600">{t('andamento.empty')}</p>
            <Button className="mt-4" onClick={() => setAddModalOpen(true)}>
              {t('andamento.add')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projetos.map((proj) => (
            <Card key={proj.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex flex-wrap items-center gap-4">
                  <span>{t('andamento.valorEntrada')}: {formatCurrency(proj.valorEntrada, 'BRL')}</span>
                  <span>{t('andamento.valorParcela')}: {formatCurrency(proj.valorParcela, 'BRL')}</span>
                  <span className="text-sm font-normal text-secondary-500">{proj.createdAt}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm font-medium text-secondary-700">{t('andamento.pagamentos')}</p>
                <div className="flex flex-wrap gap-4">
                  {proj.pagamentos.map((pag) => (
                    <label
                      key={pag.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2 text-sm hover:bg-secondary-100"
                    >
                      <input
                        type="checkbox"
                        checked={pag.pago}
                        onChange={() => handleToggle(proj.id, pag.id)}
                        className="h-4 w-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className={pag.pago ? 'text-secondary-500 line-through' : 'text-secondary-900'}>
                        {pag.label}
                      </span>
                      {pag.pago && <span className="text-xs text-primary-600">✓ {t('andamento.pago')}</span>}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddAndamentoModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={refresh} />
    </div>
  );
}
