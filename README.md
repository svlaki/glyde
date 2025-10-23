# Glydeeee - Personal Intelligence Operating System

A next-generation calendar and life-coach application that merges smart scheduling, task management, and AI-powered assistance. Continuously learns from your patterns, values, and goals to provide both tactical clarity ("What do I do next?") and strategic direction ("Why am I doing it?").

## Project Overview

Glydeeee is a full-stack Personal Intelligence Operating System featuring:

- **Smart Calendar**: FullCalendar-powered week view with natural language event creation
- **AI Life Coach**: LangGraph-powered agents for goal setting, task prioritization, and pattern recognition
- **Intelligent Memory**: Zep-powered temporal memory system that learns from your behavior
- **Real-time Sync**: Supabase Realtime for instant updates across all your devices
- **Privacy-First**: User-isolated database schemas and encrypted data storage

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Frontend       │───▶│  Agents Service │───▶│  Zep Cloud      │
│  React + Vite   │    │  LangGraph      │    │  Memory System  │
│  Port 3000      │    │  Port 8000      │    │  (External)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │
         │                      │
         └──────────────────────┴────────────────────────────────▶
                                │
                        ┌───────▼──────────┐
                        │    Supabase      │
                        │  PostgreSQL +    │
                        │  Auth + Realtime │
                        │   (External)     │
                        └──────────────────┘
```

### Tech Stack

- **Frontend**: React 19, Vite, TypeScript, TailwindCSS 4.0, Radix UI
- **Backend**: Node.js, Express, LangChain/LangGraph
- **Database**: Supabase (PostgreSQL + Realtime + Auth + Vector Storage)
- **Memory**: Zep Cloud (Temporal knowledge graphs and conversation memory)
- **AI**: OpenAI GPT-4 + Ada embeddings
- **Calendar**: FullCalendar library
- **Deployment**: Docker + Docker Compose

## Prerequisites

Before you begin, ensure you have:

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** - For containerized development
- **[Git](https://git-scm.com/)** - For version control
- **[Supabase Account](https://supabase.com/)** - For database and auth (free tier available)
- **[OpenAI API Key](https://platform.openai.com/)** - For AI features
- **[Zep Cloud Account](https://www.getzep.com/)** - For memory system (free tier available)

## Quick Start with Docker Desktop

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/glydeeee.git
cd glydeeee
```

### 2. Set Up Environment Variables

Create your `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:

```env
# Supabase Configuration (from your Supabase project settings)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Zep Configuration (from https://app.getzep.com)
ZEP_API_KEY=your-zep-api-key-here
ZEP_BASE_URL=https://api.getzep.com
```

**Where to find these values:**

- **Supabase**: Go to your project → Settings → API
  - `SUPABASE_URL`: Project URL
  - `SUPABASE_ANON_KEY`: `anon` `public` key
  - `SUPABASE_SERVICE_KEY`: `service_role` `secret` key
- **OpenAI**: https://platform.openai.com/api-keys
- **Zep**: https://app.getzep.com → Settings → API Keys

### 3. Start the Application

Using the provided script (recommended):

```bash
chmod +x start-docker.sh
./start-docker.sh
```

Or manually with Docker Compose:

```bash
docker compose up --build
```

### 4. Access the Application

Once the services are running:

- **Frontend**: http://localhost:3000
- **Agents API**: http://localhost:8000/health

**Note**: The first startup may take 2-3 minutes as Docker builds the images.

### 5. Create an Account

1. Open http://localhost:3000 in your browser
2. Click "Sign Up" and create an account
3. Your personal database schema will be automatically created
4. Start adding calendar events and chatting with your AI coach!

## Project Structure

```
glydeeee/
├── apps/
│   ├── frontend/              # React frontend application
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   │   ├── Calendar/  # Calendar views
│   │   │   │   ├── Chat/      # Chat interface
│   │   │   │   └── Dashboard/ # Dashboard widgets
│   │   │   ├── lib/           # Utilities and services
│   │   │   ├── hooks/         # React hooks
│   │   │   └── types/         # TypeScript types
│   │   ├── Dockerfile.dev     # Development container
│   │   └── package.json
│   │
│   └── agents/                # AI agents service
│       ├── src/
│       │   ├── agents/        # LangGraph agents
│       │   ├── services/      # Zep, Supabase services
│       │   └── tools/         # Agent tools
│       ├── Dockerfile
│       └── package.json
│
├── supabase/                  # Supabase configuration
│   ├── migrations/            # Database migrations
│   └── functions/             # Edge functions
│
├── docker-compose.yml         # Docker services configuration
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## Development Without Docker

