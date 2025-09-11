# Glydeeee - Personal Intelligence Operating System

## Project Purpose
Building a Personal Intelligence Operating System that merges:
- Smart calendar with FullCalendar integration
- Task management system
- AI life-coach capabilities
- Continuous learning of user patterns, values, and goals
- Provides both tactical clarity ("What do I do next?") and strategic direction ("Why am I doing it?")

## Architecture Overview
- **Monorepo structure** with separate frontend and agents applications
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS 4.0
- **Backend**: Node.js + Express + LangChain/LangGraph agents
- **Database**: Supabase (PostgreSQL + Realtime + Auth + Vector Storage)
- **AI**: OpenAI GPT-4 + embeddings with pgvector
- **UI Components**: Radix UI + shadcn/ui
- **Calendar**: FullCalendar library for week-view

## Current Implementation Status
- ✅ Basic calendar functionality implemented
- ✅ Agent infrastructure with LangChain/LangGraph
- ✅ Supabase database with vector embeddings
- 🔄 Natural language calendar management (in progress)
- 🔄 Intelligent task prioritization (planned)
- 🔄 Pattern recognition and coaching (planned)