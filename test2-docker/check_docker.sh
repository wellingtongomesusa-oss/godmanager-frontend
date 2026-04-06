#!/bin/bash

# Script to check Docker status

echo "=========================================="
echo "  Docker Verification"
echo "=========================================="
echo ""

# Check if docker command exists
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

echo "✅ Docker command found"

# Check if docker info works
if docker info > /dev/null 2>&1; then
    echo "✅ Docker daemon is accessible"
    echo ""
    echo "Docker information:"
    docker info 2>/dev/null | grep -E "Server Version|Operating System|Kernel Version" | head -3
    echo ""
    
    # Check containers
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No containers running"
    echo ""
    
    # Check ports
    echo "Ports in use:"
    lsof -i :8000 -i :3000 2>/dev/null | grep LISTEN || echo "Ports 8000 and 3000 are not in use"
    
else
    echo "❌ Docker daemon is NOT accessible"
    echo ""
    echo "Possible causes:"
    echo "  1. Docker Desktop is not running"
    echo "  2. Docker Desktop is starting (wait 30-60 seconds)"
    echo "  3. Permission problem"
    echo ""
    echo "Solutions:"
    echo "  1. Open Docker Desktop manually"
    echo "  2. Wait for the icon in the menu bar to turn green"
    echo "  3. Run this script again"
    exit 1
fi

echo ""
echo "=========================================="
