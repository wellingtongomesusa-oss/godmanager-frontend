#!/bin/bash

# Script to start with monitoring (Grafana + Prometheus)

cd "$(dirname "$0")"

# Start with monitoring profile
docker-compose --profile monitoring up -d

echo "System started with monitoring:"
echo "  - API: http://localhost:8000"
echo "  - Grafana: http://localhost:3000 (admin/admin)"
echo "  - Prometheus: http://localhost:9090"
