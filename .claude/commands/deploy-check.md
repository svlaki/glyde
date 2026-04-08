Run pre-deployment checks:

1. `cd apps/agents && npm run quality` -- backend quality gate
2. `cd apps/frontend && npm run quality` -- frontend quality gate
3. `cd apps/frontend && npm run build` -- verify production build succeeds
4. Check for any hardcoded localhost URLs in source files (grep for localhost:8000 and localhost:3000 outside of config)
5. Check for console.log statements in frontend code
6. Check for any TODO or FIXME comments that should be resolved
7. Report a go/no-go summary
