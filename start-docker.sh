#!/bin/bash

echo "🚀 Starting Glydeeee Docker Stack..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure your environment variables."
    echo "   cp .env.example .env"
    echo "   Then edit .env with your actual values."
    exit 1
fi

echo "✅ Found .env file"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Desktop."
    exit 1
fi

# Determine docker compose command
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

echo "🔨 Building and starting services..."

# Build and start all services
$COMPOSE_CMD up --build -d

echo ""
echo "🎉 Services starting up! This may take a few minutes..."
echo ""
echo "📊 Service Status:"
echo "   Frontend:           http://localhost:3000"
echo "   Agents API:         http://localhost:8000/health"
echo ""
echo "☁️  External Services:"
echo "   Supabase:           (configured via SUPABASE_URL)"
echo "   Zep Memory:         (configured via ZEP_API_KEY)"
echo "   OpenAI:             (configured via OPENAI_API_KEY)"
echo ""
echo "📝 To check service health:"
echo "   $COMPOSE_CMD ps"
echo "   $COMPOSE_CMD logs [service-name]"
echo ""
echo "🔧 To stop services:"
echo "   $COMPOSE_CMD down"
echo ""
echo "⏱️  Services are starting... Please wait 1-2 minutes for full initialization"

# Wait a moment and show status
sleep 5
$COMPOSE_CMD ps