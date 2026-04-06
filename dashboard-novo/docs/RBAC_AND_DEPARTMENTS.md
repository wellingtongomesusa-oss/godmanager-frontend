# RBAC e Departamentos – GodCRM

## Visão geral

O dashboard-novo implementa controle de acesso baseado em plano (RBAC) e, para o Plano 3, um sistema de departamentos com dashboards exclusivos.

## Planos e permissões

### Plano 1 – Básico
- **Menu:** Apenas 3 itens:
  1. Painel
  2. Cadastro
  3. Novos Projetos
- Demais opções ficam ocultas.

### Plano 2 – Intermediário
- **Menu:** Tudo do Plano 1 +
  - Invoice
  - Juros Compostos
  - Calculadora Financeira
  - Contas a Pagar (Bills)
  - GAAP
  - AR/AP
  - 1099

### Plano 3 – Avançado / Premium
- **Menu:** Todo o menu lateral +
  - IRS/TAX
  - Automação
  - Caixa de E-mail
  - Pagamentos
  - Payout
  - Andamento do projeto
- **Cadastro:** vira dropdown com lista de departamentos e botão Add+.

## PermissionService

**Arquivo:** `services/permission.service.ts`

### Funções principais

- `getMenuPermissions(plan)` – retorna itens do menu permitidos e flags (`canAccessCadastroDropdown`, `canCreateDepartments`)
- `canAccessPath(pathname, plan)` – verifica se a rota pode ser acessada
- `hasResourceAccess(plan, requiredPlan)` – verifica acesso ao recurso
- `canAccessDepartment(plan, departmentId, userDepartments?)` – verifica acesso ao departamento (Plano 3)

## API de Departamentos

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/departamentos` | Lista todos os departamentos |
| POST | `/api/departamentos` | Cria departamento. Body: `{ name, description? }` |
| GET | `/api/departamentos/[id]` | Retorna um departamento |
| PATCH | `/api/departamentos/[id]` | Atualiza departamento. Body: `{ name?, description? }` |
| DELETE | `/api/departamentos/[id]` | Remove departamento |

### Estrutura de Department

```ts
interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Dashboards por Departamento

- **Rota:** `/admin/departamentos/[id]`
- **Acesso:** Apenas Plano 3
- Cada departamento possui:
  - KPIs (herdados do workflow principal)
  - Tabela de transações/pedidos
  - Botão Add+ para nova demanda
  - Workflow de dupla aprovação

O layout e os componentes são os mesmos do painel principal, reutilizando `KpiCards`, `TransactionsTable` e `AddDemandModal`.

## Cadastro com Dropdown (Plano 3)

No item **Cadastro** do menu lateral:
- Abre dropdown com lista de departamentos
- Cada departamento é link para `/admin/departamentos/[id]`
- Botão **Add+** abre modal para criar novo departamento
- Modal: nome (obrigatório) e descrição (opcional)

## Rotas protegidas

Definidas em `lib/plans.ts` em `ROUTE_MIN_PLAN`:

- `/admin/painel`, `/admin/cadastro`, `/admin/projeto` → Plano 1
- `/admin/invoices`, `/admin/juros-compostos`, `/admin/bills`, etc. → Plano 2
- `/admin/tax`, `/admin/automation`, `/admin/departamentos` → Plano 3

O `PlanGuard` no layout admin redireciona para `/admin/painel` se o plano for insuficiente.

## Como testar

1. Alterar o plano no header (dropdown "Plano atual")
2. Plano 1: apenas Painel, Cadastro, Novos Projetos
3. Plano 2: itens adicionais + 1099
4. Plano 3: todo o menu; em Cadastro, abrir dropdown e criar departamento com Add+

## Persistência

- **Plano:** `localStorage` (`godcrm_plan`)
- **Departamentos:** Store em memória no servidor (API). Para produção, integrar com banco de dados.
