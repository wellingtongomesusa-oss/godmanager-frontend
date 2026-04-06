FROM python:3.11-slim

# Metadados
LABEL maintainer="Algo Trading System"
LABEL description="Sistema de Trading Algorítmico"

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    postgresql-client \
    curl \
    make \
    cmake \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependências Python em etapas
COPY requirements.txt .

# Atualizar pip primeiro
RUN pip install --upgrade pip setuptools wheel

# Instalar dependências essenciais primeiro (MVP)
# Se estas falharem, o build para
RUN pip install \
    numpy \
    pandas \
    scipy \
    psycopg2-binary \
    sqlalchemy \
    redis \
    fastapi \
    "uvicorn[standard]" \
    python-dotenv \
    pydantic \
    pydantic-settings \
    loguru \
    prometheus-client

# Instalar dependências opcionais (não falhar se não funcionar)
RUN pip install polygon-api-client || echo "AVISO: polygon-api-client falhou"
RUN pip install alpaca-trade-api || echo "AVISO: alpaca-trade-api falhou"
RUN pip install backtrader || echo "AVISO: backtrader falhou"
RUN pip install pandas-ta || echo "AVISO: pandas-ta falhou"
RUN pip install py_vollib || echo "AVISO: py_vollib falhou"
RUN pip install websockets || echo "AVISO: websockets falhou"
RUN pip install schedule || echo "AVISO: schedule falhou"
RUN pip install hiredis || echo "AVISO: hiredis falhou"
RUN pip install ib-insync || echo "AVISO: ib-insync falhou"

# Instalar ferramentas de desenvolvimento (opcional)
RUN pip install pytest pytest-asyncio pytest-cov black flake8 mypy || \
    echo "AVISO: Ferramentas de desenvolvimento falharam (opcional)"

# Copiar código fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/data /app/logs /app/config

# Expor porta
EXPOSE 8000

# Comando padrão (pode ser sobrescrito no docker-compose)
CMD ["python", "-m", "src.main"]
