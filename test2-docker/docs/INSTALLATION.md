# Guia de Instalação

## Pré-requisitos

### macOS

1. **Docker Desktop**
   ```bash
   # Instalar via Homebrew
   brew install --cask docker
   # Ou baixar de https://www.docker.com/products/docker-desktop
   ```

2. **Python 3.11+** (para desenvolvimento local)
   ```bash
   brew install python@3.11
   ```

3. **Git**
   ```bash
   brew install git
   ```

### Linux (Ubuntu/Debian)

1. **Docker e Docker Compose**
   ```bash
   sudo apt-get update
   sudo apt-get install docker.io docker-compose
   sudo usermod -aG docker $USER
   # Logout e login novamente
   ```

2. **Python 3.11+**
   ```bash
   sudo apt-get install python3.11 python3-pip
   ```

## Instalação

### 1. Clone e Configure

```bash
cd /Users/wellingtongomes/cursor-projects/test2-docker
cp .env.example .env
```

### 2. Editar .env

Edite o arquivo `.env` com suas configurações:

```bash
# Database (padrão está OK para desenvolvimento)
DB_USER=algo_trader
DB_PASSWORD=secure_password_change
DB_NAME=trading_db

# API Keys (OBRIGATÓRIO)
POLYGON_API_KEY=sua_chave_aqui
# ou
ALPACA_API_KEY=sua_chave_aqui
ALPACA_SECRET_KEY=sua_secret_aqui
```

### 3. Construir e Iniciar

```bash
# Construir imagens
docker-compose build

# Iniciar serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f trading_engine
```

### 4. Verificar Instalação

```bash
# Verificar banco de dados
docker-compose exec timescaledb psql -U algo_trader -d trading_db -c "\dt"

# Verificar Redis
docker-compose exec redis redis-cli ping
# Deve retornar: PONG

# Verificar API (quando implementada)
curl http://localhost:8000/health
```

## Desenvolvimento Local

### Opção 1: Apenas Banco de Dados via Docker

```bash
# Iniciar apenas DB e Redis
docker-compose up -d timescaledb redis

# Instalar dependências Python
pip3 install -r requirements.txt

# Executar módulos localmente
python3 -m src.ingestion.main
python3 -m src.main
```

### Opção 2: Tudo Local

```bash
# Instalar PostgreSQL e TimescaleDB localmente
# macOS:
brew install postgresql@15 timescaledb

# Linux:
# Seguir instruções em https://docs.timescale.com/install/latest/self-hosted/

# Instalar Redis
brew install redis  # macOS
sudo apt-get install redis  # Linux

# Configurar .env para apontar para localhost
DB_HOST=localhost
REDIS_HOST=localhost

# Instalar dependências
pip3 install -r requirements.txt

# Executar
python3 -m src.main
```

## Estrutura de Diretórios

```
test2-docker/
├── docker-compose.yml       # Orquestração
├── Dockerfile               # Imagem principal
├── requirements.txt         # Dependências Python
├── .env                     # Configurações (não commitado)
├── docs/                    # Documentação
├── src/                     # Código fonte
├── config/                  # Configurações
├── data/                    # Dados (gitignored)
└── logs/                    # Logs (gitignored)
```

## Comandos Úteis

### Docker

```bash
# Parar todos os serviços
docker-compose down

# Parar e remover volumes (CUIDADO: apaga dados)
docker-compose down -v

# Reconstruir após mudanças
docker-compose build --no-cache
docker-compose up -d

# Ver logs de um serviço específico
docker-compose logs -f trading_engine

# Executar comando em container
docker-compose exec trading_engine python -m src.main

# Acessar shell do container
docker-compose exec trading_engine bash
```

### Banco de Dados

```bash
# Conectar ao banco
docker-compose exec timescaledb psql -U algo_trader -d trading_db

# Backup
docker-compose exec timescaledb pg_dump -U algo_trader trading_db > backup.sql

# Restore
docker-compose exec -T timescaledb psql -U algo_trader trading_db < backup.sql
```

### Redis

```bash
# Conectar ao Redis
docker-compose exec redis redis-cli

# Limpar cache
docker-compose exec redis redis-cli FLUSHALL
```

## Troubleshooting

### Porta já em uso

```bash
# Verificar o que está usando a porta
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :8000  # API

# Parar processo ou mudar porta no docker-compose.yml
```

### Banco não conecta

```bash
# Verificar se container está rodando
docker-compose ps

# Verificar logs
docker-compose logs timescaledb

# Verificar variáveis de ambiente
docker-compose exec timescaledb env | grep DB
```

### Erro de permissão

```bash
# Docker no Linux
sudo usermod -aG docker $USER
# Logout e login novamente
```

### Dados não chegam

```bash
# Verificar API keys
docker-compose exec trading_engine env | grep API

# Verificar logs de ingestão
docker-compose logs data_ingestion

# Testar conexão com provider
docker-compose exec trading_engine python -c "from src.ingestion.providers.polygon import PolygonProvider; ..."
```

## Próximos Passos

1. **Configurar API Keys**: Adicionar chaves no `.env`
2. **Testar Ingestão**: Verificar se dados estão chegando
3. **Executar Backtest**: Testar estratégias com dados históricos
4. **Paper Trading**: Iniciar paper trading com dados reais
5. **Monitoramento**: Configurar Grafana (opcional)

## Suporte

Para problemas:
1. Verificar logs: `docker-compose logs`
2. Verificar documentação em `docs/`
3. Verificar issues conhecidos no código
