# Arquitetura do Sistema

## Visão Geral

Sistema distribuído de trading algorítmico com arquitetura modular e escalável.

## Diagrama de Arquitetura (Texto)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Dashboard  │  │   API REST   │  │   WebSocket  │         │
│  │   (Grafana)  │  │   (FastAPI)  │  │   (Real-time)│         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼───────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼───────────────┐
│         │                  │                  │                │
│  ┌──────▼──────────────────▼──────────────────▼────────────┐   │
│  │              TRADING ENGINE (Core)                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Strategy │  │  Risk    │  │Execution │            │   │
│  │  │ Manager  │  │ Manager  │  │ Engine   │            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  └───────┼──────────────┼─────────────┼───────────────────┘   │
│          │              │             │                        │
└──────────┼──────────────┼─────────────┼───────────────────────┘
           │              │             │
┌──────────┼──────────────┼─────────────┼───────────────────────┐
│          │              │             │                        │
│  ┌───────▼──────┐  ┌────▼─────┐  ┌───▼──────────┐            │
│  │   Features   │  │  Paper    │  │   Backtest   │            │
│  │   Engine     │  │  Trading  │  │   Framework  │            │
│  └──────┬───────┘  └────┬──────┘  └──────┬───────┘            │
│         │               │                 │                     │
└─────────┼───────────────┼─────────────────┼─────────────────────┘
          │               │                 │
┌─────────┼───────────────┼─────────────────┼─────────────────────┐
│         │               │                 │                     │
│  ┌──────▼───────────────▼─────────────────▼──────────────┐      │
│  │           DATA INGESTION LAYER                       │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │      │
│  │  │ Polygon  │  │    IB    │  │  Alpaca  │          │      │
│  │  │ Provider │  │ Provider │  │ Provider│          │      │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │      │
│  └───────┼─────────────┼──────────────┼────────────────┘      │
│          │             │              │                         │
└──────────┼─────────────┼──────────────┼────────────────────────┘
           │             │              │
┌──────────┼─────────────┼──────────────┼────────────────────────┐
│          │             │              │                         │
│  ┌───────▼─────────────▼──────────────▼──────────────┐        │
│  │              DATA STORAGE LAYER                    │        │
│  │  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │ TimescaleDB  │  │    Redis     │              │        │
│  │  │ (PostgreSQL) │  │   (Cache)    │              │        │
│  │  └──────────────┘  └──────────────┘              │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
│  ┌────────────────────────────────────────────────────┐        │
│  │           EXTERNAL SERVICES                         │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │        │
│  │  │Broker API│  │Prometheus│  │  Grafana │        │        │
│  │  └──────────┘  └──────────┘  └──────────┘        │        │
│  └────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Componentes Principais

### 1. Data Ingestion Layer
- **Responsabilidade**: Ingestão de dados de múltiplas fontes
- **Componentes**:
  - Providers (Polygon, IB, Alpaca, Tradier)
  - Normalizadores de dados
  - Buffer/Queue (Redis)
- **Output**: Dados normalizados no TimescaleDB

### 2. Features Engine
- **Responsabilidade**: Cálculo de features em tempo real
- **Input**: Dados raw (OHLCV, T&S, L2)
- **Output**: Features calculadas (CVD, imbalance, VWAP, etc.)
- **Performance**: Otimizado para latência baixa

### 3. Strategy Manager
- **Responsabilidade**: Gerenciar múltiplas estratégias
- **Componentes**:
  - Strategy registry
  - Signal generation
  - Position management
- **Output**: Sinais de trading

### 4. Risk Manager
- **Responsabilidade**: Gestão de risco e guardrails
- **Componentes**:
  - Position limits
  - Loss limits
  - Greeks limits (opções)
  - Kill-switch
- **Output**: Aprovação/rejeição de trades

### 5. Execution Engine
- **Responsabilidade**: Execução de ordens
- **Componentes**:
  - Order router
  - Fill handler
  - Slippage model
  - Broker adapters
