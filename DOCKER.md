# Docker Deployment Guide

This guide describes how to run the Glyde stack locally with Docker Compose. The compose file starts two services:

```
┌──────────────────────────┐    ┌──────────────────────────┐
│ Frontend (Vite + React) │──▶ │ Agents API (LangGraph)   │
│ Port 3000 → 5173        │    │ Port 8000                │
└──────────────────────────┘    └──────────────────────────┘
```

There are no local databases in the Docker stack—connect to your hosted Supabase project instead.

## Prerequisites

- Docker Engine 24+ and Docker Compose plugin
- A `.env` file in the repository root with the required Supabase and AI credentials
- Access to a Supabase project with the migrations in `supabase/migrations` applied

## Environment variables

Copy `.env.example` to `.env` and set the following keys before starting Docker:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by both services |
| `SUPABASE_ANON_KEY` | Public key for the frontend client |
| `SUPABASE_SERVICE_KEY` | Service role key for the agent service |
| `OPENAI_API_KEY` | OpenAI key for embeddings and agent reasoning |
| `ZEP_API_KEY` *(optional)* | Enables persistent memory in the agent |
| `ZEP_BASE_URL` *(optional)* | Override the Zep API base URL |

Store secrets in your `.env`; they are injected into the containers at runtime via `docker-compose.yml`.

## Starting the stack

1. Build and start the services:
   ```bash
   docker compose up --build
   ```
2. Visit the frontend at http://localhost:3000. Docker maps this port to the Vite dev server running inside the container.
3. The agent service is available at http://localhost:8000 (for example `http://localhost:8000/health`).
4. Stop everything with:
   ```bash
   docker compose down
   ```

### Using the helper script

`start-docker.sh` wraps `docker compose up --build -d` and performs a few sanity checks (verifying `.env` exists, confirming Docker Compose is installed). Feel free to run it instead of the manual commands.

## Development tips

- The frontend container mounts your local `apps/frontend` source tree so Vite picks up file changes instantly.
- The agents container runs in production mode by default. For debugging you can rebuild with `NODE_ENV=development` or run the service locally outside Docker (`npm run dev` in `apps/agents`).
- Logs from each service can be tailed with `docker compose logs -f <service-name>` (use `frontend` or `agent`).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Containers exit immediately | Ensure `.env` contains all required Supabase and OpenAI keys. Missing keys cause the agent service to fail validation. |
| Frontend starts but API calls fail | Confirm the agent container is running and reachable at `http://localhost:8000`. Use `docker compose logs agent` for details. |
| Changes do not hot reload in Docker | Check that the `apps/frontend` directory is mounted (see `docker-compose.yml`). On Linux you may need to set `CHOKIDAR_USEPOLLING=1` inside the container. |
| `docker compose up` reports port conflicts | Stop other processes using ports 3000 or 8000, or edit the port mappings in `docker-compose.yml`. |

If you continue to see issues, compare your environment variables with the table above and verify that your Supabase instance has the latest migrations applied.
