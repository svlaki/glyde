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

## Quick Start with Docker (Recommended)

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd glydeeee
   ```

2. **Set up environment variables**

   Copy the `.env.example` file to `.env` and add your keys:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:
   - `OPENAI_API_KEY` (from your OpenAI account)
   - `SUPABASE_URL` (your Supabase project URL, e.g. `https://<project-ref>.supabase.co`)
   - `SUPABASE_ANON_KEY` (from your Supabase project settings)
   - `SUPABASE_SERVICE_KEY` (for agent, from Supabase project settings)

   > **Note:** This project expects you to use a **remote Supabase project**. You do not need to run Supabase locally. Make sure your Supabase project is set up and the required Edge Functions are deployed.

3. **Start the application stack**

   ```bash
   docker-compose up --build
   ```

   The frontend will be available at http://localhost:3000.

## Development without Docker

You can run the frontend and agent locally using Node.js. Make sure your `.env` is set up as above.

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
- **Embedding is null**: Ensure your OpenAI API key is set in `.env` and is valid
- **Database errors**: Make sure all migrations are applied and per-user schemas/tables exist in your remote Supabase project
- **Auth issues**: Double-check your Supabase project URL and anon key

## License

[MIT](LICENSE) 
