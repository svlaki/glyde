# Glydeeee

A modern calendar and chat application with user-specific event management, authentication, and vector search.

## Project Overview

Glydeeee is a full-stack application that provides users with a personal calendar and chat system. Each user gets their own isolated schema in the database for storing events and chat messages, ensuring data privacy and separation. The application features:

- User authentication (Supabase Auth)
- Personal calendar with event management
- Modern, responsive UI with dark mode support
- Isolated data storage per user (per-user Postgres schemas)
- Chat UI with OpenAI-powered embeddings and vector search (pgvector)

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Shadcn UI, FullCalendar
- **Backend**: Supabase (Authentication, Database, Edge Functions)
- **Vector Search**: pgvector (via Supabase)
- **Embeddings**: OpenAI API (frontend)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Git](https://git-scm.com/)
- [Supabase account](https://supabase.com/) (for your own project)
- [OpenAI account](https://platform.openai.com/) (for embeddings)

## Quick Start (Recommended)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd glydeeee
   ```

2. **Set up environment variables for the frontend**

   Copy the template and fill in your values:

   ```bash
   cp apps/frontend/.env.template apps/frontend/.env
   ```

   Edit `apps/frontend/.env` and set:
   - `VITE_SUPABASE_URL` (from your Supabase project)
   - `VITE_SUPABASE_ANON_KEY` (from your Supabase project)
   - `VITE_OPENAI_API_KEY` (from your OpenAI account)

3. **Install frontend dependencies**

   ```bash
   cd apps/frontend
   npm install
   ```

4. **Start the frontend development server**

   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:5173


## Optional: Docker Compose

If you want to run a local Postgres or Supabase stack, you can use Docker Compose. This is not required for the default cloud workflow.

## Project Structure

```
glydeeee/
├── apps/
│   ├── frontend/       # React frontend application
│   └── agent/          # (Optional) Agent service
├── supabase/           # Supabase Edge Functions and config
├── migrations/         # Database migration scripts
└── README.md
```

## User Flow

1. **Authentication**
   - Users sign up or log in using Supabase Auth
2. **Calendar & Chat**
   - Calendar and chat messages are stored in per-user schemas
   - Chat messages are embedded using OpenAI and stored with vector data
3. **Vector Search (future)**
   - Semantic search and agent features can be built on top of the vector data

## Troubleshooting

- **Edge Function 500 errors**: Check Supabase Edge Function logs for details
- **Embedding is null**: Ensure your OpenAI API key is set in `apps/frontend/.env` and is valid
- **Database errors**: Make sure all migrations are applied and per-user schemas/tables exist
- **Auth issues**: Double-check your Supabase project URL and anon key

## License

[MIT](LICENSE) 
