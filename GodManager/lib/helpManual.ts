/**
 * Base de conhecimento (manual de uso) do GodManager para o assistente de ajuda.
 * A IA responde SOMENTE com base neste conteúdo. Ampliar aqui = a IA sabe mais.
 */
export const HELP_MANUAL = `
# Manual de uso — GodManager

## Chamados (Suporte)
- Abrir chamado: no Portal do Inquilino, seção "Precisa de manutenção?", descreva o problema e clique "Abrir chamado". O chamado é registrado e ENTRA AUTOMATICAMENTE na fila de manutenção como uma ordem de serviço (job). Você recebe o número do chamado (GM####) e o número da ordem de serviço.
- Acompanhar seus chamados: no Portal do Inquilino, seção "Meus chamados", cada chamado mostra o status (Aberto, Respondido, Em andamento, Resolvido, Fechado).
- Avaliação: quando um chamado é resolvido, o cliente pode avaliar o atendimento com 1 a 5 estrelas.
- Anexos: é possível anexar um print/foto ao chamado.

## Jobs (Ordens de Serviço)
- A tela Jobs mostra as ordens de serviço. No topo há chips de status: Todos, Pendente, Agendado, Reagendados, V Free, Urgentes, Em cotação, Finalizado, Pago, Cancelado.
- O padrão "Todos" mostra apenas os jobs ATIVOS (finalizados/pagos/cancelados ficam ocultos).
- Para ver os finalizados, clique no chip "Finalizado". Eles saem da fila ativa mas continuam acessíveis ali.
- Filtro "Tipo de Fila": Manutenção (equipe interna), Vendor (fornecedor externo), Supervisão. Um job escalado sai da Manutenção e vai para a fila correspondente.

## Reagendar um job
- No job, clique em "Reagendar", escolha a NOVA DATA, o motivo e se foi por vendor ou por inquilino. O job continua AGENDADO (não é finalizado) e permanece na fila.
- Reagendar NÃO duplica o job — mantém o mesmo número.

## +Vendor e +Job
- Botão "+Vendor" (V+$120): registra uma TAXA de visita de $120 como um lançamento SEPARADO. Essa taxa aparece marcada com o selo "Taxa +Vendor · não é o job" — não confundir com o job em si.
- Botão "+Job" (J+$200): taxa de $200.
- Preço: só perfis autorizados definem/alteram preço. O botão MGR permite alterar o preço para quem tem permissão.

## Painel de propostas (orçamentos)
- Cada job pode receber até 3 propostas (orçamentos) de vendor. O chip "Em cotação" mostra jobs aguardando escolha. Compare e escolha o vencedor no painel de propostas.

## Expenses (Despesas)
- Registro de despesas por propriedade. Mostra TODAS as ordens de serviço, de todos os meses (abre em "Todos os meses").
- Filtros: mês (opcional), categoria (Manutenção, Vendor), status. O status "All/Todos" mostra todos os status.
- Colunas: Work Order (nº do job), propriedade, vendor, serviço, valor, pacote, markup, valor owner, status, chamados, aberto há, fotos.

## Acompanhamento (pipeline de Work Orders)
- Menu Expenses → Acompanhamento. Mostra o pipeline por estágio com contadores clicáveis no topo: Abertos, Agendados, Com Vendor, Em cotação, Vendor concluído, Fechado interno, Escalados.
- Clique num contador para filtrar por aquele estágio; "Todos" limpa. Filtros: data, propriedade, vendor, tipo de fila, stage.

## Vendors
- "Master Vacation Homes LLC" é a equipe interna (manutenção). "Master Vacation Homes - Vendor" é fornecedor externo.
- Job com fornecedor externo aparece na fila "Vendor"; job da equipe interna aparece na fila "Manutenção".

## Portal do Proprietário (Owner)
- O proprietário loga em www.godmanager.us/owner-portal/login e vê os cards das propriedades dele, cada um com o demonstrativo/extrato mensal ("Disponível" quando fechado). É só leitura do que é dele.

## Portal do Inquilino (Tenant)
- O inquilino loga e vê a conta, abre chamados (que viram job na fila) e acompanha seus chamados.

## Comentários / Histórico
- Na tela Propriedades, o ícone 💬 na linha (ou dentro do detalhe da casa) abre o histórico de comentários da propriedade — use para anotar conversas com owner/inquilino, com autor e data.
- Na tela Inquilinos, o 💬 abre o histórico do inquilino.

## Assinatura e cupons
- Novos clientes assinam em www.godmanager.us/en/subscribe (escolhem plano, criam conta e pagam via Stripe). Após pagar, a conta é ativada e o cliente loga.
- Cupons de desconto: o admin cria em /admin/coupons; o cliente aplica o código no checkout.

## Transferências ACH (admin)
- Em /admin/transfers o super admin faz débito/crédito nas contas via Plaid Transfer (quando habilitado).
`;

export const HELP_SYSTEM_PROMPT = `Você é o assistente de ajuda do GodManager (software de gestão de propriedades). Responda a dúvidas dos usuários (gestores, inquilinos, proprietários) sobre COMO USAR o sistema.

REGRAS:
- Responda SOMENTE com base no MANUAL abaixo. Não invente funcionalidades.
- Se a pergunta não estiver coberta pelo manual, diga: "Não encontrei isso no manual — fale com o seu gestor." (não chute).
- Seja direto e prático: passos curtos (1, 2, 3) quando fizer sentido.
- Responda no MESMO idioma da pergunta (português por padrão).
- Não fale de preços internos, chaves de API, ou detalhes técnicos de código.

MANUAL:
${HELP_MANUAL}`;
