# Supabase MCP Server Integration

## Overview
The Supabase MCP (Model Context Protocol) server is configured and enables Claude Code to directly interact with our Supabase project, including database queries, migrations, and project management.

## Configuration
**Location**: `.mcp.json` (lines 3-14)

```json
{
  "supabase": {
    "type": "stdio",
    "command": "npx",
    "args": [
      "-y",
      "@supabase/mcp-server-supabase@latest",
      "--project-ref=furwuyjptohobrvyyzfy"
    ],
    "env": {
      "SUPABASE_ACCESS_TOKEN": "sbp_9a38a2935f739393e072a590546ab18db373ee13"
    }
  }
}
```

## Key Details
- **Project Reference**: `furwuyjptohobrvyyzfy`
- **Transport Type**: `stdio` (local process via npx)
- **Package**: `@supabase/mcp-server-supabase@latest` (always uses latest version)
- **Authentication**: Personal access token stored in environment variable

## Capabilities
The Supabase MCP server enables:
1. **Database Queries**: Direct SQL execution and query results
2. **Schema Inspection**: View tables, columns, relationships
3. **Migration Management**: Read and analyze database migrations
4. **Project Information**: Access project settings and configuration
5. **Real-time Subscriptions**: Manage Supabase Realtime channels
6. **Edge Functions**: Deploy and manage Supabase Edge Functions

## Usage in Development
- **Database Schema Changes**: Query current schema before creating migrations
- **Data Analysis**: Run analytical queries to understand user patterns
- **Migration Validation**: Verify migration syntax before applying
- **Debugging**: Query database state during development
- **Integration Testing**: Set up and tear down test data

## Security Considerations
⚠️ **Important**: As per Supabase documentation, the MCP server should only be used for development and testing purposes, never with production data.

Best practices:
- Use development/staging project references only
- Enable read-only mode when possible
- Scope to specific projects
- Review all queries before execution
- Never commit sensitive tokens (token is already in .mcp.json, should consider moving to environment variable)

## Related MCP Servers
Our full MCP stack includes:
- **supabase**: Database and backend operations (this server)
- **serena**: Semantic code analysis and editing
- **context7**: Live library documentation
- **code-index**: Fast codebase search and indexing
- **postgresql**: Direct PostgreSQL access (local: `localhost:54322`)
- **github**: GitHub repository operations
- **docker**: Container management
- **playwright**: Browser automation and testing
- **zep-docs**: Zep memory documentation
- **sequential-thinking**: Enhanced reasoning
- **memory-bank**: Persistent memory storage

## Integration with Project Architecture
The Supabase MCP server complements our existing architecture:
- Works alongside existing Supabase client library (`@supabase/supabase-js`)
- Enables direct database inspection during agent development
- Facilitates schema-aware tool development
- Supports migration creation and validation workflow

## Next Steps
Consider:
1. Moving access token to environment variable instead of `.mcp.json`
2. Creating separate development project for MCP usage
3. Documenting common MCP queries for team reference
4. Integrating MCP capabilities into agent development workflow