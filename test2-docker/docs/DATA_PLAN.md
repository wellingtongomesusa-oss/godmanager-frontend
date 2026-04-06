# Plano de Dados

## Visão Geral

Este documento detalha as fontes de dados, requisitos, custos, latência e armazenamento para o sistema de trading algorítmico.

## Dados Necessários

### MVP (Minimum Viable Product)

#### 1. OHLCV Intradiário
- **Frequência**: 1 minuto, 5 minutos
- **Mercados**: NYSE, Nasdaq, AMEX
- **Ajustes**: Dividends, splits
- **Cobertura**: Universo filtrado por liquidez

#### 2. Dados Diários
- **OHLCV diário ajustado**
- **Volume**
- **Corporate actions**: Dividends, splits

#### 3. Calendário de Mercado
- **Horários de trading**
- **Feriados**
- **Early close**

### V2 (Expansão)

#### 4. Time & Sales (T&S)
- **Prints**: Cada trade executado
- **Agressor**: Buy/sell identificado
- **Volume por trade**
- **Timestamp preciso**

#### 5. Level 2 / Order Book
- **Top-of-book**: Melhor bid/ask
- **Profundidade**: Múltiplos níveis (ideal)
- **Tamanhos**: Quantidade em cada nível
- **Atualizações em tempo real**

#### 6. Opções
- **Cadeia completa**: Todos os strikes e expirações
- **Greeks**: Delta, gamma, vega, theta
- **IV**: Implied volatility
- **OI**: Open interest
- **Volume**: Volume de opções
- **NBBO**: National Best Bid/Offer
- **Trades**: Execuções de opções

#### 7. Dados Adicionais
- **Borrow/short**: Taxa de empréstimo (quando aplicável)
- **Earnings calendar**: Datas de resultados
- **Economic calendar**: FOMC, CPI, etc.

## Provedores de Dados

### 1. Polygon.io

#### Prós
- ✅ Dados intradiários completos (1s, 1m, 5m)
- ✅ Time & Sales disponível
- ✅ Level 2 disponível
- ✅ Opções completas (greeks, IV, OI)
- ✅ API moderna e bem documentada
- ✅ WebSocket para dados em tempo real
- ✅ Histórico extenso

#### Limitações
- ❌ Custo: $99-199/mês para planos com T&S/L2
- ❌ Latência: Não é ultra-low latency (mas adequado)
- ❌ Rate limits em planos básicos

#### Uso Recomendado
- **MVP**: Plan básico ($99/mês) para OHLCV
- **V2**: Plan avançado ($199/mês) para T&S e L2
- **Opções**: Incluído em planos avançados

#### API Keys Necessárias
- `POLYGON_API_KEY`: Chave da API

### 2. Interactive Brokers (IB)

#### Prós
- ✅ Dados em tempo real (com conta)
- ✅ Execução integrada
- ✅ Opções completas
- ✅ Custo baixo para dados (com trading)
- ✅ Latência baixa

#### Limitações
- ❌ Requer conta de trading
- ❌ Complexidade de integração (IB API)
- ❌ Dados históricos limitados
- ❌ Requer manutenção de conexão

#### Uso Recomendado
- **Execução live**: Principal
- **Dados em tempo real**: Quando disponível
- **Opções**: Para execução

#### Configuração
- `IB_HOST`: 127.0.0.1
- `IB_PORT`: 7497 (paper), 7496 (live)

### 3. Alpaca

#### Prós
- ✅ API moderna e simples
- ✅ Paper trading integrado
- ✅ Dados gratuitos limitados
- ✅ Boa para desenvolvimento

#### Limitações
- ❌ Dados limitados (sem T&S, L2)
- ❌ Foco em ações (opções limitadas)
- ❌ Histórico limitado

#### Uso Recomendado
- **Paper trading**: Principal
- **Desenvolvimento**: Dados básicos
- **Execução**: Alternativa a IB

#### API Keys
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `ALPACA_BASE_URL`: paper ou live

### 4. Tradier

#### Prós
- ✅ Boa para opções
- ✅ API simples
- ✅ Dados de opções completos

#### Limitações
- ❌ Custos adicionais
- ❌ Dados limitados para ações
- ❌ Menos histórico

