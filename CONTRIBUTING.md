# Contributing to Glydeeee

Welcome! This guide will help you get started with development.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git
- Your favorite code editor

### Environment Setup

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd glydeproper
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys (see README.md for details)
```

3. **Start the application**
```bash
docker compose up --build
```

4. **Access the app**
- Frontend: http://localhost:3000
- Agents API: http://localhost:8000/health

## 📁 Project Structure

```
glydeproper/
├── apps/
│   ├── frontend/              # React TypeScript app
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── pages/         # Page components
│   │   │   ├── lib/           # Utilities
│   │   │   └── types/         # TypeScript types
│   │   ├── Dockerfile.dev     # Dev container config
│   │   └── package.json
│   │
│   └── agents/                # LangGraph agents service
│       ├── src/
│       │   ├── agents/        # Agent implementations
│       │   ├── tools/         # Agent tools
│       │   ├── services/      # Supabase, Zep, etc.
│       │   └── api/           # Express routes
│       ├── Dockerfile
│       └── package.json
│
├── supabase/
│   └── migrations/            # Database migrations
│
├── docs/                      # Additional documentation
├── docker-compose.yml         # Container orchestration
└── [Essential .md files]      # README, CLAUDE, STATUS, etc.
```

## 🛠️ Development Workflow

### Making Changes

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
- Frontend changes auto-reload in Docker
- Backend changes require rebuild: `docker compose up --build agent`

3. **Test your changes**
```bash
# Frontend
cd apps/frontend
npm run type-check
npm run lint

# Backend
cd apps/agents
npm run build
npm run type-check
```

4. **Commit your changes**
```bash
git add .
git commit -m "feat: add your feature description"
```

### Commit Message Format

Follow conventional commits:
```
feat: new feature
fix: bug fix
docs: documentation changes
style: formatting, missing semicolons, etc.
refactor: code restructuring
test: adding tests
chore: maintenance tasks
```

Examples:
```
feat: add energy-based task scheduling
fix: resolve calendar drag-drop bug
docs: update ROADMAP.md with Q1 goals
refactor: simplify SupabaseService methods
```

## 📝 Code Style Guidelines

### TypeScript
- **Strict mode enabled**: No `any` types
- **Use interfaces** for data structures
- **Descriptive names**: `getUserEvents()` not `getData()`
- **Error handling**: Always use try-catch for async operations

### React
- **Functional components** with hooks
- **TypeScript interfaces** for all props
- **Meaningful component names**: `EventModal` not `Modal1`
- **Extract reusable logic** into custom hooks

### File Naming
- Components: `PascalCase.tsx` (e.g., `TaskList.tsx`)
- Utilities: `camelCase.ts` (e.g., `dateHelpers.ts`)
- Types: `PascalCase.ts` or `types.ts`

### Example Component
```typescript
interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
}

export function TaskCard({ task, onComplete, onEdit }: TaskCardProps) {
  const handleComplete = () => {
    onComplete(task.id);
  };

  return (
    <div className="task-card">
      <h3>{task.title}</h3>
      <button onClick={handleComplete}>Complete</button>
      <button onClick={() => onEdit(task)}>Edit</button>
    </div>
  );
}
```

## 🧪 Testing

### Frontend Testing
```bash
cd apps/frontend
npm run test          # Run tests
npm run test:watch    # Watch mode
```

### Backend Testing
```bash
cd apps/agents
npm run test
```

### Manual Testing Checklist
Before submitting a PR:
- [ ] All pages load without errors
- [ ] CRUD operations work (create, read, update, delete)
- [ ] Real-time updates function correctly
- [ ] Chat interface responds
- [ ] No console errors
- [ ] Mobile view looks reasonable

## 🐛 Debugging

### View Docker Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
docker compose logs -f agent
```

### Common Issues

**Port conflicts**:
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

**Rebuild from scratch**:
```bash
docker compose down -v
docker compose up --build
```

**TypeScript errors**:
```bash
# Agents
cd apps/agents && npm run build

# Frontend
cd apps/frontend && npm run type-check
```

## 🔄 Database Migrations

### Create a Migration
```bash
cd supabase
npx supabase migration new your_migration_name
```

### Apply Migrations
Migrations run automatically when Docker starts. To run manually:
```bash
npx supabase migration up
```

### Migration Guidelines
- One logical change per migration
- Use reversible operations when possible
- Test migrations on a copy of production data
- Document breaking changes

## 📚 Additional Resources

### Documentation
- **STATUS.md** - Current project state
- **ROADMAP.md** - Future plans
- **CLAUDE.md** - Claude Code instructions
- **PRODUCT_VISION.md** - Architecture vision
- **UI_IMPROVEMENT_PLAN.md** - Design guidelines

### External Docs
- [React 19 Docs](https://react.dev)
- [LangChain JS](https://js.langchain.com)
- [Supabase Docs](https://supabase.com/docs)
- [Zep Cloud](https://docs.getzep.com)
- [OpenAI API](https://platform.openai.com/docs)

## 🤝 Pull Request Process

1. **Ensure your code**:
   - Follows style guidelines
   - Passes type checking
   - Has no console errors
   - Works in Docker

2. **Update documentation**:
   - Update STATUS.md if adding features
   - Update ROADMAP.md if completing tasks
   - Add comments for complex logic

3. **Create a PR**:
   - Clear title describing the change
   - Description explaining why and what
   - Reference any related issues

4. **PR Review**:
   - Address feedback promptly
   - Keep discussions focused
   - Be open to suggestions

## 💬 Getting Help

- **Check existing docs** first (README, STATUS, ROADMAP)
- **Search closed issues** for similar problems
- **Ask in discussions** for architecture questions
- **Open an issue** for bugs or feature requests

## 🎯 Contribution Ideas

Good first contributions:
- Fix typos in documentation
- Improve error messages
- Add loading states
- Enhance mobile responsiveness
- Write tests for existing features
- Improve type safety

Larger contributions:
- Implement items from ROADMAP.md
- Add new agent tools
- Create new UI components
- Optimize performance
- Add integrations

---

**Thank you for contributing to Glydeeee!** 🎉
