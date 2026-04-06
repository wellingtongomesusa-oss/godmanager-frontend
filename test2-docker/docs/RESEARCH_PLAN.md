# Plano de Pesquisa

## Visão Geral

Este documento detalha o plano de pesquisa, desde hipóteses até features, experimentos e critérios de aceitação.

## Hipóteses Principais

### H1: Order Flow Imbalance → Mean Reversion
**Hipótese**: Desequilíbrios extremos de fluxo (imbalance bid/ask) revertem no curto prazo (minutos).

**Teste**: 
- Calcular imbalance histórico
- Identificar períodos com imbalance extremo (> threshold)
- Medir retorno nos próximos N minutos
- Comparar com baseline (random)

**Critério de Aceitação**: 
- Sharpe > 1.5
- Hit rate > 45%
- Profit factor > 1.5

### H2: Breakout + Agressão → Continuidade
**Hipótese**: Breakouts de níveis técnicos com confirmação de agressão (tape) têm maior probabilidade de continuar.

**Teste**:
- Detectar breakouts históricos
- Classificar por agressão (alta/baixa)
- Medir performance de breakouts com vs sem agressão

**Critério de Aceitação**: 
- Breakouts com agressão têm Sharpe 20%+ maior
- Hit rate > 50%

### H3: VWAP Deviation + Fluxo → Oportunidade
**Hipótese**: Desvios significativos do VWAP com confirmação de fluxo direcional são oportunidades de trading.

**Teste**:
- Calcular VWAP e desvios históricos
- Verificar fluxo direcional (CVD, imbalance)
- Medir performance de trades quando fluxo confirma

**Critério de Aceitação**:
- Sharpe > 1.5 quando fluxo confirma
- Sharpe < 1.0 quando fluxo não confirma

### H4: Momentum Intradiário por Janelas
**Hipótese**: Momentum funciona diferentemente em diferentes horários do dia (manhã vs tarde).

**Teste**:
- Dividir dia em janelas (9:30-11:30, 11:30-14:00, 14:00-16:00)
- Calcular momentum por janela
- Testar estratégias específicas por janela

**Critério de Aceitação**:
- Performance significativamente diferente por janela
- Pelo menos uma janela com Sharpe > 1.5

### H5: Opções IV Rank + Estrutura → Oportunidade
**Hipótese**: Opções com IV rank baixo e estrutura favorável oferecem oportunidades.

**Teste**:
- Calcular IV rank histórico
- Identificar oportunidades (IV rank < 20%, estrutura favorável)
- Medir performance de trades de opções

**Critério de Aceitação**:
- Sharpe > 1.0 (opções têm mais risco)
- Max drawdown < 20%

### H6: Sector Flow → Contexto
**Hipótese**: Fluxo setorial fornece contexto valioso para trades individuais.

**Teste**:
- Calcular fluxo setorial (CVD, momentum)
- Testar estratégias com vs sem contexto setorial

**Critério de Aceitação**:
- Sharpe 10%+ maior com contexto setorial

## Features a Desenvolver

### Tape/Fluxo

#### 1. Trade Sign (Agressor)
- **Cálculo**: Identificar se trade foi compra ou venda
- **Fonte**: T&S (quando disponível) ou inferir de price action
- **Janela**: Últimos N trades

#### 2. CVD (Cumulative Volume Delta)
- **Cálculo**: Sum(volume_buy) - Sum(volume_sell) em janela
- **Janela**: Rolling window (ex: 5 minutos)
- **Normalização**: Dividir por volume total

#### 3. Imbalance Bid/Ask
- **Cálculo**: (bid_volume - ask_volume) / total_volume
- **Fonte**: L2 (quando disponível) ou inferir
- **Range**: -1 a +1

#### 4. Microprice
- **Cálculo**: (bid * ask_size + ask * bid_size) / (bid_size + ask_size)
- **Fonte**: L2
- **Uso**: Preço mais preciso que mid

#### 5. Spread e Depth
- **Spread**: ask - bid (absoluto e bps)
- **Depth**: bid_size + ask_size
- **Fonte**: L2

#### 6. Realized Volatility
- **Cálculo**: Std dev de returns em janela
- **Janela**: Rolling (ex: 20 períodos)
- **Anualização**: Multiplicar por sqrt(252 * períodos_por_dia)

#### 7. ATR (Average True Range)
- **Cálculo**: Média de True Range
- **Janela**: 14 períodos (padrão)

#### 8. Volume Profile
- **Cálculo**: Distribuição de volume por nível de preço
- **Uso**: Identificar níveis de suporte/resistência

#### 9. VWAP Deviation
- **Cálculo**: (price - VWAP) / VWAP
- **VWAP**: Volume-weighted average price desde abertura

#### 10. Order Arrival Rate
- **Cálculo**: Número de ordens por segundo
- **Uso**: Medir atividade de mercado

### Opções