#### Uso Recomendado
- **Opções**: Alternativa
- **Execução de opções**: Quando necessário

### 5. IEX Cloud

#### Prós
- ✅ Dados gratuitos (limitados)
- ✅ Boa para testes

#### Limitações
- ❌ Rate limits rigorosos
- ❌ Dados limitados
- ❌ Sem T&S, L2

#### Uso Recomendado
- **Desenvolvimento**: Testes básicos
- **Não recomendado para produção**

## Combinação Mínima para MVP

### Opção 1: Polygon Básico
- **Fonte**: Polygon.io (plan básico)
- **Dados**: OHLCV intradiário (1m, 5m) e diário
- **Custo**: ~$99/mês
- **Latência**: Adequada para estratégias não-HFT

### Opção 2: Alpaca (Desenvolvimento)
- **Fonte**: Alpaca (gratuito)
- **Dados**: OHLCV básico
- **Custo**: Gratuito
- **Limitações**: Dados limitados, sem histórico extenso

## Combinação para Tape Reading Robusto (V2)

### Recomendado: Polygon Avançado + IB
- **Polygon**: T&S, L2, histórico
- **IB**: Dados em tempo real, execução
- **Custo**: ~$199/mês (Polygon) + dados IB (com trading)
- **Latência**: Baixa (IB) + histórico (Polygon)

## Armazenamento

### TimescaleDB (PostgreSQL)

#### Estrutura
- **Hypertables**: Para séries temporais
- **Índices**: Otimizados para queries temporais
- **Retention**: Configurável por tipo de dado

#### Tabelas Principais
1. `intraday_bars`: OHLCV intradiário
2. `trades`: Execuções de trades
3. `positions`: Posições atuais
4. `daily_pnl`: PnL diário

#### Estimativa de Armazenamento
- **OHLCV 1m**: ~1GB por 1000 símbolos por ano
- **T&S**: ~10GB por 1000 símbolos por ano (se armazenado)
- **L2**: ~50GB por 1000 símbolos por ano (se armazenado)

### Redis (Cache)

#### Uso
- **Buffer de dados recentes**: Últimos N minutos
- **Features calculadas**: Cache de features
- **Pub/Sub**: Notificações de dados novos

#### TTL
- **Dados recentes**: 60 segundos
- **Features**: 10 segundos

## Latência

### Requisitos por Estratégia

#### Estratégias de Mean Reversion (Order Flow)
- **Latência aceitável**: < 1 segundo
- **Dados necessários**: T&S, L2 (ideal)

#### Estratégias de Momentum
- **Latência aceitável**: < 5 segundos
- **Dados necessários**: OHLCV intradiário

#### Estratégias de VWAP
- **Latência aceitável**: < 1 segundo
- **Dados necessários**: OHLCV intradiário

### Pipeline de Dados

```
Data Provider → Ingestion → Redis (buffer) → TimescaleDB
                    ↓
              Features Engine
                    ↓
              Strategy Manager
```

**Latência total estimada**: 100-500ms (dependendo do provider)

## Custos Estimados

### MVP (Mensal)
- **Polygon básico**: $99
- **Infraestrutura (cloud)**: $50-100
- **Total**: ~$150-200/mês

### V2 (Mensal)
- **Polygon avançado**: $199
- **IB dados** (com trading): Incluído
- **Infraestrutura**: $100-200
- **Total**: ~$300-400/mês

## Implementação

### Fase 1: MVP
1. Configurar Polygon (plan básico)
2. Implementar ingestão de OHLCV
3. Armazenar em TimescaleDB
4. Cache em Redis

### Fase 2: V2
1. Upgrade Polygon (plan avançado)
2. Implementar T&S e L2
3. Integrar IB para dados em tempo real
4. Otimizar latência

## Monitoramento de Dados

### Métricas
- **Latência de ingestão**: Tempo do provider → sistema
- **Completude**: % de dados recebidos vs esperado
- **Qualidade**: Detecção de gaps, outliers
- **Custo**: Tracking de uso de API

### Alertas
- **Gaps de dados**: Quando dados não chegam
- **Latência alta**: Quando latência > threshold
- **Erros de API**: Quando provider retorna erro
- **Custo alto**: Quando uso de API > budget
