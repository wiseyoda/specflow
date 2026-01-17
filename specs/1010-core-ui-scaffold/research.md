# Research: Core UI Scaffold

**Phase**: 1010
**Date**: 2026-01-17

---

## Technology Research

### Next.js 14+ App Router Setup

**Source**: Context7 - /vercel/next.js

**Quick Start with pnpm**:
```bash
pnpm create next-app@latest my-app --yes
cd my-app
pnpm dev
```

The `--yes` flag enables TypeScript, Tailwind CSS, ESLint, App Router, and Turbopack by default.

**Key Decisions**:
- Use App Router (not Pages Router)
- Use Turbopack for faster dev builds
- TypeScript strict mode enabled

---

### Tailwind CSS v3 Configuration

**Source**: Context7 - Next.js docs

**Install**:
```bash
pnpm add -D tailwindcss@^3 postcss autoprefixer
npx tailwindcss init -p
```

**Config** (`tailwind.config.js`):
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

---

### shadcn/ui Setup

**Source**: Context7 - /websites/ui_shadcn

**Installation**:
```bash
npx shadcn@latest init
```

**Add Components**:
```bash
npx shadcn@latest add command  # For command palette
npx shadcn@latest add button
npx shadcn@latest add dropdown-menu
npx shadcn@latest add card
```

---

### Dark Mode with next-themes

**Source**: Context7 - shadcn/ui docs

**ThemeProvider** (wrap root layout):
```typescript
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**ModeToggle Component**:
```tsx
"use client"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

### Zod Schema Patterns

**Source**: Context7 - /colinhacks/zod

**Define with Optional Fields**:
```typescript
import * as z from "zod";

const ProjectSchema = z.object({
  path: z.string(),
  name: z.string(),
  registered_at: z.string(),
  last_seen: z.string().optional(),
});

type Project = z.infer<typeof ProjectSchema>;
// { path: string; name: string; registered_at: string; last_seen?: string }
```

**Registry Schema**:
```typescript
const RegistrySchema = z.object({
  projects: z.record(z.string(), ProjectSchema),
});
```

---

### pnpm Workspace Setup

**File**: `pnpm-workspace.yaml` (root)
```yaml
packages:
  - 'packages/*'
```

**Root package.json**:
```json
{
  "name": "speckit-dashboard",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter dashboard dev",
    "build": "pnpm --filter dashboard build",
    "start": "pnpm --filter dashboard start"
  }
}
```

---

## Polling Implementation

For 5-second auto-refresh without file watchers:

```typescript
// hooks/usePolling.ts
import { useEffect, useState } from 'react';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 5000
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetcher();
        setData(result);
        setError(null);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, intervalMs);
    return () => clearInterval(interval);
  }, [fetcher, intervalMs]);

  return { data, loading, error };
}
```

---

## CLI Integration Pattern

The dashboard CLI command will:
1. Check for Node.js and pnpm
2. Navigate to packages/dashboard
3. Run `pnpm build && pnpm start` (production) or `pnpm dev` (development)
4. Open browser to localhost:3000

```bash
# scripts/bash/speckit-dashboard.sh
check_dependencies() {
  command -v node >/dev/null 2>&1 || { log_error "Node.js not found"; exit 1; }
  command -v pnpm >/dev/null 2>&1 || { log_error "pnpm not found"; exit 1; }
}

start_server() {
  local dev_mode="$1"
  cd "${DASHBOARD_DIR}"
  if [[ "$dev_mode" == "true" ]]; then
    exec pnpm dev
  else
    pnpm build && exec pnpm start
  fi
}
```
