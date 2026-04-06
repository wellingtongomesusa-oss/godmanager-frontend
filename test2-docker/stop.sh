#!/bin/bash

# Script to stop the Algorithmic Trading System

set -e

echo "=========================================="
echo "  Stopping Algorithmic Trading System"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Stop containers
echo "Stopping containers..."
docker-compose down

echo ""
echo -e "${GREEN}✅ System stopped successfully!${NC}"
echo ""
echo "To also remove volumes (WARNING: deletes data):"
echo "  docker-compose down -v"
echo ""
