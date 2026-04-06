# 🐳 Guia de Dockerfiles - Godroox

## 📋 Dockerfiles Disponíveis

### 1. `Dockerfile` (Padrão - com standalone)
- Usa Node 20
- Suporta standalone output (se habilitado no next.config.js)
- Fallback para npm start se standalone não estiver disponível
- **Recomendado para produção com standalone**

### 2. `Dockerfile.production` (Simplificado)
- Versão baseada na estrutura fornecida
- Usa Node 20
- **Não usa standalone** - copia tudo do builder
- Mais simples e direto
- **Recomendado se não quiser usar standalone**

### 3. `Dockerfile.dev` (Desenvolvimento)
- Para desenvolvimento com hot reload
- Volumes montados para código local
- **Usado pelo docker-compose.dev.yml**

## 🔧 Como Usar

### Opção 1: Com Standalone (menor imagem)

1. **Habilite standalone no next.config.js:**
```javascript
output: 'standalone',
```

2. **Use o Dockerfile padrão:**
```bash
docker build -t godroox .
```

### Opção 2: Sem Standalone (mais simples)

1. **Use Dockerfile.production:**
```bash
docker build -f Dockerfile.production -t godroox .
```

Ou altere o docker-compose.yml:
```yaml
build:
  dockerfile: Dockerfile.production
```

## 📊 Comparação

| Característica | Dockerfile | Dockerfile.production |
|---------------|------------|----------------------|
| Node Version | 20 | 20 |
| Standalone | Sim (se habilitado) | Não |
| Tamanho Imagem | Menor (com standalone) | Maior |
| Complexidade | Média | Baixa |
| Recomendado | Produção otimizada | Desenvolvimento/Simples |

## 🚀 Uso com Docker Compose

### Produção (com standalone):
```yaml
# docker-compose.yml já usa Dockerfile padrão
docker-compose up --build
```

### Produção (sem standalone):
Edite `docker-compose.yml`:
```yaml
build:
  dockerfile: Dockerfile.production
```

### Desenvolvimento:
```yaml
# docker-compose.dev.yml já usa Dockerfile.dev
docker-compose -f docker-compose.dev.yml up --build
```

## 💡 Recomendações

- **Para desenvolvimento local**: Use `docker-compose.dev.yml` (já configurado)
- **Para produção com otimização**: Use `Dockerfile` com standalone habilitado
- **Para simplicidade**: Use `Dockerfile.production`

## 🔄 Mudando entre versões

Para alternar entre standalone e não-standalone:

1. **Habilitar standalone:**
   - Descomente `output: 'standalone'` em `next.config.js`
   - Use `Dockerfile` padrão

2. **Desabilitar standalone:**
   - Comente `output: 'standalone'` em `next.config.js`
   - Use `Dockerfile.production` ou ajuste `Dockerfile`

## ✅ Teste

```bash
# Build e test
docker build -t godroox-test .
docker run -p 3000:3000 godroox-test
```

Acesse: http://localhost:3000
