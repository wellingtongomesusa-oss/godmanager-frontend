# Product Requirements Document (PRD) - Sistema de Trading Algorítmico

## 1. Visão Geral

### 1.1 Objetivo
Sistema completo de pesquisa, backtest, paper trading e execução para trading algorítmico de ações e opções nos EUA, combinando análise quantitativa, microestrutura de mercado, fluxo de dinheiro e execução profissional.

### 1.2 Meta de Performance (HIPÓTESE)
- **Meta-alvo**: 2% ao dia OU 5% por semana
- **Status**: Hipótese testável, NÃO promessa de retorno
- **Avaliação**: Viabilidade será testada e, se necessário, metas realistas por regime serão propostas

### 1.3 Métricas Obrigatórias
- Expected return (esperado)
- Volatilidade (vol)
- Max drawdown
- Tail risk (risco de cauda)
- Capacity (capacidade)
- Turnover
- Hit rate
- Profit factor
- Sharpe/Sortino (com ressalvas para intradiário)

## 2. Escopo

### 2.1 MVP (Minimum Viable Product)
- Ingestão de dados OHLCV intradiário (1m/5m) e diário
- 3 estratégias básicas implementadas
- Backtest com custos reais (spread, slippage, fees)
- Paper trading ao vivo com dados reais
- Gestão de risco básica (limites diários/semanais)
- Dashboard de monitoramento

### 2.2 V2 (Expansão)
- Time & Sales (prints + agressor)
- Level 2 / Order Book (top-of-book)
- Suporte completo a opções (cadeias, greeks, IV)
- 6+ estratégias implementadas
- Walk-forward optimization
- Integração com múltiplos brokers
- Replay de sessões
- Observabilidade avançada (Prometheus/Grafana)

## 3. Universo de Trading

### 3.1 Ações
- **Mercados**: NYSE, Nasdaq, AMEX
- **Filtros de liquidez**:
  - Preço > $5
  - Volume médio 20d > 100k (configurável)
  - Spread médio < 10 bps (configurável)
- **Pipeline**: Escalável para milhares de tickers (batch/parallel)
- **Filtros dinâmicos**: Atualização diária

### 3.2 Opções
- **Subuniverso**: Ações com cadeias líquidas
- **Critérios**:
  - Open Interest > X
  - Volume > Y
  - Bid-Ask spread < Z bps
  - IV disponível e razoável

## 4. Dados Necessários

### 4.1 MVP
- OHLCV intradiário (1m/5m) e diário ajustado
- Calendário de mercado
- Corporate actions básicas

### 4.2 V2
- Time & Sales (prints + agressor)
- Level 2 / Order Book (top-of-book e profundidade)
- Opções: cadeia completa, greeks, IV, OI, volume, NBBO, trades
- Borrow/short data (quando aplicável)

### 4.3 Provedores de Dados

#### Polygon
- **Prós**: Dados intradiários completos, Time & Sales, L2, opções
- **Limitações**: Custo, latência para dados em tempo real
- **Uso**: Principal para MVP e V2

#### IEX Cloud
- **Prós**: Dados gratuitos limitados, boa para desenvolvimento
- **Limitações**: Limites de taxa, dados limitados
- **Uso**: Desenvolvimento/testes

#### Interactive Brokers
- **Prós**: Dados em tempo real, execução integrada
- **Limitações**: Requer conta, complexidade de integração
- **Uso**: Execução live e dados em tempo real

#### Tradier
- **Prós**: Boa para opções, API simples
- **Limitações**: Custos, limitações de dados
- **Uso**: Opções e execução alternativa

#### Alpaca
- **Prós**: API moderna, paper trading integrado
- **Limitações**: Dados limitados, foco em ações
- **Uso**: Paper trading e execução

## 5. Estratégias-Candidatas

### 5.1 Order Flow Imbalance → Mean Reversion
- **Hipótese**: Desequilíbrios extremos de fluxo revertem no curto prazo
- **Features**: CVD, trade sign, imbalance bid/ask
- **Gatilhos**: Imbalance > threshold, confirmação de volume
- **Riscos**: Trend forte pode continuar
- **Condições**: Funciona melhor em range, falha em trends fortes

