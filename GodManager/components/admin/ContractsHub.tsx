'use client';

import { useMemo, useState } from 'react';
import { ContractsAdmin } from './ContractsAdmin';
import { LeasesAdmin } from './LeasesAdmin';

/**
 * Hub do menu Contratos: abas "Contratos por casa" (upload do arquivo do contrato, já existente)
 * e "Leases / Novo contrato" (LeaseAgreement — cria e gerencia contratos FL).
 */
export function ContractsHub() {
  const params = useMemo(() => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const clientId = params.get('clientId') || '';
  const embed = params.get('embed') === '1';
  const initialTab = params.get('tab') === 'leases' ? 'leases' : 'files';
  const [tab, setTab] = useState<'files' | 'leases'>(initialTab);

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg cursor-pointer ${
      active ? 'bg-[#22558c] text-white' : 'bg-transparent text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="w-full">
      {/* Quando embutido no monólito (embed=1), a barra de abas fica no monólito — não duplicar aqui. */}
      {!embed && (
        <div className="flex gap-1 border-b border-slate-200 px-6 pt-4 sm:px-8">
          <button className={tabCls(tab === 'files')} onClick={() => setTab('files')}>
            Contratos por casa
          </button>
          <button className={tabCls(tab === 'leases')} onClick={() => setTab('leases')}>
            Leases / Novo contrato
          </button>
        </div>
      )}
      {tab === 'files' ? <ContractsAdmin /> : <LeasesAdmin clientId={clientId} />}
    </div>
  );
}
