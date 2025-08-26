# Development Commands Reference

## Frontend Development (apps/frontend/)
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Agents Development (apps/agents/)
```bash
# Start development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm run start

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch
```

## Database (Supabase)
```bash
# Start local Supabase
npx supabase start

# Apply migrations
npx supabase migration up

# Generate types
npx supabase gen types typescript --local > src/types/database.ts
```

## Common System Commands (macOS)
```bash
# Navigation
ls -la          # List files with details
find . -name    # Find files by name
grep -r         # Search text in files

# Git workflow
git status
git add .
git commit -m "message"
git push origin main

# Process management
ps aux | grep   # Find running processes
lsof -i :3000   # Check port usage
```

## Docker Development
```bash
# Start full stack
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```