#!/bin/bash

# Script to stop Godroox Docker containers

set -e

echo "🛑 Stopping Godroox containers..."

# Check which compose file is being used
if [ -f "docker-compose.dev.yml" ] && docker-compose -f docker-compose.dev.yml ps -q > /dev/null 2>&1; then
    docker-compose -f docker-compose.dev.yml down
elif docker-compose -f docker-compose.yml ps -q > /dev/null 2>&1; then
    docker-compose -f docker-compose.yml down
else
    echo "⚠️  No running containers found"
fi

echo "✅ Containers stopped"
