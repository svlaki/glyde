# Docker Deployment Guide

This guide explains how to run Glydeeee using Docker for easy deployment and consistent environments.

## Architecture

The Docker setup includes these services:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend       │───▶│  Agents Service │───▶│ Graphiti Memory│───▶│    Neo4j        │
│  React + Vite   │    │  LangGraph      │    │ Python FastAPI │    │ Graph Database  │
│  Port 3000      │    │  Port 8000      │    │  Port 8001      │    │  Port 7474/7687 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Setup Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

Required environment variables:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# OpenAI Configuration  
OPENAI_API_KEY=sk-your-openai-api-key
```

### 2. Start the Stack

```bash
# Make the script executable
chmod +x start-docker.sh

# Start all services
./start-docker.sh
```

Or manually:
```bash
docker-compose up --build -d
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Agents API**: http://localhost:8000/health
- **Graphiti Memory**: http://localhost:8001/health
- **Neo4j Browser**: http://localhost:7474 (neo4j/graphiti_password)

## Services

### Neo4j Graph Database
- **Image**: neo4j:5.15-community
- **Ports**: 7474 (HTTP), 7687 (Bolt)
- **Credentials**: neo4j/graphiti_password
- **Purpose**: Stores the knowledge graph for temporal memory

### Graphiti Memory Service
- **Build**: `services/graphiti/`
- **Port**: 8001
- **Purpose**: FastAPI service providing REST API for Graphiti operations
- **Dependencies**: Neo4j database

### Agents Service  
- **Build**: `apps/agents/`
- **Port**: 8000
- **Purpose**: Node.js service running LangGraph agents
- **Dependencies**: Graphiti service

### Frontend
- **Build**: `apps/frontend/`
- **Port**: 3000
- **Purpose**: React/Vite frontend application
- **Dependencies**: Agents service

## Health Checks

All services include health checks that ensure proper startup order:

```bash
# Check service status
docker-compose ps

# View logs for specific service
docker-compose logs neo4j
docker-compose logs graphiti-service
docker-compose logs agent
docker-compose logs frontend
```

## Development vs Production

### Development Mode
```bash
# Run individual services for development
./dev-start.sh
```

This requires:
- Neo4j running locally (bolt://localhost:7687)
- Python environment with Graphiti dependencies
- Node.js for agents and frontend

### Production Mode (Docker)
```bash
# Run complete stack in containers
./start-docker.sh
```

This provides:
- Complete isolation
- Consistent environments
- Easy deployment
- Automatic service orchestration

## Troubleshooting

### Service Won't Start
1. Check Docker daemon is running
2. Verify .env file exists and has correct values
3. Check port conflicts (3000, 7474, 7687, 8000, 8001)

```bash
# Check what's using ports
lsof -i :3000
lsof -i :8000
lsof -i :8001
lsof -i :7474
lsof -i :7687
```

### Memory Issues
Neo4j requires adequate memory. Adjust in docker-compose.yml:

```yaml
neo4j:
  environment:
    - NEO4J_dbms_memory_heap_max__size=4g  # Increase if needed
```

### Neo4j Connection Issues
1. Wait for Neo4j to fully initialize (can take 60+ seconds)
2. Check Neo4j browser: http://localhost:7474
3. Verify credentials: neo4j/graphiti_password

### Graphiti Service Issues
1. Check Neo4j is healthy first
2. View Graphiti logs: `docker-compose logs graphiti-service`
3. Test health endpoint: http://localhost:8001/health

### Agent Service Issues
1. Verify Supabase credentials in .env
2. Check OpenAI API key is valid
3. Ensure Graphiti service is healthy

## Data Persistence

### Neo4j Data
Data is persisted in Docker volumes:
- `neo4j_data`: Database files
- `neo4j_logs`: Log files
- `neo4j_plugins`: Plugin files

To backup:
```bash
# Create backup
docker-compose exec neo4j neo4j-admin database dump neo4j

# Restore from backup
docker-compose exec neo4j neo4j-admin database load neo4j
```

### Cleanup
```bash
# Stop services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Scaling

For production deployment:

1. **External Neo4j**: Use Neo4j AuraDB cloud service
2. **Load Balancing**: Add nginx reverse proxy
3. **Multiple Agents**: Scale agents service horizontally
4. **Monitoring**: Add health check endpoints and monitoring

Example production docker-compose additions:
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
  depends_on:
    - agent
```

## Environment Variables Reference

| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `OPENAI_API_KEY` | OpenAI API key for LLM | Yes |
| `NEO4J_URI` | Neo4j connection URI | No (set by docker) |
| `NEO4J_USER` | Neo4j username | No (set by docker) |
| `NEO4J_PASSWORD` | Neo4j password | No (set by docker) |
| `GRAPHITI_SERVICE_URL` | Graphiti service URL | No (set by docker) |