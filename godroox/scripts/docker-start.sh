#!/bin/bash

# Script to start Godroox with Docker

set -e

echo "🚀 Starting Godroox with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if we want development mode
DEV_MODE=${1:-production}

if [ "$DEV_MODE" = "dev" ]; then
    echo "📦 Starting in DEVELOPMENT mode..."
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

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if PostgreSQL is ready
echo "🔍 Checking PostgreSQL..."
until docker-compose -f $COMPOSE_FILE exec -T postgres pg_isready -U godroox > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Check if Redis is ready
echo "🔍 Checking Redis..."
until docker-compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo "   Waiting for Redis..."
    sleep 2
done
echo "✅ Redis is ready"

# Run database migrations
echo "📊 Running database migrations..."
docker-compose -f $COMPOSE_FILE exec -T app npx prisma migrate deploy || \
docker-compose -f $COMPOSE_FILE exec -T app npx prisma migrate dev --name init || true

# Generate Prisma Client if needed
echo "🔧 Generating Prisma Client..."
docker-compose -f $COMPOSE_FILE exec -T app npx prisma generate || true

echo ""
echo "✅ Godroox is running!"
echo ""
echo "📍 Access the application at:"
echo "   http://localhost:3000"
echo ""
echo "📊 Services:"
echo "   - App: http://localhost:3000"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "📝 Useful commands:"
echo "   - View logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "   - Stop: docker-compose -f $COMPOSE_FILE down"
echo "   - Restart: docker-compose -f $COMPOSE_FILE restart"
echo ""
