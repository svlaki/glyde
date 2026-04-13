# Glyde Frontend

## Quick Reference
- Pages: `src/pages/` - 12 pages (Calendar, Goals, Friends, Notes, Profile, etc.)
- Components: `src/components/` - 45+ components, `src/components/ui/` for Shadcn
- Services: `src/lib/*Service.ts` - API client functions
- Contexts: `src/lib/*Context.tsx` - Auth, Aspect, Rule, Connection, Theme, Timezone
- Hooks: `src/hooks/` - Custom hooks (platform, keyboard, avatar, geolocation)

## Commands
- `npm run dev` - vite dev server (port 3000)
- `npm run build` - vite build
- `npm run type-check` - tsc --noEmit
- `npm run quality` - lint + type-check + test
- `npm run build:mobile` - vite build + cap sync
- `npm run dev:electron` - electron-vite dev
- `npm run build:mac` - electron-vite build + electron-builder

## Patterns
- Context hierarchy: Auth > DarkMode > Rule > Connection > Aspect
- API calls through `src/lib/apiUtils.ts` (sets auth headers, base URL)
- Reads: Supabase client directly (anon key + RLS). Writes: Agent API (port 8000)
- Shadcn components in `src/components/ui/` -- add via `npx shadcn add <name>`
- Mobile components in `src/components/mobile/` with `usePlatform()` hook
- TailwindCSS 4 with `tailwind.config.js`, dark mode via `themeContext.tsx`

## Testing
- Component tests with @testing-library/react
- E2E with Playwright
- Config: `vitest.config.ts`
