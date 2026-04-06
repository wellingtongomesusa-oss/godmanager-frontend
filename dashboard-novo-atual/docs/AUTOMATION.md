# Módulo de Automação de Pagamentos

Sistema de automação de pagamentos recorrentes, previsões de fluxo de caixa e alertas com IA, integrado ao dashboard-novo.

## Rota

- **`/admin/automation`** – Página principal: cards (Próximos pagamentos, Previsões, Alertas) e botões (Schedule Payment, Automate Vendor, Predict Cash Flow).

O item **Automation** no menu lateral aponta para esta página.

## Funcionalidades

### 1. Scheduler

- **Agendar por data:** `schedulePayment({ vendor, amount, scheduledDate, recurrence, ... })` – recorrência: once, weekly, monthly.
- **Pagamentos recorrentes:** nextRunAt calculado a partir de scheduledDate + recurrence; ao processar, próxima execução é gerada para recorrentes.
- **Notificações automáticas:** `pushNotification()` em eventos (agendado, processado, anomalia, fornecedor automatizado); listagem em `getNotifications()`, `markNotificationRead()`.

### 2. IA (mock)

- **Prever fluxo de caixa:** `predictCashFlow(horizonDays)` – projeção de saldo, entradas e saídas por dia (baseado em pagamentos agendados e entradas simuladas).
- **Sugerir datas ideais:** `suggestPaymentDates(vendorId?, amount?)` – retorna datas com score e motivo (ex.: “High projected balance”).
- **Detectar anomalias:** `detectAnomalies()` – lista alertas (amount, vendor, timing); `addAnomaly()` para registrar novos.

### 3. Integrações

- **Mastercard Send API:** uso via `payments.service` (Send Payment na página de Pagamentos).
- **Plaid:** sincronização bancária via `payments.service` (Link bank account).
- **OCR (Google Vision / Tesseract):** serviço em `services/bills/ocr.service` (`processBillImage`); automação pode chamar para leitura de contas.
- **Webhooks:** `onWebhook()` exportado de `services/bills/webhooks.service` para atualizações externas.

### 4. Interface

- **Cards:** Próximos pagamentos (lista de agendados), Previsões (datas ideais + saldo projetado após “Predict Cash Flow”), Alertas (notificações + anomalias).
- **Botões:** Schedule Payment (modal com vendor, amount, date, recurrence), Automate Vendor (modal com vendor name, recurrence, default amount), Predict Cash Flow (atualiza card de previsões).

## Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| **services/automation/automation.service.ts** | Scheduler (schedulePayment, getUpcomingPayments, processNextScheduled), notificações, IA (predictCashFlow, suggestPaymentDates, detectAnomalies), automatizar fornecedor (automateVendor), export de onWebhook. |
| **components/automation/automation-dashboard.tsx** | Três cards (Upcoming, Predictions, Alerts), botões e modais. |
| **components/automation/schedule-payment-automation-modal.tsx** | Modal para agendar pagamento (vendor, amount, date, recurrence). |
| **components/automation/automate-vendor-modal.tsx** | Modal para automatizar fornecedor (name, recurrence, default amount). |
| **app/admin/automation/page.tsx** | Página que renderiza título e AutomationDashboard. |
| **docs/AUTOMATION.md** | Esta documentação. |

## Modificações

- **components/admin/admin-sidebar.tsx:** link "Automation" para `/admin/automation`; rota ativa para `/admin/automation`.
- **lib/i18n/translations.ts:** chaves `sidebar.automation` e `automation.*` (EN/PT).

## Compilação

- `npm run build` e `npx tsc --noEmit` devem passar sem erros.
