#!/bin/bash

echo "🚀 Starting Secure Website v1..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Generate SSL certificates if they don't exist
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "🔐 Generating SSL certificates..."
    ./generate-ssl.sh
fi

# Start the application (always rebuild to ensure code changes are applied)
echo "🏗️  Building and starting Docker containers..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose exec -T db pg_isready -U user -d secure_website > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if docker-compose exec -T redis redis-cli -a redispassword ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Check Web App
if curl -k -s https://localhost/ > /dev/null 2>&1; then
    echo "✅ Web application is ready"
else
    echo "⚠️  Web application is not ready yet (may take a moment)"
fi

echo ""
echo "🌐 Application is running at: https://localhost"
echo ""
echo "📋 Default admin credentials:"
echo "   Username: admin"
echo "   Password: Admin123!"
echo ""
echo "📖 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo "⚠️  Note: You may need to accept the self-signed SSL certificate in your browser"