If you prefer to run services locally without Docker:

### Prerequisites

- Node.js 18+ and npm
- All environment variables configured in `.env`

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Frontend will be available at http://localhost:5173

### Agents Service

```bash
cd apps/agents
npm install
npm run build
npm start
```

Agents API will be available at http://localhost:8000

## Docker Commands

### View Service Status

```bash
docker compose ps
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
docker compose logs -f agent
```

### Restart Services

```bash
docker compose restart
```

### Stop Services

```bash
docker compose down
```

### Rebuild After Code Changes

```bash
docker compose up --build
```

### Clean Slate (Remove Volumes)

```bash
docker compose down -v
docker compose up --build
```

## Environment Variables Reference

| Variable | Purpose | Required | Where to Find |
|----------|---------|----------|---------------|
| `SUPABASE_URL` | Supabase project URL | Yes | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Public anonymous key | Yes | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Service role key (backend only) | Yes | Supabase Dashboard → Settings → API |
| `OPENAI_API_KEY` | OpenAI API key for LLM and embeddings | Yes | https://platform.openai.com/api-keys |
| `ZEP_API_KEY` | Zep Cloud API key | Yes | https://app.getzep.com → Settings → API Keys |
| `ZEP_BASE_URL` | Zep API base URL | Yes | Usually `https://api.getzep.com` |

## Troubleshooting

### Docker Desktop Not Running

**Error**: `Cannot connect to the Docker daemon`

**Fix**:
1. Open Docker Desktop
2. Wait for it to fully start (green icon in menu bar)
3. Run `docker compose up --build` again

### Port Already in Use

**Error**: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Fix**:
```bash
# Find what's using the port
lsof -i :3000
lsof -i :8000

# Kill the process or change ports in docker-compose.yml
```

### Environment Variables Not Loading

**Symptoms**: 500 errors, "undefined" values, authentication failures

**Fix**:
1. Ensure `.env` file exists in the root directory
2. Verify all required variables are set (no `your-key-here` placeholders)
3. Restart Docker containers: `docker compose down && docker compose up --build`

### Supabase Connection Errors

**Error**: `Invalid API key` or `Failed to fetch`

**Fix**:
1. Double-check your Supabase URL and keys in `.env`
2. Ensure you're using the correct keys (anon key for frontend, service key for backend)
3. Verify your Supabase project is active (not paused)

### Zep Memory Errors

**Error**: `Failed to connect to Zep` or `Unauthorized`

**Fix**:
1. Verify your Zep API key is correct in `.env`
2. Check you have an active Zep account at https://app.getzep.com
3. Ensure `ZEP_BASE_URL` is set correctly (usually `https://api.getzep.com`)

### Frontend Shows Blank Page

**Fix**:
1. Check browser console for errors (F12)
2. Verify agents service is running: http://localhost:8000/health
3. Check Docker logs: `docker compose logs frontend`
4. Try rebuilding: `docker compose up --build`

### Database Migration Issues

**Fix**:
```bash
# Run migrations manually
cd supabase
npx supabase migration up
```

## Features

### Current Features ✅

- User authentication and authorization
- Personal calendar with week view
- Create, update, delete calendar events
- Natural language chat interface
- AI-powered conversation memory
- Real-time updates across devices
- Dark mode support
- Responsive mobile-friendly design

### In Development 🔄

- Natural language event creation ("Schedule meeting with John tomorrow at 2pm")
- Intelligent task prioritization (Eisenhower Matrix)
- Pattern recognition (productivity hours, meeting overload detection)
- Goal tracking and SMART goal decomposition
- Proactive suggestions and reminders

### Planned Features 📋

- Google Calendar sync
- Email integration
- Voice interface
- Mobile app (React Native)
- Habit tracking
- Team collaboration features

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)

## Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review Docker logs: `docker compose logs`

---

Built with ❤️ using React, LangGraph, Supabase, and Zep
