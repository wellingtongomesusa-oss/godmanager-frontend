/**
 * Manual oficial de Bookkeeping Imobiliário — Flórida (QuickBooks Online).
 * Fonte ÚNICA usada em: (a) popup de guia no app, (b) grounding das SophIAs
 * (/api/ai/help e /api/ai/bookkeeping-chat).
 *
 * Persona: Especialista Sênior em Bookkeeping Imobiliário FL — QuickBooks
 * ProAdvisor Advanced, IRS AFSP, FL Real Estate Compliance (DBPR+FREC),
 * Trust Accounting (Escrow). Regime de competência (accrual) / US GAAP.
 *
 * Avisos: limites e regras mudam anualmente (referência: tax year 2026).
 * Nada aqui substitui CPA/EA/attorney licenciado.
 */

export const BOOKKEEPING_GUIDE_FL_MD = `# Manual de Bookkeeping Imobiliário — Flórida (QuickBooks Online)

Regime de competência (accrual) · US GAAP · Conformidade IRS + FREC (Ch. 475 F.S. / Rule 61J2 F.A.C.) + DBPR + Florida DOR.
Referência: tax year 2026. Valores e limites mudam anualmente. Nada aqui substitui CPA/EA/attorney licenciado.

---

## MÓDULO 1 — CHART OF ACCOUNTS (IMOBILIÁRIA FLÓRIDA)

**Objetivo.** Estruturar um plano de contas que separe fundos do broker/PM dos fundos de terceiros (escrow) e permita relatórios GAAP e classificação correta para o IRS.

**Passo a passo.**
1. Em QuickBooks Online: *Settings (⚙) → Chart of Accounts → New*.
2. Crie as contas na estrutura abaixo (Account Type / Detail Type):
   - **1000 Operating Bank Account** — Bank / Checking.
   - **1010 Escrow / Trust Bank Account** — Bank / Trust account (OBRIGATÓRIA; nunca misturar com Operating).
   - **1200 Accounts Receivable** — Accounts receivable (A/R).
   - **1500 Fixed Assets / 1510 Accumulated Depreciation** — Fixed Assets.
   - **2000 Accounts Payable** — Accounts payable (A/P).
   - **2100 Security Deposits Held (Liability)** — Other Current Liability (contrapartida do dinheiro em Trust).
   - **2200 Owner Distribution Payable** — Other Current Liability (repasse devido ao proprietário).
   - **4000 Rental Income** — Income.
   - **4100 Property Management Fees** — Income.
   - **4200 Broker Commission Income** — Income.
   - **5000 Agent Commission Expense** — Expense (COGS se preferir margem).
   - **6000 Repairs & Maintenance** · **6100 Advertising & Marketing** · **6200 Office Supplies** · **6300 Software & Subscriptions** · **6400 Mileage (Auto)** · **6500 Professional Fees** · **6600 Payroll Expenses** · **6700 1099 Contractors** — todas Expense.
3. Ative *Account numbers* (Settings → Advanced → Chart of accounts → Enable account numbers) para ordenar por código.
4. Marque a Trust como conta **separada** e batize claramente (ex.: "1010 TRUST — Security Deposits").

**Erros comuns.** Usar uma única conta bancária para operar e guardar depósitos (co-mingling — ilegal na FL). Lançar Security Deposit como receita (é passivo). Misturar Owner Distribution com despesa.

**Checklist de conformidade.** ☐ Operating e Trust separadas · ☐ Security Deposits como Liability (2100) · ☐ Owner Distribution como Liability (2200) · ☐ Contas de receita separam Rent, Mgmt Fee e Commission.

**Relatórios.** Chart of Accounts (lista) · Balance Sheet (para conferir 1010 = 2100).

**Observações legais.** FREC/Rule 61J2-14: dinheiro de terceiros (depósitos, aluguéis a repassar) é *trust money* e deve ficar em conta separada e identificada.

---

## MÓDULO 2 — CONFIGURAÇÃO DE ESCROW / TRUST ACCOUNT

**Objetivo.** Operar a conta Trust sem co-mingling e com reconciliação mensal exigida pela FREC.

**Passo a passo.**
1. Abra a conta bancária Trust no banco (rotulada como *escrow/trust*), com o broker como custodiante.
2. No QBO crie **1010 Escrow/Trust Bank Account** (ver Módulo 1).
3. **Depósito de segurança recebido:** *+ New → Bank Deposit* na conta 1010; contrapartida **2100 Security Deposits Held (Liability)**. (Débito 1010 / Crédito 2100.) NUNCA em receita.
4. **Aluguel recebido a repassar:** entra na conta apropriada; a parte do owner fica como **2200 Owner Distribution Payable**; a mgmt fee vira receita **4100**.
5. **Devolução de depósito ao inquilino:** *+ New → Check/Expense* saindo de 1010; contrapartida **2100** (zera o passivo). Se houve retenção por danos, a parte retida vira receita/reembolso de reparo conforme o contrato.
6. **Controles internos:** exigir dupla conferência para saídas da Trust; conciliação mensal; nunca pagar despesa do broker pela conta Trust.

**Erros comuns.** Pagar contas da imobiliária pela conta Trust (co-mingling). Saldo da Trust ficar negativo (shortage — violação grave). Deixar de conciliar mensalmente.

**Checklist.** ☐ Saldo 1010 ≥ soma de 2100 + 2200 a qualquer momento · ☐ Sem despesa operacional na Trust · ☐ Reconciliação mensal assinada.

**Relatórios.** Trust/Escrow Ledger (Transaction Detail by Account 1010) · Balance Sheet (1010 vs 2100+2200) · Bank Reconciliation da Trust.

**Observações legais.** FREC: broker deve conciliar a conta trust mensalmente e manter os registros por no mínimo 5 anos. Shortage/comingling → ação disciplinar do DBPR.

---

## MÓDULO 3 — COMISSÕES DE AGENTES

**Objetivo.** Registrar comissão recebida pelo broker, aplicar o split e repassar ao agente.

**Passo a passo.**
1. **Comissão recebida (fechamento):** *+ New → Sales Receipt/Deposit* → **4200 Broker Commission Income** pelo valor bruto recebido do closing/title.
2. **Split (ex.: 70/30, 80/20, 100%):** a parte do agente é despesa **5000 Agent Commission Expense**; a parte do broker permanece como receita líquida.
3. **Repasse ao agente:** *+ New → Check/Expense* da Operating → **5000**. Vincule o agente como **Vendor** (não Employee) se for 1099.
4. **Taxas de transação (E&O, franquia, admin):** despesa própria (ex.: 6500 Professional Fees) ou dedução do split conforme contrato.
5. **Relatório por agente:** use *Vendor* = agente e rode *Transaction List by Vendor* ou *Expenses by Vendor Summary*.

**Erros comuns.** Tratar o agente 1099 como Employee (gera erro de payroll/W-2). Lançar a comissão do agente como redução de receita em vez de despesa (distorce o gross). Não guardar o W-9 do agente.

**Checklist.** ☐ Agente cadastrado como Vendor 1099 · ☐ W-9 arquivado · ☐ Split documentado no Independent Contractor Agreement.

**Relatórios.** Expenses by Vendor · P&L (4200 vs 5000) · 1099 Detail.

**Observações legais.** Agentes de imóveis normalmente são independent contractors (IRS §3508 / statutory nonemployee). Pagamentos ≥ $600/ano → 1099-NEC.

---

## MÓDULO 4 — PROPERTY MANAGEMENT (ALUGUÉIS, TAXAS, REPASSES)

**Objetivo.** Registrar o ciclo de aluguel: receber, cobrar mgmt fee, repassar ao owner, lançar despesas do imóvel e gerar o Owner Statement.

**Passo a passo.**
1. **Aluguel recebido:** *+ New → Receive Payment/Deposit* → **4000 Rental Income** (use *Class/Location* = imóvel para relatório por casa).
2. **Taxa de administração:** reconheça **4100 Property Management Fees** (ex.: 8% do rent; +2% quando HOA Admin → 10%).
3. **Repasse ao proprietário:** o líquido (rent − mgmt fee − despesas do imóvel) vira **2200 Owner Distribution Payable**; ao pagar, *Check/Expense* da conta apropriada baixando 2200.
4. **Despesas do imóvel (reparos, HOA, utilities):** lançar em 6000/6xxx com *Class* = imóvel; se pago pelo fundo do owner, reduz o repasse.
5. **Faturas de fornecedores (A/P):** *+ New → Bill* → categoria de despesa + Vendor; pague depois via *Pay Bills* (vira a conta a pagar do relatório AP Aging).
6. **Owner Statement:** gere por imóvel/owner (no GodManager, tela Statement individual; no QBO, P&L by Class).

**Erros comuns.** Não usar Class/Location por imóvel (impossibilita lucro por casa). Lançar repasse como despesa em vez de baixa de passivo. Misturar mgmt fee com rent.

**Checklist.** ☐ Class por imóvel · ☐ Mgmt fee separada do rent · ☐ Owner Distribution como passivo · ☐ Bills com Vendor + W-9.

**Relatórios.** P&L by Class (lucro por casa) · Owner Statement · A/P Aging · Rental Income Detail.

---

## MÓDULO 5 — RECONCILIAÇÃO MENSAL (OBRIGATÓRIA)

**Objetivo.** Conciliar Operating e Trust todo mês, exigência da FREC para a Trust.

**Passo a passo.**
1. *Settings → Reconcile* → selecione a conta → informe *Ending balance* e *Ending date* do extrato.
2. Marque como *cleared* cada transação que aparece no extrato; a **Difference** deve chegar a **$0.00**.
3. Concilie primeiro a **Operating**, depois a **Trust** (1010).
4. Na Trust, confirme: saldo do extrato = saldo contábil = soma dos passivos de terceiros (2100 + 2200). Qualquer diferença é shortage/overage — investigue antes de fechar.
5. Salve/*Finish now*; exporte o *Reconciliation Report* (PDF) e arquive.

**Erros comuns.** Forçar ajuste ("bank adjustment") para fechar a diferença — mascara erro. Conciliar só a Operating e esquecer a Trust. Fechar mês com Difference ≠ 0.

**Checklist FREC.** ☐ Operating conciliada · ☐ Trust conciliada · ☐ Trust: extrato = livro = 2100+2200 · ☐ Reconciliation Report arquivado · ☐ Assinatura do broker.

**Relatórios exigidos.** Bank Reconciliation (Operating e Trust) · Ledger/Transaction Detail · Trial Balance · Escrow/Trust Activity Report.

**Observações legais.** FREC exige reconciliação mensal da conta trust comparando saldo bancário, saldo contábil e obrigações de terceiros; manter por 5 anos.

---

## MÓDULO 6 — RELATÓRIOS OBRIGATÓRIOS

**Objetivo.** Emitir o pacote mensal padrão.

**Passo a passo (QBO → Reports).**
1. **Profit & Loss** (accrual, mês e YTD; e P&L by Class por imóvel).
2. **Balance Sheet** (confirme 1010 = 2100 + 2200).
3. **Statement of Cash Flows**.
4. **Transaction Detail by Account** (drill-down/auditoria).
5. **1099 Summary / 1099 Detail**.
6. **Escrow/Trust Ledger** (Transaction Detail da 1010).
7. **Owner Statement** (por owner/imóvel).

**Erros comuns.** Rodar em *cash* quando o engagement é *accrual*. Não filtrar por período/Class. Enviar sem conferir Balance Sheet.

**Checklist.** ☐ P&L · ☐ Balance Sheet · ☐ Cash Flows · ☐ Trial Balance · ☐ 1099 Summary · ☐ Escrow Ledger · ☐ Owner Statements.

---

## MÓDULO 7 — 1099-NEC

**Objetivo.** Preparar 1099-NEC para agentes e fornecedores.

**Passo a passo.**
1. Marque cada Vendor como *Track payments for 1099* e anexe o **W-9** (Settings → Vendors → editar).
2. Identifique quem recebe: contratados/prestadores **≥ $600/ano** pagos por dinheiro/cheque/ACH (não conta cartão — esse vai em 1099-K pela operadora). Corporations geralmente isentas (confirme no W-9; advogados são exceção).
3. *Payroll/Contractors → Prepare 1099s* → mapeie a caixa **NEC Box 1** para as contas de despesa (5000, 6700, 6500…).
4. Revise a lista, corrija TIN/endereço, e faça o *E-file* (ou imprima) até **31 de janeiro**.
5. Entregue cópia ao contratado e transmita ao IRS.

**Erros comuns.** Pagar por cartão e também emitir 1099-NEC (duplica com o 1099-K). Não coletar W-9 antes de pagar. Perder o prazo de 31/jan.

**Checklist.** ☐ W-9 de todo vendor ≥ $600 · ☐ Vendors marcados p/ 1099 · ☐ Contas mapeadas em Box 1 · ☐ E-file até 31/jan.

**Observações legais.** IRS 1099-NEC: prazo 31 de janeiro (IRS + destinatário). Multas por atraso/omissão.

---

## MÓDULO 8 — COMPLIANCE E AUDITORIA (FREC + DBPR + IRS)

**Objetivo.** Manter os livros à prova de auditoria estadual e federal.

**Regras-chave.**
- **Escrow/Trust:** fundos de terceiros em conta separada; sem co-mingling; conciliação mensal; sem shortage.
- **Co-mingling:** nunca pagar despesa do broker pela Trust nem manter dinheiro do broker na Trust (além do mínimo permitido de manutenção da conta).
- **Retenção de documentos:** mínimo **5 anos** (registros de trust, contratos, conciliações) — DBPR pode auditar.
- **Auditoria DBPR:** o broker deve produzir extratos, conciliações e ledger da trust a pedido.

**Erros comuns.** Registros de trust incompletos. Conciliações não assinadas/arquivadas. Documentos descartados antes de 5 anos.

**Checklist de auditoria.** ☐ Conciliações mensais (12) arquivadas · ☐ Ledger da trust íntegro · ☐ Contratos e W-9 arquivados · ☐ Retenção ≥ 5 anos · ☐ Sem lançamentos de co-mingling.

---

## MÓDULO 9 — WORKFLOWS AUTOMÁTICOS

**Objetivo.** Reduzir trabalho manual com automações seguras (sem perder o controle contábil).

**Passo a passo.**
1. **Importação bancária:** conecte os feeds (Bank Feeds / no GodManager, **Plaid**) para importar transações automaticamente.
2. **Bank Rules (QBO):** *Banking → Rules* → crie regras de categorização automática por payee/valor (ex.: "Duke Energy" → 6xxx Utilities).
3. **Comissões:** padronize itens/contas por tipo de split; use recurring transactions para taxas fixas.
4. **Repasses:** agende Owner Distributions recorrentes quando o valor é fixo; revise antes de pagar.
5. **Relatórios mensais:** *Reports → Custom Reports → salvar e agendar por e-mail* (pacote do Módulo 6) no dia combinado.
6. **Ramp → QuickBooks:** lance as despesas do cartão Ramp no QBO (ver guia de integração abaixo) para não digitar duas vezes.

**Erros comuns.** Automação categorizar errado sem revisão (bank rule muito ampla). Confiar em auto-add sem conferir a Trust. Não revisar recurring antes de emitir.

**Checklist.** ☐ Feeds/Plaid conectados · ☐ Bank Rules revisadas · ☐ Relatórios agendados · ☐ Ramp lançado no QBO · ☐ Revisão humana antes de fechar o mês.

---

## INTEGRAÇÕES — COMO VINCULAR (Ramp · Banco/Plaid · QuickBooks)

### Ramp → QuickBooks (por que e como)
**Sim, você precisa vincular.** Cada gasto no cartão Ramp é uma despesa da empresa (ou do imóvel) e precisa estar no QuickBooks para o P&L, a conciliação e o IRS baterem. No GodManager o lançamento é assistido:
1. Menu **Integrações → QuickBooks** e confirme *"QuickBooks conectado"*. Se não, clique **Conectar QuickBooks** (OAuth Intuit) e autorize.
2. Menu **Integrações → Ramp**: cada transação tem a ação **Lançar**.
3. Escolha o destino:
   - **Lançar no statement da casa** → vira despesa do imóvel (entra no Owner Statement e vira **Purchase/Expense no QuickBooks**, vinculada ao fornecedor).
   - **Marcar como despesa Manager Prop** → custo da empresa (não vai para nenhuma casa).
4. Ao lançar no QuickBooks, o sistema cria um **Purchase** com o fornecedor (Vendor) e a categoria de despesa; a transação aparece marcada **✓ Lançado** para não duplicar.
5. Confira depois em **A Pagar/Receber (QB)** e no **P&L** do QuickBooks.
**Regras.** Não lance a mesma transação duas vezes (o ✓ Lançado protege). Escolha a categoria certa (reparos, utilities, etc.) para o IRS. Gasto de cartão **não** gera 1099-NEC (vai no 1099-K da operadora).

### Banco (Plaid) — conectar e mapear as contas
1. **Bookkeeping** (ou menu Banco/Plaid) → **Vincular contas**.
2. Se aparecer só **uma** conta (ex.: ••1111) e você tem 3 (Operating, Trust, Security Deposit): **refaça a conexão** e, na tela do banco (Chase), **marque as 3 contas** — o Plaid só traz as contas que você autoriza naquele momento.
3. Depois de as 3 aparecerem, mapeie: **Operating → conta operacional**, **Trust → conta de aluguéis a repassar**, **Security Deposit → depósitos**. Salve.
4. **Puxar saldos** traz os saldos para a Home/Statement; **Extratos** baixa os PDFs (quando habilitado).
**Dica.** A conta representativa mostrada na faixa é só a principal; o mapeamento é que habilita as 3.

### QuickBooks — conectar
1. **Integrações → QuickBooks → Conectar QuickBooks**.
2. Faça login na Intuit e autorize a empresa correta (ambiente **Production**).
3. Volte ao GodManager: os **cards** (Receitas, Despesas, Lucro, Contas a Pagar), o **gráfico** e a página **A Pagar/Receber** passam a mostrar dados reais.
`;

