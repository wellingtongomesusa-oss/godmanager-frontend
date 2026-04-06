# 🚀 Godroox - Quick Start com Docker

## ⚡ Iniciar o Projeto (3 passos)

### 1. Execute o script:

```bash
cd /Users/wellingtongomes/cursor-projects/godroox
./start-docker.sh dev
```

### 2. Aguarde alguns segundos

O script vai:
- ✅ Construir as imagens Docker
- ✅ Iniciar PostgreSQL, Redis e Next.js
- ✅ Configurar o banco de dados
- ✅ Rodar as migrations

### 3. Abra no navegador:

**http://localhost:8081** (porta padrão)

## 🔌 Usar Porta Diferente

### Opção 1: Variável de Ambiente
```bash
APP_PORT=8080 ./start-docker.sh dev
# Acesse: http://localhost:8080
```

### Opção 2: Arquivo .env
Crie `.env` com:
```bash
APP_PORT=8080
NEXTAUTH_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:8080
```

### Opção 3: Script Interativo
```bash
./scripts/docker-start-port.sh dev
# O script pergunta qual porta usar
```

Veja [PORT_CONFIG.md](./PORT_CONFIG.md) para mais detalhes.

## 🎯 O que você verá

- **Homepage** - Página inicial com informações sobre seguros, LLC e pagamentos
- **Páginas de Marketing** - Seguros de vida, LLC Flórida, Pagamentos internacionais
- **Dashboard** - Área autenticada (precisa de login)

## 🛑 Parar o Projeto

```bash
docker-compose -f docker-compose.dev.yml down
```

## 📊 Ver Logs

```bash
docker-compose -f docker-compose.dev.yml logs -f app
```

## 🔧 Comandos Úteis

### Acessar o banco de dados
```bash
docker-compose -f docker-compose.dev.yml exec postgres psql -U godroox -d godroox
```

### Prisma Studio (interface visual)
```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma studio
```
Depois acesse: http://localhost:5555

### Rodar migrations manualmente
```bash
docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev
```

## 🐛 Problemas Comuns

### Docker não está rodando
```bash
# Verifique se Docker Desktop está aberto
docker info
```

### Porta 8081 já em uso
```bash
# Use outra porta
APP_PORT=5000 ./start-docker.sh dev
```

### Erro de conexão com banco
Aguarde 30 segundos após iniciar. O PostgreSQL precisa de tempo para inicializar.

### Limpar tudo e recomeçar
```bash
docker-compose -f docker-compose.dev.yml down -v
./start-docker.sh dev
```

## 📚 Próximos Passos

1. Explore as páginas de marketing
2. Teste a API em http://localhost:3000/api/v1/health
3. Veja a documentação em [DOCKER.md](./DOCKER.md)
4. Configure porta customizada em [PORT_CONFIG.md](./PORT_CONFIG.md)

## ✅ Tudo Pronto!

O site está rodando em **http://localhost:8081** (ou sua porta customizada) 🎉
