# Módulo Invoices – dashboard-novo

Módulo de **Invoices** integrado ao dashboard: criação, listagem, detalhes, PDF, e-mail e WhatsApp.

## Como rodar

```bash
cd dashboard-novo
npm install   # instala jspdf e jspdf-autotable para PDF
npm run dev:3005
```

Acesse:
- **Listagem:** http://localhost:3005/admin/invoices  
- **Nova invoice:** http://localhost:3005/admin/invoices/new  

## Arquivos criados ou modificados

### Serviços e lib

| Arquivo | Descrição |
|--------|-----------|
| `lib/company.ts` | Dados padrão da empresa (Godroox). Preenchimento automático em invoices; editável no formulário. |
| `services/invoices/invoices.service.ts` | CRUD, geração de número, filtros, ordenação, paginação. Mock em memória; trocar por API depois. |
| `services/invoices/pdf-invoice.ts` | Geração de PDF (jspdf + jspdf-autotable). `downloadInvoicePdf`, `getInvoicePdfBlob`. |
| `services/email.ts` | Mock de envio de invoice por e-mail. Trocar por Resend/SendGrid em produção. |

### Páginas

| Arquivo | Descrição |
|--------|-----------|
| `app/admin/invoices/page.tsx` | Listagem: tabela, filtros (status, moeda, cliente, datas), ordenação, paginação, "Criar nova invoice". |
| `app/admin/invoices/new/page.tsx` | Formulário de criação de invoice. |
| `app/admin/invoices/[id]/page.tsx` | Detalhes da invoice: cliente, empresa, itens, totais. Botões Baixar PDF, Enviar e-mail, WhatsApp, Editar. |
| `app/admin/invoices/[id]/edit/page.tsx` | Formulário de edição (mesmo componente que /new, com invoice pré-preenchida). |

### Componentes

| Arquivo | Descrição |
|--------|-----------|
| `components/invoices/invoice-form.tsx` | Formulário completo: cliente, empresa, invoice (datas, moeda, termos), itens dinâmicos, totais, notas. Validação, Gerar, Salvar rascunho, Cancelar. |
| `components/invoices/invoices-list-table.tsx` | Tabela com filtros, ordenação, paginação. Ações: Ver detalhes, Editar, Baixar PDF, Enviar e-mail, WhatsApp. |

### Outros

| Arquivo | Descrição |
|--------|-----------|
| `lib/i18n/translations.ts` | Novas chaves `inv.*` (EN/PT) para títulos, formulário, filtros, status, ações. |
| `components/admin/admin-sidebar.tsx` | Link "Invoice" apontando para `/admin/invoices`. |
| `package.json` | Dependências `jspdf` e `jspdf-autotable` para geração de PDF. |

## Funcionalidades

- **Criar invoice:** cliente, empresa (auto), número (auto), datas, moeda, termos, itens (add/remove), descontos, notas. Gerar ou salvar rascunho.
- **Listar:** filtros por status, moeda, cliente, datas; ordenar por data, valor, status; paginação.
- **Detalhes:** ver invoice, baixar PDF, enviar por e-mail (mock), abrir WhatsApp com mensagem pré-preenchida.
- **Editar:** mesmo formulário que criar, com dados da invoice carregados.

## Dependências

- `jspdf`, `jspdf-autotable`: geração de PDF. Instalar com `npm install`.