### 5.2 Breakout com Confirmação de Agressão
- **Hipótese**: Breakouts com agressão confirmada têm maior probabilidade
- **Features**: Price action, agressor ratio, volume
- **Gatilhos**: Breakout de nível + agressão > threshold
- **Riscos**: Falsos breakouts
- **Condições**: Funciona em volatilidade moderada, falha em baixa vol

### 5.3 VWAP/Anchored VWAP + Fluxo
- **Hipótese**: Desvios de VWAP com confirmação de fluxo são oportunidades
- **Features**: VWAP deviation, volume profile, fluxo direcional
- **Gatilhos**: Desvio > X% + fluxo confirmando
- **Riscos**: VWAP pode não ser suporte/resistência
- **Condições**: Funciona intraday, falha em gaps grandes

### 5.4 Momentum Intradiário por Janelas
- **Hipótese**: Momentum funciona diferentemente em manhã vs tarde
- **Features**: Returns por janela, volume, volatilidade
- **Gatilhos**: Momentum > threshold + filtros de horário
- **Riscos**: Reversão em fim de dia
- **Condições**: Funciona em tendências, falha em choppy markets

### 5.5 Opções: IV/Liquidez + Estrutura
- **Hipótese**: Oportunidades em opções com IV rank e estrutura favorável
- **Features**: IV rank, skew, term structure, greeks
- **Gatilhos**: IV rank < 20% + estrutura favorável + liquidez
- **Riscos**: Greeks, gap risk, baixa liquidez
- **Condições**: Funciona em regimes específicos, falha em baixa vol

### 5.6 Pairs/Sector Flow como Contexto
- **Hipótese**: Fluxo setorial fornece contexto para trades individuais
- **Features**: Correlação, fluxo setorial, momentum relativo
- **Gatilhos**: Sinal individual + confirmação setorial
- **Riscos**: Correlação pode quebrar
- **Condições**: Funciona em mercados normais, falha em crises

## 6. Engenharia de Features

### 6.1 Tape/Fluxo
- Trade sign (agressor): buy/sell identificado
- CVD (Cumulative Volume Delta): Volume comprado - volume vendido
- Imbalance bid/ask: Desequilíbrio no livro
- Microprice: Preço ajustado pelo spread
- Spread: Bid-ask spread
- Depth: Profundidade do livro
- Realized vol: Volatilidade realizada
- ATR intradiário: Average True Range
- Volume profile: Distribuição de volume por preço
- VWAP deviation: Desvio do VWAP
- Order arrival rates: Taxa de chegada de ordens
- Sweep detection: Detecção de varreduras no livro
- Blocos: Trades grandes

### 6.2 Opções
- IV rank: Percentil da IV histórica
- Skew: Assimetria da distribuição de strikes
- Term structure: Estrutura temporal da IV
- Greeks agregados: Delta, gamma, vega, theta
- Bid-ask relativo: Spread relativo ao preço
- OI/Volume: Relação entre open interest e volume

## 7. Backtest e Validação

### 7.1 Framework de Backtest
- Simulação de custos reais:
  - Spread (bid-ask)
  - Slippage (modelado por volatilidade/liquidez)
  - Fees (comissões do broker)
  - Cenários de latência
- Walk-forward optimization
- Testes por regime (alta vol, baixa vol, trending, range)
- Controle de overfitting:
  - Limites de complexidade
  - Estabilidade por ticker/setor/vol/horário
- Relatórios:
  - Estatísticas de performance
  - Distribuição de retornos
  - Piores dias/semanas
  - Análise de drawdown

### 7.2 Critérios de Aceitação
- Sharpe > 1.5 (com ressalvas intradiárias)
- Max drawdown < 15%
- Hit rate > 45%
- Profit factor > 1.5
- Estabilidade out-of-sample

## 8. Paper Trading Ao Vivo

### 8.1 Modo LIVE SIM
- Ingestão de dados em tempo real
- Execução simulada com:
  - Livro/quotes (ou proxy realista)
  - Custo modelado (spread, slippage)
