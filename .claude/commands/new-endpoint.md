Create a new API endpoint for: $ARGUMENTS

1. Identify the domain file in `apps/agents/src/api/` (or create new one)
2. Follow the pattern: POST route, authenticateRequest middleware, try/catch, JSON response
3. Use the relevant Service class from `apps/agents/src/services/`
4. Validate input with Zod
5. Wire it up in `apps/agents/src/api/server.ts`
6. Add corresponding frontend service function in `apps/frontend/src/lib/<domain>Service.ts`
7. Run type-check on both apps
