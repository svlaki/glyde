# Glyde Agents Backend

## Quick Reference
- Entry: `src/api/server.ts` - Express server, 60+ POST endpoints
- Agents: `src/agents/` - Conversation, Gerald (interactions), Margaret (maintenance)
- Tools: `src/tools/` - 55+ tools across 16 categories, registered via `ToolRegistry.ts`
- Services: `src/services/` - Domain services (Supabase, Zep, Google, Push, etc.)
- Config: `src/config/agents.ts` - Agent configuration

## Commands
- `npm run dev` - tsx watch src/api/server.ts
- `npm run build` - tsc
- `npm run type-check` - tsc --noEmit
- `npm run quality` - lint + type-check + test
- `npm run test` - vitest

## Patterns
- All endpoints are POST, organized in `src/api/<domain>.ts`
- Auth via `authenticateRequest` middleware (validates Supabase JWT)
- New tools: create in `src/tools/<category>/`, register in `ToolRegistry.ts`
- New endpoints: add to `src/api/<domain>.ts`, wire in `server.ts`
- Services use `SupabaseService` for DB -- never raw SQL in endpoints
- Agent prompts in `src/agents/<name>/prompts.ts` with `buildXxxSystemPrompt(context)`

## Testing
- Vitest + supertest for API integration tests
- Config: `vitest.config.ts`
