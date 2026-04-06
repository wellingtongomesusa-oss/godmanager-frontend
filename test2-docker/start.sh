#!/bin/bash

# Script to start the Algorithmic Trading System

set -e

echo "=========================================="
echo "  Algorithmic Trading System"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not accessible. Attempting to start Docker Desktop...${NC}"
    
    # Try to open Docker Desktop (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if [ -d "/Applications/Docker.app" ]; then
            echo "Opening Docker Desktop..."
            open -a Docker
            echo -e "${YELLOW}Waiting for Docker Desktop to start (this may take 30-60 seconds)...${NC}"
            
            # Wait for Docker to become available (max 60 seconds)
            MAX_WAIT=60
            WAITED=0
            while ! docker info > /dev/null 2>&1 && [ $WAITED -lt $MAX_WAIT ]; do
                sleep 2
                WAITED=$((WAITED + 2))
                echo -n "."
            done
            echo ""
            
            if docker info > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Docker Desktop started successfully!${NC}"
            else
                echo -e "${RED}❌ Docker Desktop did not start in time.${NC}"
                echo -e "${YELLOW}Please start Docker Desktop manually and try again.${NC}"
                exit 1
            fi
        else
            echo -e "${RED}❌ Docker Desktop not found at /Applications/Docker.app${NC}"
            echo -e "${YELLOW}Please install Docker Desktop or start it manually.${NC}"
            exit 1
        fi
    else
        # Linux
        echo -e "${RED}❌ Docker is not running.${NC}"
        echo -e "${YELLOW}Please start Docker manually:${NC}"
        echo "  sudo systemctl start docker"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Check if should install dependencies locally (for development)
if [ "$1" == "--local" ] || [ "$1" == "-l" ]; then
    echo ""
    echo -e "${YELLOW}Local development mode detected${NC}"
    
    # Check if Python 3 is installed
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}❌ Python 3 not found. Please install Python 3.11+${NC}"
        exit 1
    fi
    
    # Check if pip3 is installed
    if ! command -v pip3 &> /dev/null; then
        echo -e "${RED}❌ pip3 not found. Please install pip3${NC}"
        exit 1
    fi
    
    # Check if virtualenv exists
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtualenv
    echo "Activating virtual environment..."
    source venv/bin/activate
    
    # Install/update dependencies
    echo "Installing/updating Python dependencies..."
    pip3 install --upgrade pip
    pip3 install -r requirements.txt
    
    echo -e "${GREEN}✅ Dependencies installed locally${NC}"
    echo ""
    echo "To run locally (without Docker):"
    echo "  source venv/bin/activate"
    echo "  python3 -m src.main"
    echo ""
    echo "Continuing with Docker as well..."
    echo ""
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please edit the .env file with your API keys before continuing.${NC}"
        echo -e "${YELLOW}   Press Enter to continue or Ctrl+C to cancel...${NC}"
        read
    else
        echo -e "${RED}❌ .env.example file not found${NC}"
        exit 1
    fi
fi

# Stop existing containers (if any)
echo ""
echo "Stopping existing containers (if any)..."
docker-compose down 2>/dev/null || true

# Build images (if necessary)
echo ""
echo "Checking/building Docker images..."
BUILD_LOG="/tmp/docker_build_$(date +%s).log"

