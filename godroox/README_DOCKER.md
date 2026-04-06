# 🐳 Godroox - Docker Quick Start

## ⚡ Início Rápido

### 1. Iniciar o projeto

```bash
./start-docker.sh
```

Ou para modo desenvolvimento (com hot reload):

```bash
./start-docker.sh dev
```

### 2. Acessar o site

Abra no navegador: **http://localhost:8081**

### 3. Parar o projeto

```bash
docker-compose down
```

## 📋 O que está incluído

- ✅ **Next.js App** (porta 8081)
- ✅ **PostgreSQL** (porta 5432)
- ✅ **Redis** (porta 6379)

## 🛠️ Comandos Úteis

### Ver logs
```bash
docker-compose logs -f app
```

### Acessar banco de dados
```bash
docker-compose exec postgres psql -U godroox -d godroox
```

### Rodar migrations
```bash
docker-compose exec app npx prisma migrate dev
```

### Prisma Studio (interface visual do banco)
```bash
docker-compose exec app npx prisma studio
```
Depois acesse: http://localhost:5555

## 🔧 Troubleshooting

### Porta já em uso
Se a porta 8081 estiver ocupada, pare o serviço que está usando ou altere a porta:
```bash
APP_PORT=5000 ./start-docker.sh dev
```

### Erro de conexão com banco
Aguarde alguns segundos após iniciar. O PostgreSQL precisa de tempo para inicializar.

### Limpar tudo e começar de novo
```bash
docker-compose down -v
./start-docker.sh dev
```

## 📚 Mais informações

Veja [DOCKER.md](./DOCKER.md) para documentação completa.
