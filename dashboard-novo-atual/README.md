# GodCRM

**GodCRM** — painel administrativo com planos, módulos (Invoice, Bills, GAAP, IRS/TAX, etc.), Caixa de E-mail, integração ao Dashboard Godroox e mais.

## Como rodar

```bash
cd GodCRM    # ou cd dashboard-novo, se a pasta ainda não foi renomeada
npm install  # obrigatório — evita "Module not found: jspdf"
npm run dev
```

Acesse: **http://localhost:3000** (ou a porta indicada no terminal). A rota `/` redireciona para `/admin/painel`.

**Renomear a pasta para GodCRM:** feche o projeto no editor, renomeie `dashboard-novo` → `GodCRM` no disco e reabra a pasta `GodCRM`. O `package.json` já está como `godcrm`.

**Erro "Module not found: jspdf"?** Rode `npm install` no diretório do projeto. O PDF (invoices, GAAP, export) usa `jspdf` e `jspdf-autotable`.

## O que tem

- **Painel** em `/admin/painel`: KPIs, gráficos, transações, dupla alçada.
- **Cadastro** em `/admin/cadastro`, **Novos projetos** em `/admin/projeto`.
- **Planos 1/2/3** com níveis de acesso; seletor de plano no header.
- **Menu lateral** dinâmico (Painel, Cadastro, Novos projetos, Invoice, Juros, Calculadora, Automação, Bills, Caixa de E-mail, etc.) e link **Dashboard Godroox**.
- **Export CSV / PDF** no header.
- **Calculadora financeira**, **Juros compostos**, **GAAP**, **IRS/TAX**, **Bills**, **Automação**, **Relatórios A/P**, etc.
- **Caixa de E-mail**: conectar e-mail pessoal, visualizar e enviar (mock). Plano 3: solicitar e-mail profissional **@godcrm.com**.
- **Upload CSV/PDF** em todas as páginas admin.
- **Idioma EN/PT** no menu.

## Estrutura

- `app/` — layout root, redirect, rotas `/admin/*`
- `app/admin/` — layout admin (sidebar, header, UploadBar, PlanGuard), painel, cadastro, projeto, invoices, gaap, tax, etc.
- `components/` — ui, admin (sidebar, header, kpi-cards, charts, …), UploadBar, modais
- `contexts/` — language-context, plan-context
- `lib/` — utils, i18n, plans, menu-config
- `services/` — admin, automation, bills, email-inbox, professional-email, gaap, invoices, etc.

## Porta

O script `dev` sobe na porta **3000**. Use `dev:3001`, `dev:3005` ou `next dev -p X` se precisar de outra porta.
