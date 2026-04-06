# Bills Approval Workflow

Módulo de fluxo de aprovação de contas a pagar (Bills) com dupla alçada, logs e trilha de auditoria.

## Rotas

- **`/admin/bills/approval`** – Página principal do workflow (tabela, filtros, ordenação, ações).

O item **Bill** no menu lateral aponta para esta página.

## Fluxo de status

1. **Pending** → Revisar
2. **Reviewed** → Approve L1
3. **Approved Level 1** → Approve L2
4. **Approved Level 2** → Schedule Payment
5. **Scheduled** → (próximo passo: Paid, quando houver integração)
6. **Paid** – final
7. **Rejected** – encerra o fluxo (disponível em Pending, Reviewed, Approved L1)

## Arquivos criados

### Serviços

| Arquivo | Descrição |
|---------|-----------|
| `services/logs.service.ts` | Trilha de auditoria: ação, usuário, IP, userAgent, timestamp. `logAudit()`, `getLogsByEntity()`, `getAllLogs()`. |
| `services/bills/bills-approval.service.ts` | Workflow de bills: status, CRUD em memória, `setBillReviewed`, `setBillApprovedL1`, `setBillApprovedL2`, `setBillRejected`, `setBillScheduled`, `setBillPaid`, seed de dados mock. |
| `services/bills/mastercard-send.service.ts` | Mock Mastercard Send API: `validateAccount()`, `sendPayment()` (em produção trocar por API real). |
| `services/bills/plaid.service.ts` | Mock Plaid: `createLinkToken()`, `getBalance()`, `validateBankAccount()` (em produção usar Plaid Link + API). |
| `services/bills/ocr.service.ts` | Mock OCR: `processBillImage()` (em produção: Google Vision ou Tesseract). |
| `services/bills/webhooks.service.ts` | Webhooks: `onWebhook()`, `receiveWebhook()`, `emitWebhook()` para atualização de status por eventos externos. |

### Componentes

| Arquivo | Descrição |
|---------|-----------|
| `components/bills/bills-approval-table.tsx` | Tabela com filtros (status, vendor, datas, busca), ordenação (dueDate, amount, vendor, status), paginação, botões: View Bill, Review, Approve L1, Approve L2, Schedule Payment, Reject. |
| `components/bills/view-bill-modal.tsx` | Modal com detalhes do bill e trilha de auditoria (logs da entidade). |
| `components/bills/schedule-payment-modal.tsx` | Modal para agendar data de pagamento (status → Scheduled). |

### Páginas

| Arquivo | Descrição |
|---------|-----------|
| `app/admin/bills/approval/page.tsx` | Página que renderiza título e `BillsApprovalTable`. |

### Outros

- **Sidebar**: link "Bill" alterado para `/admin/bills/approval`; rota ativa para `/admin/bills/*`.
- **i18n**: chaves `bills.*` (EN/PT) em `lib/i18n/translations.ts`.

## Segurança e auditoria

- Cada mudança de status gera um log em `logs.service` com: `action`, `entityType`, `entityId`, `userId`, `userEmail`, `ip`, `userAgent`, `timestamp`, `metadata`.
- Visualização de um bill registra `bill.viewed`.
- Em produção: persistir logs em BD ou sistema de auditoria (ex.: ELK); obter IP real via header (X-Forwarded-For) ou API server-side; permissões por role (`canApproveL1`, `canApproveL2` já preparados no serviço).

## Integrações (mocks)

- **Mastercard Send**: validar conta e simular pagamento; em produção usar OAuth e endpoints oficiais.
- **Plaid**: link de conta e validação bancária; em produção usar Plaid Link + exchange token.
- **OCR**: em produção usar Google Cloud Vision ou Tesseract.js para extrair vendor, amount, dueDate de imagem da fatura.
- **Webhooks**: `onWebhook()` pode ser usado pelo serviço de bills para reagir a eventos externos (ex.: gateway de pagamento) e atualizar status.

## Compilação

- `npm run build` e `npx tsc --noEmit` devem passar sem erros.