/** Versão condensada para injeção no prompt das SophIAs (grounding). */
export const BOOKKEEPING_GUIDE_FL_AI = `CONHECIMENTO — BOOKKEEPING IMOBILIÁRIO FLÓRIDA (QuickBooks Online, accrual/US GAAP, FREC+IRS). Use para responder dúvidas de bookkeeping/contabilidade/QuickBooks/escrow/1099 e sobre as integrações do GodManager. Sempre lembre que limites mudam anualmente (ref. 2026) e que decisões fiscais exigem CPA/EA licenciado.

CHART OF ACCOUNTS (contas essenciais): Operating Bank; Escrow/Trust Bank (obrigatória, separada); Rental Income; Property Management Fees; Broker Commission Income; Agent Commission Expense; Security Deposits Held (Liability); Owner Distribution Payable (Liability); Repairs & Maintenance; Advertising; Office Supplies; Software & Subscriptions; Mileage; Professional Fees; Payroll; 1099 Contractors.

ESCROW/TRUST (FREC 61J2-14): fundos de terceiros em conta separada; SEM co-mingling; depósito de segurança é PASSIVO (Security Deposits Held), nunca receita; devolução baixa o passivo; conciliação MENSAL obrigatória; saldo trust = passivos de terceiros (deposits + owner distribution); reter registros ≥ 5 anos; shortage/comingling = violação DBPR.

COMISSÕES: comissão recebida = Broker Commission Income (bruto); parte do agente = Agent Commission Expense; agente é Vendor 1099 (não employee); W-9 obrigatório; ≥ $600/ano → 1099-NEC.

PROPERTY MANAGEMENT: rent = Rental Income (use Class por imóvel); mgmt fee 8% (+2% HOA Admin = 10%) = Property Management Fees; líquido ao owner = Owner Distribution Payable; despesas do imóvel em 6xxx com Class; faturas = Bill (A/P). Lucro por casa = P&L by Class.

RECONCILIAÇÃO: conciliar Operating e Trust todo mês; Difference deve ser $0.00; nunca forçar ajuste; relatórios FREC = Bank Reconciliation, Ledger, Trial Balance, Escrow Activity.

RELATÓRIOS MENSAIS: P&L (accrual, e by Class), Balance Sheet, Cash Flows, Transaction Detail by Account, 1099 Summary, Escrow Ledger, Owner Statement.

1099-NEC: marcar Vendor p/ 1099 + W-9; ≥ $600 pagos por cheque/ACH/dinheiro (cartão NÃO — vai no 1099-K); mapear NEC Box 1; e-file até 31 de janeiro.

COMPLIANCE: escrow separado, sem co-mingling, conciliação mensal, retenção ≥ 5 anos, produzir ledger/conciliações ao DBPR.

INTEGRAÇÕES NO GODMANAGER:
- RAMP → QUICKBOOKS: cada gasto de cartão Ramp deve ir ao QuickBooks. Em Integrações→Ramp, ação "Lançar": escolher "Lançar no statement da casa" (despesa do imóvel, cria Purchase no QuickBooks) ou "Marcar como despesa Manager Prop" (custo da empresa). O QuickBooks precisa estar conectado antes. Transação lançada fica "✓ Lançado" (não duplica). Gasto de cartão não gera 1099-NEC.
- PLAID (banco): em Bookkeeping → "Vincular contas". Se só aparece 1 conta e o cliente tem 3 (Operating/Trust/Security Deposit), refazer a conexão marcando as 3 contas na tela do banco (o Plaid só traz as contas autorizadas naquele momento); depois mapear Operating/Trust/Security e "Puxar saldos".
- QUICKBOOKS: Integrações→QuickBooks→Conectar QuickBooks (OAuth Intuit, ambiente Production). Depois os cards/gráfico/A Pagar-Receber mostram dados reais.`;
