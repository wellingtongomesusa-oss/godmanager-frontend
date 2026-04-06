# Diagnóstico - Safari não consegue conectar ao localhost

## Problema Identificado

O Docker daemon não está acessível, então os containers não estão rodando. Por isso o Safari não consegue conectar ao localhost:8000 ou localhost:3000.

## Solução Passo a Passo

### 1. Verificar se Docker Desktop está rodando

**No macOS:**
- Procure o ícone do Docker na barra de menu (canto superior direito)
- Se não estiver lá, o Docker Desktop não está rodando
- Se estiver cinza, está iniciando
- Se estiver verde, está rodando

### 2. Iniciar Docker Desktop

**Opção A: Via Finder**
1. Abra o Finder
2. Vá em "Aplicações"
3. Clique duas vezes em "Docker"

**Opção B: Via Spotlight**
1. Pressione `Cmd + Space`
2. Digite "Docker"
3. Pressione Enter

**Opção C: Via Terminal**
```bash
open -a Docker
```

### 3. Aguardar Docker iniciar

- Aguarde 30-60 segundos após iniciar
- O ícone na barra de menu deve ficar verde
- Você pode verificar com: `docker info`

### 4. Verificar permissões

Se o Docker estiver rodando mas ainda der erro de permissão:

```bash
# Verificar se você está no grupo docker (Linux)
groups | grep docker

# No macOS, geralmente não é necessário estar em grupo
# Mas verifique se o Docker Desktop tem permissões
```

### 5. Reiniciar Docker Desktop (se necessário)

Se o Docker estiver travado:

1. Clique no ícone do Docker na barra de menu
2. Selecione "Quit Docker Desktop"
3. Aguarde alguns segundos
4. Inicie novamente

### 6. Verificar se containers estão rodando

Após o Docker estar rodando:

```bash
cd /Users/wellingtongomes/cursor-projects/test2-docker
docker-compose ps
```

Você deve ver algo como:
```
NAME                      STATUS              PORTS
algo_trading_db          Up                  0.0.0.0:5432->5432/tcp
algo_trading_redis       Up                  0.0.0.0:6379->6379/tcp
algo_trading_engine      Up                  0.0.0.0:8000->8000/tcp
algo_trading_grafana     Up                  0.0.0.0:3000->3000/tcp
```

### 7. Se containers não estiverem rodando

```bash
# Iniciar containers
./start.sh

# Ou manualmente
docker-compose up -d
```

### 8. Verificar logs se algo falhar

```bash
# Logs do trading engine
docker-compose logs trading_engine

# Logs de todos os serviços
docker-compose logs

# Ver logs em tempo real
docker-compose logs -f trading_engine
```

## Testar Conectividade

Após os containers estiverem rodando:

### Teste 1: Via Terminal
```bash
curl http://localhost:8000/health
```

Deve retornar:
```json
{"status":"healthy","mode":"paper"}
```

### Teste 2: Via Browser
- Abra Safari
- Vá para: http://localhost:8000
- Deve ver uma resposta JSON

### Teste 3: Verificar portas
```bash
# Verificar se portas estão escutando
lsof -i :8000
lsof -i :3000

# Ou
netstat -an | grep LISTEN | grep -E "8000|3000"
```

## Problemas Comuns

### Erro: "permission denied"
- Docker Desktop não está rodando completamente
- Reinicie o Docker Desktop
- Aguarde o ícone ficar verde

### Erro: "Cannot connect to Docker daemon"
- Docker Desktop não está iniciado
- Inicie o Docker Desktop manualmente

### Portas não respondem
- Containers não estão rodando
- Verifique com `docker-compose ps`
- Inicie com `./start.sh`

### Container inicia mas para imediatamente
- Verifique logs: `docker-compose logs trading_engine`
- Pode haver erro no código
- Verifique se todas as dependências foram instaladas

## Próximos Passos

1. ✅ Iniciar Docker Desktop
2. ✅ Aguardar ícone ficar verde
3. ✅ Executar `./start.sh`
4. ✅ Verificar `docker-compose ps`
5. ✅ Testar `curl http://localhost:8000/health`
6. ✅ Abrir http://localhost:8000 no Safari
