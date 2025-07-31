#!/bin/bash

echo "🚀 Starting Glydeeee - Personal Intelligence Operating System"
echo ""
echo "Architecture Overview:"
echo "  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐"
echo "  │  Frontend       │───▶│  Chat Server    │───▶│  Agent Service  │"
echo "  │  React + Vite   │    │  Vercel AI SDK  │    │  LangGraph      │"
echo "  │  Port 5173      │    │  Port 3001      │    │  Port 8000      │"
echo "  └─────────────────┘    └─────────────────┘    └─────────────────┘"
echo ""

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $AGENT_PID $CHAT_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Start agent service (LangGraph intelligence layer)
echo "🤖 Starting Agent Service (LangGraph + Vector Search)..."
cd apps/agents
npm run dev &
AGENT_PID=$!

# Wait for agent service to initialize
sleep 4

# Start chat server (Vercel AI SDK streaming layer)
echo "💬 Starting Chat Server (Vercel AI SDK Streaming)..."
cd ../frontend
npm run dev:chat &
CHAT_PID=$!

# Wait for chat server to start
sleep 2

# Start frontend (React interface)
echo "🌐 Starting Frontend (React + Vite)..."
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 2

echo ""
echo "✅ All services running!"
echo ""
echo "🌍 Frontend:      http://localhost:5173"
echo "💬 Chat API:      http://localhost:3001"
echo "🤖 Agent Service: http://localhost:8000"
echo ""
echo "💡 Features Available:"
echo "   • Real-time streaming chat"
echo "   • Smart agent routing"
echo "   • Vector-powered semantic search"
echo "   • Calendar management"
echo "   • Natural language processing"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for background processes
wait