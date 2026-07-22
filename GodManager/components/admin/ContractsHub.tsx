'use client';

import { useMemo, useState } from 'react';
import { ContractsAdmin } from './ContractsAdmin';
import { LeasesAdmin } from './LeasesAdmin';

/**
 * Hub do menu Contratos: abas "Contratos por casa" (upload do arquivo do contrato, já existente)
 * e "Leases / Novo contrato" (LeaseAgreement — cria e gerencia contratos FL).
 */
export function ContractsHub() {
  const [tab, setTab] = useState<'files' | 'leases'>('files');
  const clientId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('clientId') || '';
  }, []);

  const tabCls = (active: boolean) =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg cursor-pointer ${
      active ? 'bg-[#22558c] text-white' : 'bg-transparent text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className="w-full">
      <div className="flex gap-1 border-b border-slate-200 px-6 pt-4 sm:px-8">
        <button className={tabCls(tab === 'files')} onClick={() => setTab('files')}>
          Contratos por casa
        </button>
        <button className={tabCls(tab === 'leases')} onClick={() => setTab('leases')}>
          Leases / Novo contrato
        </button>
      </div>
      {tab === 'files' ? <ContractsAdmin /> : <LeasesAdmin clientId={clientId} />}
    </div>
  );
}
