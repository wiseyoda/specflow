# Implementation Plan: Core UI Scaffold

**Branch**: `1010-core-ui-scaffold` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)

---

## Summary

Establish a Next.js 14+ web dashboard for SpecKit that displays registered projects from `~/.speckit/registry.json`. The dashboard uses pnpm workspaces with shared Zod schemas, implements dark/light mode with system preference detection, and provides a command palette shell activated by Cmd+K. Entry point is `speckit dashboard` CLI command.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+, React 18+, Tailwind CSS 3.x, shadcn/ui, Zod, next-themes
**Storage**: File-based (`~/.speckit/registry.json`) - no database in this phase
**Testing**: Vitest (per user preferences)
**Target Platform**: Desktop browsers (macOS, Linux, Windows)
**Project Type**: Monorepo (pnpm workspaces)
**Performance Goals**: Server start <5s, theme toggle <100ms, command palette <100ms
**Constraints**: Desktop-only (no mobile), polling-based sync (no file watchers this phase)
**Scale/Scope**: Single user, local projects only

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Developer Experience First | ✅ Pass | Simple `speckit dashboard` command, keyboard-driven UI |
| II. POSIX-Compliant Bash | ✅ Pass | CLI launcher script uses POSIX bash |
| III. CLI Over Direct Edits | ✅ Pass | Dashboard reads files, doesn't modify them |
| IV. Simplicity Over Cleverness | ✅ Pass | Standard Next.js patterns, no exotic libraries |
| V. Helpful Error Messages | ✅ Pass | Clear errors for missing deps, invalid registry |
| VI. Graceful Degradation | ✅ Pass | Shows empty state for missing registry |
| VII. Three-Line Output Rule | ✅ Pass | CLI output follows pattern |

---

## Project Structure

### Documentation (this feature)

```text
specs/1010-core-ui-scaffold/
├── discovery.md         # Codebase findings (Phase 0)
├── spec.md              # Feature specification
├── requirements.md      # Requirements checklist
├── research.md          # Technology research
├── plan.md              # This file
├── data-model.md        # Data schemas
└── tasks.md             # Generated tasks
```

### Source Code (repository root)

```text
packages/
├── dashboard/                    # Next.js App
│   ├── app/
│   │   ├── layout.tsx           # Root layout with ThemeProvider
│   │   ├── page.tsx             # Home page (project list)
│   │   ├── globals.css          # Tailwind imports
│   │   └── providers.tsx        # Client providers wrapper
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx      # Left sidebar navigation
│   │   │   ├── header.tsx       # Top header with theme toggle
│   │   │   └── main-layout.tsx  # Layout wrapper
│   │   ├── projects/
│   │   │   ├── project-list.tsx # Project list with expansion
│   │   │   ├── project-card.tsx # Individual project card
│   │   │   └── empty-state.tsx  # No projects message
│   │   ├── command-palette.tsx  # Cmd+K modal shell
│   │   └── mode-toggle.tsx      # Dark/light mode toggle
│   ├── hooks/
│   │   ├── use-polling.ts       # Polling hook for auto-refresh
│   │   └── use-keyboard.ts      # Keyboard shortcut hook
│   ├── lib/
│   │   ├── registry.ts          # Registry file reading
│   │   └── utils.ts             # Utility functions (cn helper)
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── next.config.js
│
└── shared/                       # Shared TypeScript package
    ├── src/
    │   ├── schemas/
    │   │   ├── registry.ts      # Registry Zod schema
    │   │   └── index.ts         # Schema exports
    │   └── index.ts             # Package entry
    ├── package.json
    └── tsconfig.json

scripts/bash/
└── speckit-dashboard.sh          # CLI launcher

bin/speckit                       # Add dashboard command routing

pnpm-workspace.yaml               # Workspace config (root)
package.json                      # Root package.json with scripts
```

**Structure Decision**: Monorepo with `packages/` as required by tech-stack.md. Dashboard app in `packages/dashboard/`, shared Zod schemas in `packages/shared/`.

---

## Component Architecture

### Layout Hierarchy

```
RootLayout (app/layout.tsx)
└── ThemeProvider (next-themes)
    └── MainLayout (components/layout/main-layout.tsx)
        ├── Sidebar (components/layout/sidebar.tsx)
        ├── Header (components/layout/header.tsx)
        │   └── ModeToggle
        └── Main Content
            └── Page Content

CommandPalette (global modal, triggered by Cmd+K)
```

### Data Flow

```
~/.speckit/registry.json
    ↓
API Route: /api/projects (reads file, validates with Zod)
    ↓
usePolling hook (fetches every 5s)
    ↓
ProjectList component (renders projects)
    ↓
ProjectCard (expandable, shows details)
```

---

## Key Implementation Details

### 1. Registry Schema (packages/shared)

