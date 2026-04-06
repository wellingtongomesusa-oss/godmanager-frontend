# Módulo de Pagamentos

Sistema de pagamentos corporativo integrado ao dashboard-novo: ACH, Wire Transfer, Mastercard Send API e Plaid Bank Linking.

## Rota

- **`/admin/payments`** – Página de pagamentos (formulário, validar conta, enviar pagamento, rastrear).

O item **Payments** no menu lateral aponta para esta página.

## Funcionalidades

1. **Integração bancária**
   - Conectar contas via Plaid: `createPlaidLinkToken()`, `exchangePlaidToken()` (mock).
   - Validar contas: `validateBankAccount(routingNumber, accountNumber)`.
   - ACH: `createACHPayment()`.
   - Wire: `createWirePayment()`.
   - Mastercard Send: `sendMastercardPayment(recipientAccountUri, amount, ...)`.

2. **Interface**
   - Campos: Payment Type (ACH / Wire / Mastercard Send), Bank Account, Routing Number (ACH/Wire), Recipient Account URI (Mastercard Send), Amount, Reference.
   - Botões: Validate Account, Send Payment, Track Payment.
   - Lista de pagamentos recentes e modal de rastreio com logs.

3. **Logs e auditoria**
   - Cada pagamento gera entradas em `paymentLogsStore`: created, validation_start, validation_ok/validation_failed, sent, failed.
   - `trackPayment(id)` retorna o registro e os logs do pagamento.

4. **Segurança**
   - **lib/security.ts**: `encryptSensitive` / `decryptSensitive` (demo: base64; em produção: AES-GCM), `createTempToken` / `validateTempToken`, `checkRateLimit(key)` (in-memory; em produção: Redis).
   - **payments.service.ts**: rate limiting em todas as operações; mascaramento de conta/routing nos registros; export de `paymentsEncrypt` / `paymentsDecrypt` para uso externo.

## Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| **lib/security.ts** | Criptografia (demo), tokens temporários, rate limiting. |
| **services/payments.service.ts** | ACH, Wire, Mastercard Send, Plaid (link + validação), logs de pagamento, `validateBankAccount`, `sendPayment`, `trackPayment`, `listPayments`. |
| **components/payments/payments-form.tsx** | Formulário com tipo, conta, routing/URI, valor, referência; botões Validar, Enviar, Rastrear; lista recente e modal de rastreio. |
| **app/admin/payments/page.tsx** | Página que renderiza título e `PaymentsForm`. |
| **docs/PAYMENTS.md** | Esta documentação. |

## Modificações

- **components/admin/admin-sidebar.tsx**: link "Payments" para `/admin/payments`; rota ativa para `/admin/payments`.
- **lib/i18n/translations.ts**: chaves `sidebar.payments` e `payments.*` (EN/PT).

## Compilação

- `npm run build` e `npx tsc --noEmit` devem passar sem erros.
