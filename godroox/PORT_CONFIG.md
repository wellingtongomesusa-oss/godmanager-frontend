# 🔌 Configuração de Portas - Godroox

## 📋 Portas Padrão

- **Next.js App**: `8081` (mapeia para porta 3000 dentro do container)
- **PostgreSQL**: `5432`
- **Redis**: `6379`

## ⚙️ Como Alterar a Porta

### Opção 1: Variável de Ambiente

```bash
# Definir porta antes de iniciar
export APP_PORT=8080
./start-docker.sh dev
```

### Opção 2: Arquivo .env

Crie ou edite `.env`:

```bash
APP_PORT=8080
NEXTAUTH_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:8080
```

Depois execute:
```bash
./start-docker.sh dev
```

### Opção 3: Script com Porta Customizada

```bash
# O script pergunta qual porta usar
./scripts/docker-start-port.sh dev
```

### Opção 4: Linha de Comando Direta

```bash
# Produção
APP_PORT=8080 docker-compose up --build

# Desenvolvimento
APP_PORT=8080 docker-compose -f docker-compose.dev.yml up --build
```

## 🔧 Exemplos de Uso

### Porta 8081 (padrão)
```bash
./start-docker.sh dev
# Acesse: http://localhost:8081
```

### Porta 5000
```bash
APP_PORT=5000 ./start-docker.sh dev
# Acesse: http://localhost:5000
```

### Porta 3000
```bash
APP_PORT=3000 docker-compose -f docker-compose.dev.yml up --build
# Acesse: http://localhost:3000
```

## 📝 Alterar Outras Portas

### PostgreSQL
```bash
POSTGRES_PORT=5433 docker-compose up
```

### Redis
```bash
REDIS_PORT=6380 docker-compose up
```

## ⚠️ Importante

Quando alterar a porta da aplicação, também atualize:

1. **NEXTAUTH_URL** no `.env`:
   ```bash
   NEXTAUTH_URL=http://localhost:SUA_PORTA
   ```

2. **ALLOWED_ORIGINS** no `.env`:
   ```bash
   ALLOWED_ORIGINS=http://localhost:SUA_PORTA
   ```

## 🐛 Troubleshooting

### Porta já em uso

Se a porta estiver ocupada:

1. **Verificar qual processo está usando:**
   ```bash
   # macOS/Linux
   lsof -i :8080
   
   # Ou
   netstat -an | grep 8080
   ```

2. **Parar o processo ou usar outra porta:**
   ```bash
   APP_PORT=5000 ./start-docker.sh dev
   ```

### Erro de permissão

Se não conseguir usar portas abaixo de 1024:

```bash
# Use porta acima de 1024 (8080 já está acima)
APP_PORT=5000 ./start-docker.sh dev
```

## 📚 Verificar Portas em Uso

```bash
# Ver todas as portas em uso
docker-compose ps

# Ver portas do container
docker port godroox_app
```

## ✅ Checklist

- [ ] Porta escolhida está disponível
- [ ] NEXTAUTH_URL atualizado no .env
- [ ] ALLOWED_ORIGINS atualizado no .env
- [ ] Firewall permite a porta (se necessário)
