Create a new agent tool for: $ARGUMENTS

1. Identify the correct category in `apps/agents/src/tools/`
2. Follow the pattern of existing tools in that category (read one for reference)
3. Create the tool with Zod input schema, description, and implementation
4. Register it in `apps/agents/src/tools/ToolRegistry.ts`
5. Add it to the appropriate category map in `getToolsByCategory()` in the registry
6. Add a test in `apps/agents/src/__tests__/`
7. Run `cd apps/agents && npm run type-check` to verify
