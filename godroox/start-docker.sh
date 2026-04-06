#!/bin/bash

# Quick start script for Godroox Docker

set -e

echo "🚀 Starting Godroox with Docker..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Use development mode by default for easier development
MODE=${1:-dev}

if [ "$MODE" = "dev" ]; then
    echo "📦 Starting in DEVELOPMENT mode (with hot reload)..."
    COMPOSE_FILE="docker-compose.dev.yml"
else
    echo "📦 Starting in PRODUCTION mode..."
    COMPOSE_FILE="docker-compose.yml"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose -f $COMPOSE_FILE up --build -d

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
for i in {1..30}; do
    if docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U godroox > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  PostgreSQL is taking longer than expected..."
    fi
    sleep 2
done

# Check Redis
echo "🔍 Checking Redis..."
for i in {1..30}; do
    if docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Redis is taking longer than expected..."
    fi
    sleep 2
done

# Run migrations (only in dev mode)
if [ "$MODE" = "dev" ]; then
    echo "📊 Setting up database..."
    docker-compose -f $COMPOSE_FILE exec -T app npx prisma generate || true
    docker-compose -f $COMPOSE_FILE exec -T app npx prisma migrate dev --name init || \
    docker-compose -f $COMPOSE_FILE exec -T app npx prisma migrate deploy || true
fi

echo ""
echo "✅ Godroox is running!"
echo ""
# Get port from environment or default to 8081
APP_PORT=${APP_PORT:-8081}

echo "📍 Access the application at:"
echo "   🌐 http://localhost:${APP_PORT}"
echo ""
echo "📊 Services:"
echo "   - Next.js App: http://localhost:${APP_PORT}"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 Useful commands:"
echo "   - View logs: docker-compose -f $COMPOSE_FILE logs -f app"
echo "   - Stop: docker-compose -f $COMPOSE_FILE down"
echo "   - Restart: docker-compose -f $COMPOSE_FILE restart app"
echo "   - Database Studio: docker-compose -f $COMPOSE_FILE exec app npx prisma studio"
echo ""
echo "🎉 Open http://localhost:${APP_PORT:-8081} in your browser!"