- **Output**: Ordens executadas

### 6. Paper Trading
- **Responsabilidade**: Simulação de trading ao vivo
- **Componentes**:
  - Market simulator
  - Fill simulator
  - PnL tracker
- **Output**: Trades simulados, PnL

### 7. Backtest Framework
- **Responsabilidade**: Backtesting histórico
- **Componentes**:
  - Data loader
  - Strategy runner
  - Cost model (spread, slippage, fees)
  - Performance analyzer
- **Output**: Relatórios de backtest

### 8. Monitoring & Observability
- **Responsabilidade**: Monitoramento e alertas
- **Componentes**:
  - Metrics (Prometheus)
  - Logs (estruturados)
  - Dashboard (Grafana)
  - Alerts
- **Output**: Métricas, logs, alertas

## Fluxo de Dados

### 1. Ingestão
```
Data Provider → Ingestion Service → Redis (buffer) → TimescaleDB
```

### 2. Trading Loop
```
TimescaleDB → Features Engine → Strategy Manager → Risk Manager → Execution Engine → Broker
```

### 3. Paper Trading
```
Real-time Data → Features → Strategy → Risk → Paper Execution → PnL Tracker
```

### 4. Backtest
```
Historical Data → Features → Strategy → Simulated Execution → Performance Analysis
```

## Tecnologias

### Backend
- **Python 3.11**: Linguagem principal
- **FastAPI**: API REST
- **WebSockets**: Dados em tempo real
- **asyncio**: Concorrência

### Database
- **TimescaleDB**: Dados de séries temporais
- **Redis**: Cache e mensageria

### Data Providers
- **Polygon API**: Dados principais
- **Interactive Brokers**: Execução e dados
- **Alpaca**: Paper trading
- **Tradier**: Opções

### Monitoring
- **Prometheus**: Métricas
- **Grafana**: Dashboards
- **Loguru**: Logging estruturado

### Containerização
- **Docker**: Containers
- **Docker Compose**: Orquestração

## Escalabilidade

### Horizontal
- Múltiplas instâncias do Trading Engine
- Load balancing via Redis
- Database sharding (futuro)

### Vertical
- Otimização de queries
- Caching agressivo
- Processamento paralelo

## Segurança

### Autenticação
- API keys para brokers
- Secrets management (env vars, futuramente Vault)

### Autorização
- Controle de acesso por função
- Auditoria de ações

### Dados
- Criptografia em trânsito (TLS)
- Criptografia em repouso (futuro)

## Checklist de Instalação

### Pré-requisitos
- [ ] Docker e Docker Compose instalados
- [ ] Python 3.11+ (para desenvolvimento local)
- [ ] Conta em provedor de dados (Polygon, IB, Alpaca, etc.)
- [ ] API keys configuradas

### Instalação

1. **Clone e configure**:
```bash
cd test2-docker
cp .env.example .env
# Edite .env com suas chaves de API
```

2. **Construa e inicie**:
```bash
docker-compose up -d
```

3. **Verifique logs**:
```bash
docker-compose logs -f trading_engine
```

4. **Acesse dashboard**:
- API: http://localhost:8000
- Grafana (se habilitado): http://localhost:3000

### Desenvolvimento Local

1. **Instale dependências**:
```bash
pip3 install -r requirements.txt
```

2. **Configure banco local**:
```bash
# Use docker-compose apenas para DB
docker-compose up -d timescaledb redis
```

3. **Execute módulos**:
```bash
python -m src.ingestion.main
python -m src.main
```

## Troubleshooting

### Docker não inicia
- Verifique se portas estão livres (5432, 6379, 8000)
- Verifique logs: `docker-compose logs`

### Banco não conecta
- Aguarde healthcheck: `docker-compose ps`
- Verifique variáveis de ambiente no .env

### Dados não chegam
- Verifique API keys no .env
- Verifique logs do ingestion: `docker-compose logs data_ingestion`
