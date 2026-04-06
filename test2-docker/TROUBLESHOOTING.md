# Troubleshooting - Problemas de Build

## Erro: "failed to solve: process pip install did not complete successfully"

### Causa
Alguns pacotes no `requirements.txt` podem causar problemas durante o build do Docker:
- Pacotes que requerem bibliotecas C compiladas
- Versões incompatíveis
- Dependências faltando

### Solução 1: Usar requirements-minimal.txt

Se o build falhar, tente usar o arquivo mínimo:

```bash
# Fazer backup do requirements.txt original
cp requirements.txt requirements-full.txt

# Usar versão mínima
cp requirements-minimal.txt requirements.txt

# Tentar build novamente
docker-compose build
```

### Solução 2: Instalar dependências problemáticas separadamente

Algumas dependências foram comentadas no `requirements.txt` porque requerem instalação especial:

#### ta-lib
```bash
# No Dockerfile, adicionar antes do pip install:
RUN apt-get install -y libta-lib0-dev && \
    pip install ta-lib
```

#### QuantLib
```bash
# QuantLib requer Boost e outras dependências
# Considere usar alternativas como py_vollib para opções
```

### Solução 3: Atualizar versões

Se houver conflitos de versão, tente usar ranges ao invés de versões fixas:

```txt
# Ao invés de:
numpy==1.24.3

# Use:
numpy>=1.24.0,<2.0.0
```

## Pacotes Removidos/Comentados

### timescaledb==0.1.0
- **Motivo**: Não é um pacote Python válido. TimescaleDB é uma extensão do PostgreSQL.
- **Solução**: Não necessário - TimescaleDB já está no container `timescaledb`.

### ta-lib==0.4.28
- **Motivo**: Requer biblioteca C `ta-lib` instalada no sistema.
- **Solução**: Instalar `libta-lib0-dev` no Dockerfile se necessário, ou usar `pandas-ta` que é puro Python.

### QuantLib==1.32
- **Motivo**: Requer compilação complexa com Boost e outras dependências.
- **Solução**: Usar `py_vollib` para cálculos de opções (mais simples).

### vectorbt==0.25.2
- **Motivo**: Pode ter problemas de compatibilidade com outras dependências.
- **Solução**: Usar `backtrader` que é mais estável, ou instalar separadamente se necessário.

## Verificar Erros Específicos

Para ver o erro completo durante o build:

```bash
docker-compose build --no-cache data_ingestion 2>&1 | tee build.log
```

Depois verifique o arquivo `build.log` para ver qual pacote específico está falhando.

## Build Incremental

Se alguns pacotes falharem, você pode instalar os essenciais primeiro:

```dockerfile
# No Dockerfile, instalar em etapas:
RUN pip install numpy pandas scipy
RUN pip install psycopg2-binary sqlalchemy redis
RUN pip install fastapi uvicorn loguru
# ... etc
```

## Alternativa: Usar Imagem Base com Dependências

Se continuar tendo problemas, considere usar uma imagem base que já tenha algumas dependências:

```dockerfile
FROM python:3.11-slim-bullseye

# Ou use uma imagem científica
FROM continuumio/miniconda3:latest
```

## Logs de Build

Para ver logs detalhados:

```bash
docker-compose build --progress=plain 2>&1 | tee build.log
```

## Limpar Cache e Rebuild

Se houver problemas de cache:

```bash
docker-compose build --no-cache
docker system prune -a  # CUIDADO: Remove todas as imagens não usadas
```