if ! docker-compose build 2>&1 | tee "$BUILD_LOG"; then
    echo ""
    echo -e "${RED}❌ Error building Docker images${NC}"
    echo ""
    echo "Analyzing error..."
    
    # Check error type
    if grep -qi "requirements.txt\|pip install" "$BUILD_LOG"; then
        echo -e "${YELLOW}⚠️  Problem detected with dependency installation${NC}"
        echo ""
        echo "The Dockerfile has been updated to install dependencies in stages."
        echo "Essential dependencies are installed first, optional ones after."
        echo ""
        echo "Options:"
        echo "  1. Try again (may work now)"
        echo "  2. Use Dockerfile.robust (simpler version)"
        echo "  3. Use requirements-minimal.txt"
        echo "  4. View full logs"
        echo ""
        read -p "Choose an option (1-4): " choice
        
        case $choice in
            1)
                echo "Trying build again..."
                docker-compose build
                ;;
            2)
                echo "Using Dockerfile.robust..."
                cp Dockerfile Dockerfile.original.bak
                cp Dockerfile.robust Dockerfile
                docker-compose build
                ;;
            3)
                if [ -f requirements-minimal.txt ]; then
                    echo "Backing up and using requirements-minimal.txt..."
                    cp requirements.txt requirements-full.txt.bak
                    cp requirements-minimal.txt requirements.txt
                    docker-compose build
                else
                    echo -e "${RED}❌ requirements-minimal.txt not found${NC}"
                    exit 1
                fi
                ;;
            4)
                echo "Full logs saved at: $BUILD_LOG"
                echo "Last 50 lines:"
                tail -50 "$BUILD_LOG"
                exit 1
                ;;
            *)
                echo "Invalid option"
                exit 1
                ;;
        esac
        
        # Check if build worked after attempt
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Build still failing${NC}"
            echo "Logs saved at: $BUILD_LOG"
            echo ""
            echo "For diagnosis:"
            echo "  cat $BUILD_LOG | grep -i error"
            exit 1
        fi
    else
        echo "Error not related to Python dependencies"
        echo "Logs saved at: $BUILD_LOG"
        echo ""
        echo "Last error lines:"
        tail -20 "$BUILD_LOG"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Start services
echo ""
echo "Starting services..."
docker-compose up -d

# Wait for services to be ready
echo ""
echo "Waiting for services to be ready..."
sleep 5

# Check service status
echo ""
echo "Checking service status..."
docker-compose ps

# Check service health
echo ""
echo "Checking service health..."

# TimescaleDB
if docker-compose exec -T timescaledb pg_isready -U algo_trader > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TimescaleDB is ready${NC}"
else
    echo -e "${YELLOW}⚠️  TimescaleDB not ready yet (waiting...)${NC}"
    sleep 5
    if docker-compose exec -T timescaledb pg_isready -U algo_trader > /dev/null 2>&1; then
        echo -e "${GREEN}✅ TimescaleDB is ready${NC}"
    else
        echo -e "${RED}❌ TimescaleDB is not responding${NC}"
    fi
fi

# Redis
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is ready${NC}"
else
    echo -e "${YELLOW}⚠️  Redis not ready yet${NC}"
fi

# Trading Engine
if docker-compose ps trading_engine 2>/dev/null | grep -q "Up"; then
    echo -e "${GREEN}✅ Trading Engine is running${NC}"
    
    # Check if API is responding
    sleep 2
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API is responding at http://localhost:8000${NC}"
    else
        echo -e "${YELLOW}⚠️  API not responding yet (waiting for initialization...)${NC}"
    fi
else
    echo -e "${RED}❌ Trading Engine is not running${NC}"
    echo ""
    echo "Checking container logs..."
    docker-compose logs trading_engine --tail 20 2>/dev/null || echo "Could not get logs"
fi

# Data Ingestion
if docker-compose ps data_ingestion | grep -q "Up"; then
    echo -e "${GREEN}✅ Data Ingestion is running${NC}"
else
    echo -e "${YELLOW}⚠️  Data Ingestion is not running (may be normal if no API keys)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✅ System started successfully!${NC}"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  View logs:              docker-compose logs -f"
echo "  View engine logs:       docker-compose logs -f trading_engine"
echo "  Stop system:            docker-compose down"
echo "  Restart:                docker-compose restart"
echo ""
echo "Access:"
echo "  API/Dashboard:         http://localhost:8000"
echo "  Health Check:           http://localhost:8000/health"
echo "  Status:                 http://localhost:8000/api/status"
echo ""
echo "To start with Grafana (monitoring):"
echo "  ./start_with_monitoring.sh"
echo "  Grafana:                http://localhost:3000 (admin/admin)"
echo ""
echo "To check if data is arriving:"
echo "  docker-compose logs -f data_ingestion"
echo ""
echo "To access the database:"
echo "  docker-compose exec timescaledb psql -U algo_trader -d trading_db"
echo ""
