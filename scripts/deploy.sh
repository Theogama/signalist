#!/bin/bash

# Deployment script for Signalist Auto-Trading Module
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
echo "Deploying to $ENVIRONMENT environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: docker-compose is not installed"
    exit 1
fi

# Load environment variables
if [ -f .env.$ENVIRONMENT ]; then
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
elif [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Warning: No .env file found"
fi

# Build and start services
echo "Building Docker images..."
docker-compose build

echo "Starting services..."
docker-compose up -d

# Wait for health check
echo "Waiting for services to be healthy..."
sleep 10

# Check health
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✓ Deployment successful! Services are healthy."
else
    echo "⚠ Warning: Health check failed. Check logs with: docker-compose logs"
fi

echo "Deployment complete!"
echo "View logs: docker-compose logs -f"
echo "Stop services: docker-compose down"



