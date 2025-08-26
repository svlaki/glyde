# Task Completion Checklist

## Before Committing Code

### TypeScript Validation
```bash
# Frontend type checking
cd apps/frontend && npx tsc --noEmit

# Agents type checking  
cd apps/agents && npm run build
```

### Testing
```bash
# Run agent tests
cd apps/agents && npm run test

# Manual testing of key features
- Test calendar functionality
- Verify agent responses
- Check database connections
```

### Code Quality
- Ensure TypeScript interfaces are defined for all data structures
- Verify error handling is implemented with try-catch blocks
- Check that loading/error states are handled in React components
- Validate that Supabase RLS policies are properly configured

### Performance Checks
- Verify React.memo usage for expensive components
- Check for proper debouncing of search operations
- Ensure vector embedding caching is working
- Test streaming LLM responses

### Security Validation
- No API keys exposed in frontend code
- All user inputs are validated and sanitized
- LLM outputs are sanitized before rendering
- Rate limiting is implemented where needed

### Documentation
- Update memory files with new architectural decisions
- Document new patterns or significant changes
- Ensure CLAUDE.md is updated if workflows change

## Deployment Readiness
- Frontend builds without errors (`npm run build`)
- All tests pass (`npm run test`)
- Database migrations are applied
- Environment variables are properly configured