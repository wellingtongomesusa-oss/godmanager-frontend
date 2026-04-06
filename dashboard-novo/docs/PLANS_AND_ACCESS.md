# Planos, acesso e integrações

## Planos e níveis de acesso (RBAC)

- **Plano 1 – Básico:** Apenas Painel, Cadastro, Novos Projetos
- **Plano 2 – Intermediário:** Plano 1 + Invoice, Juros compostos, Calculadora, Bills, GAAP, AR/AP, 1099
- **Plano 3 – Avançado:** Todo o menu + Cadastro vira dropdown de departamentos + 10% desconto + E-mail profissional

O plano é persistido em `localStorage` (`godcrm_plan`) e pode ser alterado pelo seletor no header.  
Variável de ambiente: `NEXT_PUBLIC_DEFAULT_PLAN` (1, 2 ou 3).

Ver `docs/RBAC_AND_DEPARTMENTS.md` para detalhes completos do RBAC e departamentos.

## Menu lateral

Ordem fixa:

1. Painel  
2. Cadastro (Plano 3: dropdown com departamentos + Add+)  
3. Novos projetos  

Depois, itens por plano (Invoice, Juros, Calculadora, Automação, Bills, Caixa de E-mail, 1099, Tax, GAAP, Relatórios, etc.).  
Link **Dashboard Godroox** (porta 3001): `NEXT_PUBLIC_GODROOX_DASHBOARD_URL`.

## Guard de rota

O `PlanGuard` no layout admin verifica o plano antes de exibir cada módulo. Rotas com plano mínimo superior ao do usuário redirecionam para `/admin/painel`.

## Caixa de E-mail

- Módulo em `/admin/email`.
- Conectar e-mail pessoal (Gmail, Outlook, etc.) – mock; integrar Gmail API / Microsoft Graph via env.
- Ver caixa de entrada (mock) e enviar e-mail (mock).
- Serviço: `services/email-inbox.service.ts`.

## E-mail profissional @godcrm.com (Plano 3)

- Formulário na própria página de Caixa de E-mail quando o plano é 3.
- Solicitação de endereço `nome@godcrm.com`; armazenamento mock em `localStorage`.
- Serviço: `services/professional-email.service.ts`.  
- Domínio: `NEXT_PUBLIC_EMAIL_DOMAIN` (default `godcrm.com`).

## Variáveis de ambiente

Ver `.env.example`: `GODROOX_DASHBOARD_URL`, `DEFAULT_PLAN`, `EMAIL_*`, etc.
