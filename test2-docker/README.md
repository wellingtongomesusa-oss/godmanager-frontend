# Sistema de Trading Algorítmico - Algo Trading Bot

Sistema completo de pesquisa, backtest, paper trading e execução para ações e opções dos EUA.

## Estrutura do Projeto

```
test2-docker/
├── docker-compose.yml          # Orquestração de serviços
├── Dockerfile                   # Imagem principal
├── requirements.txt             # Dependências Python
├── .env.example                 # Variáveis de ambiente
├── start.sh                     # Script para iniciar sistema
├── stop.sh                      # Script para parar sistema
├── docs/                        # Documentação
│   ├── PRD_QUANT.md            # Product Requirements Document
│   ├── ARCHITECTURE.md          # Arquitetura do sistema
│   ├── DATA_PLAN.md             # Plano de dados
│   ├── RESEARCH_PLAN.md         # Plano de pesquisa
│   └── INSTALLATION.md          # Guia de instalação
├── src/
│   ├── ingestion/               # Ingestão de dados
│   ├── features/                # Engenharia de features
│   ├── strategies/              # Estratégias de trading
│   ├── backtest/                # Framework de backtest
│   ├── paper_trading/           # Paper trading ao vivo
│   ├── execution/               # Execução de ordens
│   ├── risk/                    # Gestão de risco
│   ├── monitoring/              # Dashboard e observabilidade
│   └── utils/                   # Utilitários
├── config/                      # Configurações
├── data/                        # Dados (gitignored)
└── tests/                       # Testes

```

## Quick Start

### Usando os Scripts (Recomendado)

```bash
# Iniciar sistema (Docker)
./start.sh

# Iniciar sistema e instalar dependências localmente também
./start.sh --local

# Setup para desenvolvimento local (sem Docker)
./setup_local.sh

# Parar sistema
./stop.sh
```

### Usando Docker Compose Diretamente

```bash
# Construir e iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

## Meta de Performance (Hipótese)

- **Meta-alvo**: 2% ao dia OU 5% por semana
- **Tratado como**: Hipótese testável, não promessa
- **Métricas obrigatórias**: Expected return, vol, max drawdown, tail risk, capacity, turnover, hit rate, profit factor, Sharpe/Sortino

## Universo

- **Mercado**: EUA (NYSE/Nasdaq/AMEX)
- **Filtros de liquidez**:
  - Preço > $5
  - Volume médio 20d > X
  - Spread médio < Y bps
- **Opções**: Cadeias líquidas (OI, volume, bid-ask, IV)

## Estratégias Implementadas

1. Order Flow Imbalance → Mean Reversion
2. Breakout com confirmação de agressão (tape)
3. VWAP/Anchored VWAP + Fluxo
4. Momentum intradiário por janelas
5. Opções: IV/liquidez + estrutura
6. Pairs/sector flow como contexto

## Status

🚧 **Em Desenvolvimento** - MVP em construção

## Troubleshooting

Se encontrar problemas ao fazer build do Docker, consulte [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para soluções comuns.