- Roteador de ordens em modo paper:
  - Conta paper do broker (quando disponível) OU
  - Simulador interno com:
    - Fill parcial
    - Rejeição
    - Slippage dependente de spread/vol
    - Atraso configurável

### 8.2 Dashboard
- PnL diário/semanal
- Exposição atual
- Greeks (opções)
- Drawdown
- Logs de sinais, ordens, fills
- Slippage estimado vs realizado
- Alertas
- Kill-switch

### 8.3 Replay
- Capacidade de "reproduzir" dia/horário
- Depuração de decisões
- Análise pós-trade

## 9. Gestão de Risco e Guardrails

### 9.1 Limites
- Perda diária: 2% do capital
- Perda semanal: 5% do capital
- Max drawdown: 15% do capital
- Max exposição por ativo: Configurável
- Limite de ordens/minuto: 10 (configurável)

### 9.2 Opções
- Limites de delta: ±500 (configurável)
- Limites de gamma: ±100 (configurável)
- Limites de vega: ±1000 (configurável)
- Risco de gap: Limite por evento

### 9.3 Position Sizing
- Risco por trade: 1% do capital (configurável)
- Volatility targeting: Ajuste por volatilidade
- Kelly fracionado: Opcional, conservador

### 9.4 Regras de Não-Trade
- Spreads abertos: Não trade se spread > threshold
- Baixa liquidez: Volume < threshold
- Eventos: Earnings, FOMC (conforme política)
- Horários: Não trade em abertura/fechamento (opcional)

### 9.5 Kill-Switch
- Automático: Quando limites são atingidos
- Manual: Via dashboard/API
- Auditoria: Logs de todas as ações

## 10. Execução e Infraestrutura

### 10.1 Stack Tecnológica
- **Pesquisa/Backtest**: Python
- **Execução**: Python/Go (futuro)
- **Mensageria**: Redis/Kafka
- **Banco**: Postgres/TimescaleDB
- **Orquestração**: Docker

### 10.2 Integração Broker/API
- **Ações e Opções**: Interactive Brokers, Tradier, Alpaca
- **Tipos de ordem**: Limit, post-only, market (quando aplicável)
- **Boas práticas**: Evitar market orders, usar limit orders
- **Logging**: Auditoria completa de ordens

### 10.3 Observabilidade
- Logs estruturados
- Métricas (Prometheus)
- Alertas
- Replay
- Monitoramento de latência

### 10.4 Segurança
- Segregação de chaves
- Secrets manager
- Controle de acesso
- Auditoria

## 11. Critérios "Apto para Produção"

### 11.1 Requisitos Mínimos
- Paper trading por 30 dias com resultados consistentes
- Sharpe > 1.5
- Max drawdown < 15%
- Hit rate > 45%
- Profit factor > 1.5
- Sem overfitting detectado (validação out-of-sample)
- Sistema de risco funcionando
- Kill-switch testado
- Logs e auditoria completos

### 11.2 Sinais de Overfitting
- Performance muito melhor em-sample vs out-of-sample
- Parâmetros muito específicos
- Muitos parâmetros vs dados disponíveis
- Performance instável por ticker/setor/regime
- Curva de equity com muitas otimizações

## 12. Restrições de Integridade

- **NÃO prometer retorno**: Meta é hipótese testável
- **Potencialmente refutável**: Se não funcionar, ajustar ou descartar
- **Condições específicas**: Explicitar claramente quando performance depende de condições
- **Transparência**: Reportar tudo, incluindo falhas

## 13. Roadmap

### Fase 1: MVP (4-6 semanas)
- Infraestrutura base
- Ingestão de dados básica
- 3 estratégias
- Backtest básico
- Paper trading simples

### Fase 2: Expansão (6-8 semanas)
- Dados avançados (T&S, L2)
- 6+ estratégias
- Backtest robusto
- Paper trading completo
- Dashboard avançado

### Fase 3: Produção (4-6 semanas)
- Integração broker completa
- Gestão de risco robusta
- Observabilidade completa
- Testes extensivos
- Deploy produção
