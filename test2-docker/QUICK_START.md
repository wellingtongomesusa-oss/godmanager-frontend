# Quick Start - Primeiros Passos

## Problema: Portas não carregam

Se as portas 8000 ou 3000 não estão carregando, siga estes passos:

## 1. Verificar se Docker está rodando

```bash
docker info
```

Se falhar, inicie o Docker Desktop.

## 2. Verificar containers

```bash
cd /Users/wellingtongomes/cursor-projects/test2-docker
docker-compose ps
```

## 3. Iniciar sistema

```bash
./start.sh
```

## 4. Verificar logs se algo falhar

```bash
# Logs do Trading Engine
docker-compose logs trading_engine

# Logs de todos os serviços
docker-compose logs

# Logs em tempo real
docker-compose logs -f trading_engine
```

## 5. Acessar API

Após iniciar, aguarde alguns segundos e acesse:

- **API Principal**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Status**: http://localhost:8000/api/status

## 6. Grafana (Opcional)

Para iniciar com Grafana:

```bash
./start_with_monitoring.sh
```

Ou manualmente:

```bash
docker-compose up -d grafana
```

Acesse: http://localhost:3000
- Usuário: `admin`
- Senha: `admin` (ou a configurada no .env)

## Problemas Comuns

### Container não inicia

1. Verificar logs:
   ```bash
   docker-compose logs trading_engine --tail 50
   ```

2. Verificar se há erros de import:
   ```bash
   docker-compose exec trading_engine python -c "import src.main"
   ```

3. Reconstruir container:
   ```bash
   docker-compose build --no-cache trading_engine
   docker-compose up -d trading_engine
   ```

### Porta 8000 não responde

1. Verificar se container está rodando:
   ```bash
   docker-compose ps trading_engine
   ```

2. Verificar se porta está mapeada:
   ```bash
   docker-compose port trading_engine 8000
   ```

3. Testar dentro do container:
   ```bash
   docker-compose exec trading_engine curl http://localhost:8000/health
   ```

### Erro de módulo não encontrado

Se houver erro de import, verificar se o código foi copiado:

```bash
docker-compose exec trading_engine ls -la /app/src/
```

### API retorna erro

Verificar logs em tempo real:

```bash
docker-compose logs -f trading_engine
```

## Estrutura da API

A API FastAPI agora está implementada em `src/api.py` e fornece:

- `GET /` - Informações básicas
- `GET /health` - Health check
- `GET /api/status` - Status do sistema

## Próximos Passos

1. Verificar se API está respondendo
2. Configurar API keys no `.env` (se necessário)
3. Verificar logs para erros
4. Testar endpoints da API
