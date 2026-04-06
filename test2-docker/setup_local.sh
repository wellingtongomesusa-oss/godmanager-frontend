#!/bin/bash

# Script to set up local development environment (without Docker)

set -e

echo "=========================================="
echo "  Local Development Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    echo "Please install Python 3.11+:"
    echo "  macOS: brew install python@3.11"
    echo "  Linux: sudo apt-get install python3.11"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Python found: $PYTHON_VERSION${NC}"

# Check pip3
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ pip3 found${NC}"

# Create virtualenv if it doesn't exist
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
else
    echo -e "${GREEN}✅ Virtual environment already exists${NC}"
fi

# Activate virtualenv
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Update pip
echo ""
echo "Updating pip..."
pip3 install --upgrade pip

# Install dependencies
echo ""
echo "Installing dependencies..."
pip3 install -r requirements.txt

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "=========================================="
echo ""
echo "To use the virtual environment:"
echo "  source venv/bin/activate"
echo ""
echo "To run:"
echo "  python3 -m src.ingestion.main"
echo "  python3 -m src.main"
echo ""
echo "To deactivate:"
echo "  deactivate"
echo ""
