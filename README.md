# Glyde

Glyde is a personal intelligence workspace that combines a proactive calendar, task and goal planning tools, and an AI copilot that learns from every interaction. The app keeps each user's data isolated in Supabase while the LangGraph-based agent uses OpenAI and Zep memory to surface helpful suggestions.

## Features

- **Per-user workspace** with Supabase Auth and schema-isolated data storage.
- **Calendar board** powered by FullCalendar with Supabase realtime updates and task overlays.
- **Task, goal, and category management** pages that share a consistent design system and sync with the calendar.
- **AI assistant** driven by the Agents service (LangGraph + OpenAI + Zep) for planning help, summaries, and proactive nudges.
- **Rich UI foundations** built with React, Vite, Mantine, Tailwind, shadcn/ui primitives, and custom theming.

## Repository layout

```
glydeproper/
├── apps/
│   ├── frontend/   # Vite + React client
│   └── agents/     # LangGraph agent service with Supabase + Zep integrations
├── supabase/       # SQL migrations and Edge Function code
├── docs/           # Deep-dive documentation (schema, architecture, etc.)
├── tests/          # Automated test suites
└── docker-compose.yml
```

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) (optional but recommended for running both services together)
- A Supabase project with the migrations in `supabase/migrations` applied
- API keys for OpenAI and (optionally) Zep memory

## Environment variables

Copy `.env.example` to `.env` and provide the values from your Supabase and AI providers:

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://<project-ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon key used by the frontend |
| `SUPABASE_SERVICE_KEY` | Supabase service role key used by the agent service |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and agent actions |
| `ZEP_API_KEY` | *(Optional)* Zep Cloud API key for long-term memory |
| `ZEP_BASE_URL` | *(Optional)* Override for the Zep Cloud base URL |

> The project uses a remote Supabase instance. Supabase does not run locally via Docker—apply the SQL migrations to your hosted project before starting the app.

## Local development (without Docker)

1. Install dependencies in each workspace:
   ```bash
   cd apps/agents && npm install
   cd ../frontend && npm install
   ```
2. Start the LangGraph agent API (requires `.env` in the repository root or set `AGENT_ENV_PATH`):
   ```bash
   cd apps/agents
   npm run dev
   ```
3. In a separate terminal start the frontend:
   ```bash
   cd apps/frontend
   npm run dev
   ```
4. Visit the app at http://localhost:5173 (Vite dev server). The frontend proxies API calls to the agent service at http://localhost:8000.

### Quality gates

Run the aggregated checks for each workspace before opening a PR:

```bash
cd apps/agents && npm run quality
cd apps/frontend && npm run quality
```

## Docker workflow

The repository ships with a lightweight Docker Compose stack that runs the agent API and the frontend together.

1. Copy `.env.example` to `.env` and fill in your keys.
2. Build and launch both services:
   ```bash
   docker compose up --build
   ```
3. Access the app at http://localhost:3000. Docker maps the internal Vite dev server (5173) to port 3000 on your host.
4. Stop the stack with `docker compose down`.

Refer to [DOCKER.md](DOCKER.md) for a deeper explanation of the container workflow.

## Additional documentation

- [DOCKER.md](DOCKER.md) – container workflow and troubleshooting
- [docs/DATABASE.md](docs/DATABASE.md) – database schema, security, and per-user isolation details
- [PRODUCT_VISION.md](PRODUCT_VISION.md) – long-term product direction
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) – roadmap for upcoming work

## License

[MIT](LICENSE)
