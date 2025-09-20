#!/bin/bash

# ==============================================
# ADS FINDER PRO - DEPLOY SCRIPT
# ==============================================

echo "🚀 Starting Ads Finder Pro deployment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy env.example to .env and configure your API keys:"
    echo "   cp env.example .env"
    echo "   nano .env"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    echo "🐳 Please start Docker and try again."
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Remove old images (optional - uncomment if you want to force rebuild)
# echo "🗑️  Removing old images..."
# docker-compose down --rmi all

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
echo "🏥 Checking service health..."
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Ads Finder Pro is running successfully!"
    echo ""
    echo "🌐 Application URL: http://localhost:3000"
    echo "📊 MongoDB: localhost:27017"
    echo ""
    echo "📝 Logs: docker-compose logs -f ads-finder"
    echo "🛑 Stop: docker-compose down"
else
    echo "❌ Health check failed. Checking logs..."
    docker-compose logs ads-finder
fi

echo "🎉 Deploy completed!"
