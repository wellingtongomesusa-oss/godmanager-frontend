#!/bin/bash

# Script para iniciar Godroox com porta customizada

set -e

# Porta padrão
DEFAULT_PORT=3000

# Verificar se porta foi fornecida
if [ -z "$APP_PORT" ]; then
    if [ -f .env ]; then
        # Tentar ler do .env
        APP_PORT=$(grep "^APP_PORT=" .env | cut -d '=' -f2 | tr -d '"' || echo "$DEFAULT_PORT")
    else
        APP_PORT=$DEFAULT_PORT
    fi
fi

# Perguntar ao usuário se não foi definida
if [ "$APP_PORT" = "$DEFAULT_PORT" ] && [ -t 0 ]; then
    read -p "Qual porta deseja usar? (padrão: $DEFAULT_PORT): " USER_PORT
    if [ ! -z "$USER_PORT" ]; then
        APP_PORT=$USER_PORT
    fi
fi

export APP_PORT
export NEXTAUTH_URL="http://localhost:${APP_PORT}"
export ALLOWED_ORIGINS="http://localhost:${APP_PORT}"

echo "🚀 Iniciando Godroox na porta ${APP_PORT}..."
echo ""

# Verificar Docker
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker Desktop."
    exit 1
fi

# Usar modo dev por padrão
MODE=${1:-dev}

if [ "$MODE" = "dev" ]; then
    echo "📦 Modo DESENVOLVIMENTO (com hot reload)..."
    COMPOSE_FILE="docker-compose.dev.yml"
else
    echo "📦 Modo PRODUÇÃO..."
    COMPOSE_FILE="docker-compose.yml"
fi

# Parar containers existentes
echo "🛑 Parando containers existentes..."
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

# Construir e iniciar
echo "🔨 Construindo e iniciando containers..."
docker-compose -f $COMPOSE_FILE up --build -d

# Aguardar serviços
echo "⏳ Aguardando serviços ficarem prontos..."
sleep 10

echo ""
echo "✅ Godroox está rodando!"
echo ""
echo "📍 Acesse a aplicação em:"
echo "   🌐 http://localhost:${APP_PORT}"
echo ""
echo "📊 Serviços:"
echo "   - Next.js App: http://localhost:${APP_PORT}"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 Comandos úteis:"
echo "   - Ver logs: docker-compose -f $COMPOSE_FILE logs -f app"
echo "   - Parar: docker-compose -f $COMPOSE_FILE down"
echo ""