#### 1. IV Rank
- **Cálculo**: Percentil da IV atual vs IV histórica (52 semanas)
- **Range**: 0-100

#### 2. Skew
- **Cálculo**: Assimetria da distribuição de strikes
- **Uso**: Identificar oportunidades

#### 3. Term Structure
- **Cálculo**: IV por expiração
- **Uso**: Identificar oportunidades de calendar spreads

#### 4. Greeks
- **Delta, Gamma, Vega, Theta**: Fornecidos pelo provider
- **Uso**: Gestão de risco

## Experimentos

### Experimento 1: Order Flow Imbalance
1. **Dados**: Histórico com T&S (ou proxy)
2. **Features**: Imbalance, CVD, trade sign
3. **Estratégia**: Mean reversion quando imbalance extremo
4. **Parâmetros a testar**:
   - Threshold de imbalance (0.5, 0.6, 0.7, 0.8)
   - Janela de lookback (1m, 5m, 10m)
   - Hold time (1m, 5m, 10m)
5. **Métricas**: Sharpe, hit rate, profit factor, max DD

### Experimento 2: Breakout + Agressão
1. **Dados**: Histórico com níveis técnicos
2. **Features**: Price action, agressão, volume
3. **Estratégia**: Seguir breakout quando agressão confirma
4. **Parâmetros**:
   - Método de detecção de breakout (ATR, percentil, etc.)
   - Threshold de agressão
   - Confirmação de volume
5. **Métricas**: Sharpe, hit rate, profit factor

### Experimento 3: VWAP + Fluxo
1. **Dados**: Histórico intradiário
2. **Features**: VWAP deviation, CVD, imbalance
3. **Estratégia**: Trade quando desvio + fluxo confirma
4. **Parâmetros**:
   - Threshold de desvio (0.5%, 1%, 1.5%)
   - Threshold de confirmação de fluxo
5. **Métricas**: Sharpe, hit rate

## Metodologia de Validação

### Walk-Forward Optimization
1. **Dividir dados em períodos**: Ex: 6 meses treino, 1 mês teste
2. **Otimizar em treino**: Encontrar melhores parâmetros
3. **Testar em out-of-sample**: Aplicar parâmetros em teste
4. **Rolling window**: Avançar janela e repetir

### Purged Cross-Validation
- **Purge**: Remover dados próximos a eventos (earnings, etc.)
- **Gap**: Gap entre treino e teste
- **Uso**: Para evitar data leakage

### Testes por Regime
1. **Alta volatilidade**: VIX > 30
2. **Baixa volatilidade**: VIX < 15
3. **Trending**: Mercado em tendência
4. **Range-bound**: Mercado lateral

### Controle de Overfitting
1. **Limite de parâmetros**: Máximo N parâmetros por estratégia
2. **Estabilidade**: Performance deve ser estável por ticker/setor
3. **Simplicidade**: Preferir modelos simples
4. **Out-of-sample**: Performance OOS deve ser próxima de IS

## Critérios de Aceitação

### Mínimos (para considerar estratégia viável)
- **Sharpe Ratio**: > 1.5 (com ressalvas intradiárias)
- **Max Drawdown**: < 15%
- **Hit Rate**: > 45%
- **Profit Factor**: > 1.5
- **Stability**: Performance similar em diferentes períodos/regimes

### Ideais (para produção)
- **Sharpe Ratio**: > 2.0
- **Max Drawdown**: < 10%
- **Hit Rate**: > 50%
- **Profit Factor**: > 2.0
- **Capacity**: Pode escalar para $X de capital

## Roadmap de Pesquisa

### Fase 1: MVP (4-6 semanas)
1. **Semana 1-2**: Implementar features básicas (imbalance, VWAP, etc.)
2. **Semana 3-4**: Implementar 3 estratégias básicas
3. **Semana 5**: Backtest inicial
4. **Semana 6**: Ajustes e otimização

### Fase 2: Expansão (6-8 semanas)
1. **Semana 7-8**: Implementar features avançadas (T&S, L2)
2. **Semana 9-10**: Implementar 3 estratégias adicionais
3. **Semana 11-12**: Backtest robusto (walk-forward)
4. **Semana 13-14**: Paper trading e validação

### Fase 3: Produção (4-6 semanas)
1. **Semana 15-16**: Otimização final
2. **Semana 17-18**: Paper trading extensivo (30 dias)
3. **Semana 19-20**: Preparação para produção

## Métricas de Sucesso

### Pesquisa
- ✅ 6+ estratégias implementadas
- ✅ Features calculadas corretamente
- ✅ Backtest framework funcionando
- ✅ Walk-forward implementado

### Performance
- ✅ Pelo menos 2 estratégias com Sharpe > 1.5
- ✅ Max drawdown < 15% em todas
- ✅ Hit rate > 45% em estratégias viáveis

### Validação
- ✅ Performance OOS próxima de IS (< 20% degradação)
- ✅ Estabilidade por regime
- ✅ Paper trading confirma backtest
