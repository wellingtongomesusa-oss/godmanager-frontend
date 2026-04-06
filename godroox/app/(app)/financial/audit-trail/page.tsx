'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const MOCK_LOGS = [
  { id: '1', action: 'JOURNAL_ENTRY_APPROVED', entityType: 'JournalEntry', entityId: 'JE-002', user: 'maria@company.com', timestamp: '2025-03-10 14:32:00' },
  { id: '2', action: 'AP_INVOICE_CREATED', entityType: 'APInvoice', entityId: 'INV-005', user: 'joao@company.com', timestamp: '2025-03-10 13:15:00' },
  { id: '3', action: 'CONTROL_TEST_RECORDED', entityType: 'ControlTest', entityId: 'CT-012', user: 'auditor@firm.com', timestamp: '2025-03-10 11:45:00' },
  { id: '4', action: 'DEFICIENCY_REMEDIATED', entityType: 'Deficiency', entityId: 'DEF-003', user: 'ana@company.com', timestamp: '2025-03-10 10:20:00' },
  { id: '5', action: 'BANK_RECONCILIATION_COMPLETED', entityType: 'BankReconciliation', entityId: 'REC-002', user: 'carlos@company.com', timestamp: '2025-03-09 16:00:00' },
];

export default function AuditTrailPage() {
  return (
    <ModulePageShell
      title="Trilha de Auditoria (Audit Trail)"
      description="Log imutável • Ações • Usuário • Data/hora • Evidências • Alterações"
    >
      <div className="space-y-6">
        <div className="flex gap-4">
          <Input placeholder="Filtrar por ação..." className="max-w-xs" />
          <Input placeholder="Filtrar por entidade..." className="max-w-xs" />
          <Input type="date" className="max-w-xs" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log de Auditoria</CardTitle>
            <p className="text-sm text-secondary-500">Registro imutável - PCAOB/SEC compliant</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Data/Hora</th>
                    <th className="pb-2 font-medium">Usuário</th>
                    <th className="pb-2 font-medium">Ação</th>
                    <th className="pb-2 font-medium">Entidade</th>
                    <th className="pb-2 font-medium">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_LOGS.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="py-2 font-mono text-xs">{log.timestamp}</td>
                      <td className="py-2">{log.user}</td>
                      <td className="py-2">
                        <span className="rounded bg-primary-100 px-2 py-0.5 text-xs font-medium">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2">{log.entityType}</td>
                      <td className="py-2 font-mono">{log.entityId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModulePageShell>
  );
}
