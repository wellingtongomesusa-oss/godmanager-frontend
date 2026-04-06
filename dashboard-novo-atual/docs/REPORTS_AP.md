# Módulo de Relatórios A/P (Accounts Payable)

Relatórios de contas a pagar com KPIs, gráficos (line, bar, pie, heatmap), filtros avançados e exportação PDF/CSV.

## Rota

- **`/admin/reports/ap`** – Página de relatórios A/P (filtros, KPIs, gráficos, Export, Share, Email Report).

O item **A/P Reports** no menu lateral aponta para esta página.

## Funcionalidades

### 1. Relatórios (KPIs)

- **Total Outstanding** – soma dos valores em aberto (pending, reviewed, approved_l1, approved_l2, scheduled).
- **Total Paid** – soma dos pagos.
- **Overdue Bills** – contas com dueDate &lt; hoje e status ≠ paid; total e quantidade.
- **Payment Cycle Time** – tempo médio em dias (criação → pagamento) para bills pagos.
- **Monthly A/P Trends** – por mês: outstanding, paid, overdue (últimos 12 meses).
- **Vendor Concentration** – valor e % por fornecedor (top N).

### 2. Gráficos

- **Line Chart (stacked)** – tendências mensais: Outstanding (azul), Paid (verde), Overdue (vermelho).
- **Bar Chart** – concentração por fornecedor (barras horizontais com %).
- **Pie Chart** – gastos por categoria (Mastercard Insights mock).
- **Heatmap** – valor por fornecedor x mês (tabela com cores).

### 3. Integrações

- **Mastercard Insights API (mock):** `getMastercardInsightsSpend()` – análise de gastos por categoria (baseado em vendor concentration).
- **Plaid:** sincronização bancária via módulo de Pagamentos existente.
- **IA:** `getApAnomalies()` – reutiliza `detectAnomalies()` do módulo de Automação para padrões e anomalias.

### 4. Interface

- **Filtros:** dateFrom, dateTo, vendor (aplicados a bills).
- **Export:** PDF (jspdf + jspdf-autotable), CSV (lib/csv-export).
- **Share:** copia URL da página para o clipboard.
- **Email Report:** campo de e-mail + botão; envia relatório por e-mail (mock em `sendApReportEmail`).

## Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| **services/reports/ap-reports.service.ts** | KPIs (getTotalOutstanding, getTotalPaid, getOverdueBills, getVendorConcentration, getPaymentCycleTimeDays, getMonthlyApTrends), getApKpis, getMastercardInsightsSpend (mock), getApHeatmapData, getApAnomalies, getApReportData. |
| **services/reports/ap-report-pdf.ts** | Geração de PDF do relatório A/P (KPIs, vendor concentration, monthly trends). |
| **components/reports/ap/ap-charts.tsx** | ApLineChart, ApBarChart, ApPieChart, ApHeatmap (CSS/SVG). |
| **components/reports/ap/ap-report-page.tsx** | Filtros, KPI cards, gráficos, botões Export PDF/CSV, Share, Email Report. |
| **app/admin/reports/ap/page.tsx** | Página que renderiza título e ApReportPage. |
| **docs/REPORTS_AP.md** | Esta documentação. |

## Modificações

- **services/email.ts:** `sendApReportEmail(to, subject?, summary?)` para envio mock do relatório A/P.
- **components/admin/admin-sidebar.tsx:** link "A/P Reports" para `/admin/reports/ap`; rota ativa para `/admin/reports`.
- **lib/i18n/translations.ts:** chaves `sidebar.reportsAp` e `reportsAp.*` (EN/PT).

## Compilação

- `npm run build` e `npx tsc --noEmit` devem passar sem erros.
