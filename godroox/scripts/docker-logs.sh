#!/bin/bash

# Script to view Docker logs

SERVICE=${1:-app}

# Check which compose file is being used
if [ -f "docker-compose.dev.yml" ] && docker-compose -f docker-compose.dev.yml ps -q $SERVICE > /dev/null 2>&1; then
    docker-compose -f docker-compose.dev.yml logs -f $SERVICE
elif docker-compose -f docker-compose.yml ps -q $SERVICE > /dev/null 2>&1; then
    docker-compose -f docker-compose.yml logs -f $SERVICE
else
    echo "❌ Service '$SERVICE' is not running"
    exit 1
fi
