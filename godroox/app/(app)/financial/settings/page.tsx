'use client';

import { ModulePageShell } from '@/components/financial/module-page-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLES = [
  { id: 'control_owner', label: 'Control Owner', description: 'Responsável por controles ICFR' },
  { id: 'internal_auditor', label: 'Auditor Interno', description: 'Testes de controles' },
  { id: 'external_auditor', label: 'Auditor Externo', description: 'Auditoria independente' },
  { id: 'compliance', label: 'Compliance', description: 'Conformidade SOX 404' },
  { id: 'cfo', label: 'CFO', description: 'Aprovações e certificações' },
];

const MOCK_USERS = [
  { email: 'maria@company.com', role: 'Control Owner', modules: ['AP', 'AR', 'ICFR'] },
  { email: 'joao@company.com', role: 'CFO', modules: ['all'] },
];

export default function SettingsPage() {
  return (
    <ModulePageShell
      title="Configurações e Permissões (RBAC)"
      description="Perfis • Dupla aprovação • Logs • Segurança corporativa"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Perfis de Acesso</CardTitle>
            <p className="text-sm text-secondary-500">Control Owner, Auditor Interno/Externo, Compliance, CFO</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ROLES.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-sm text-secondary-500">{r.description}</p>
                  </div>
                  <Button size="sm" variant="outline">Editar</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dupla Aprovação</CardTitle>
            <p className="text-sm text-secondary-500">Obrigatória para: Journal Entries, AP {'>'} $5K, etc.</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked />
                <span>Habilitar dupla aprovação para todos os lançamentos</span>
              </label>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" defaultChecked />
                <span>Habilitar dupla aprovação para AP {'>'} $5.000</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usuários e Permissões</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Usuário</th>
                    <th className="pb-2 font-medium">Perfil</th>
                    <th className="pb-2 font-medium">Módulos</th>
                    <th className="pb-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_USERS.map((u) => (
                    <tr key={u.email} className="border-b">
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">{u.modules.join(', ')}</td>
                      <td className="py-2">
                        <Button size="sm" variant="outline">Editar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs de Permissão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-secondary-500">
              Registro de alterações de permissões por usuário e data.
            </p>
          </CardContent>
        </Card>
      </div>
    </ModulePageShell>
  );
}
