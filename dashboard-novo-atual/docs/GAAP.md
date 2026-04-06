# Módulo GAAP – dashboard-novo

Formulário e relatórios **GAAP** (U.S. Generally Accepted Accounting Principles) integrados ao dashboard.

## Rotas

- **Formulário GAAP:** `/admin/gaap`  
  - Cabeçalho: título, subtítulo, link para Relatórios.  
  - Formulário com 9 seções (Client, Reporting Period, Revenue, Expenses, Assets, Liabilities, Equity, Compliance Checklist, Finalization).  
  - Botão **Gerar Relatório Mensal GAAP** → salva e redireciona para `/admin/gaap/reports`.

- **Relatórios GAAP:** `/admin/gaap/reports`  
  - Listagem por mês/ano.  
  - Ações: **Baixar PDF**, **Baixar CSV**, **Enviar por e-mail**, **Enviar via WhatsApp**.

## Arquivos

| Arquivo | Descrição |
|--------|-----------|
| `services/gaap.service.ts` | Tipos GAAP, mock de cliente, período, CRUD de relatórios, `gaapReportToCsvRows`. |
| `services/gaap-pdf.ts` | Geração de PDF do relatório GAAP (jspdf + jspdf-autotable). |
| `services/email.ts` | `sendGaapReportEmail` (mock) para envio do relatório. |
| `lib/csv-export.ts` | `downloadCsv` para exportar dados em CSV. |
| `lib/dashboard-export.ts` | `exportDashboardCsv`, `exportDashboardPdf` (KPIs + transações). |
| `components/gaap/gaap-form.tsx` | Formulário GAAP com as 9 seções. |
| `app/admin/gaap/page.tsx` | Página GAAP (título, subtítulo, link Relatórios, formulário). |
| `app/admin/gaap/reports/page.tsx` | Listagem de relatórios e ações PDF/CSV/e-mail/WhatsApp. |
| `components/admin/admin-header.tsx` | Dropdown **Export** → CSV / PDF (em todo o admin). |
| `lib/i18n/translations.ts` | Chaves `gaap.*` (EN/PT). |

## Export CSV / PDF no dashboard

No **header do admin** há o dropdown **Export** com:

- **Export CSV:** baixa CSV com KPIs e amostra de transações.  
- **Export PDF:** baixa PDF com KPIs e amostra de transações.

Disponível em todas as páginas `/admin/*`.

## Erro "Module not found: jspdf"

Rode `npm install` no dashboard-novo. O módulo GAAP (e invoices) usa `jspdf` e `jspdf-autotable` para PDF.