```typescript
// packages/shared/src/schemas/registry.ts
import { z } from 'zod';

export const ProjectSchema = z.object({
  path: z.string(),
  name: z.string(),
  registered_at: z.string(),
  last_seen: z.string().optional(),
});

export const RegistrySchema = z.object({
  projects: z.record(z.string(), ProjectSchema),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
```

### 2. API Route for Projects

```typescript
// packages/dashboard/app/api/projects/route.ts
import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { RegistrySchema } from '@speckit/shared';

export async function GET() {
  const registryPath = path.join(homedir(), '.speckit', 'registry.json');

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const parsed = RegistrySchema.parse(JSON.parse(content));
    return Response.json({ projects: Object.entries(parsed.projects) });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return Response.json({ projects: [], empty: true });
    }
    return Response.json({ error: 'Invalid registry' }, { status: 500 });
  }
}
```

### 3. Polling Hook

```typescript
// packages/dashboard/hooks/use-polling.ts
export function usePolling<T>(url: string, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch(url);
      setData(await res.json());
    };
    fetchData();
    const interval = setInterval(fetchData, intervalMs);
    return () => clearInterval(interval);
  }, [url, intervalMs]);

  return data;
}
```

### 4. Command Palette Shell

```typescript
// packages/dashboard/components/command-palette.tsx
"use client"
import { useEffect, useState } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty } from '@/components/ui/command';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0">
        <Command>
          <CommandInput placeholder="Type a command..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {/* Future: Add command items */}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

### 5. CLI Launcher

```bash
# scripts/bash/speckit-dashboard.sh
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

DASHBOARD_DIR="${SCRIPT_DIR}/../../packages/dashboard"

show_help() {
  cat << 'EOF'
speckit dashboard - Start the SpecKit web dashboard

USAGE:
    speckit dashboard [OPTIONS]

OPTIONS:
    --dev       Run in development mode (hot reload)
    --port N    Use specific port (default: 3000)
    -h, --help  Show this help

EXAMPLES:
    speckit dashboard           # Start production server
    speckit dashboard --dev     # Start dev server with hot reload
EOF
}

main() {
  local dev_mode=false
  local port=3000

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dev) dev_mode=true; shift ;;
      --port) port="$2"; shift 2 ;;
      -h|--help) show_help; exit 0 ;;
      *) log_error "Unknown option: $1"; exit 1 ;;
    esac
  done

  # Check dependencies
  command -v node >/dev/null 2>&1 || {
    log_error "Node.js not found"
    log_info "Install: brew install node (macOS) or see https://nodejs.org"
    exit 1
  }
  command -v pnpm >/dev/null 2>&1 || {
    log_error "pnpm not found"
    log_info "Install: npm install -g pnpm"
    exit 1
  }

  # Navigate to dashboard
  if [[ ! -d "$DASHBOARD_DIR" ]]; then
    log_error "Dashboard not found at $DASHBOARD_DIR"
    log_info "Run 'speckit dashboard --setup' to initialize"
    exit 1
  fi

  cd "$DASHBOARD_DIR"

  if [[ "$dev_mode" == "true" ]]; then
    log_info "Starting dashboard (dev mode) on port $port..."
    exec pnpm dev --port "$port"
  else
    log_info "Building dashboard..."
    pnpm build
    log_info "Starting dashboard on port $port..."
    exec pnpm start --port "$port"
  fi
}

main "$@"
```

---

## Dependencies

### packages/dashboard/package.json

```json
{
  "name": "@speckit/dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next-themes": "^0.3.0",
    "lucide-react": "^0.400.0",
    "@speckit/shared": "workspace:*",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "cmdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

### packages/shared/package.json

```json
{
  "name": "@speckit/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Node.js/pnpm not installed | Clear error message with install instructions |
| Registry file doesn't exist | Show friendly empty state, not error |
| Registry file malformed | Validate with Zod, show error state with doctor suggestion |
| Port 3000 in use | Auto-increment to 3001-3010, display actual port |
| Theme flash on load | Use `suppressHydrationWarning` on html element |

---

## Testing Strategy

| Type | Framework | Scope |
|------|-----------|-------|
| Unit | Vitest | Zod schemas, utility functions |
| Component | Vitest + React Testing Library | ProjectCard, ModeToggle |
| E2E | Playwright (future) | Full user flows (not this phase) |

---

## Implementation Phases

1. **Setup** - Monorepo structure, dependencies, configs
2. **Shared Package** - Zod schemas for registry
3. **Dashboard Shell** - Layout, routing, theme provider
4. **API Layer** - Projects API route with Zod validation
5. **Project List** - List view with expansion
6. **Theme Toggle** - Dark/light mode with persistence
7. **Command Palette** - Cmd+K shell (placeholder content)
8. **CLI Launcher** - `speckit dashboard` command
9. **Polish** - Error states, loading states, edge cases
