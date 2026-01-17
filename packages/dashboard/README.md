# SpecKit Dashboard

Web dashboard for managing SpecKit projects.

## Getting Started

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Features

### Project Overview
- View all registered SpecKit projects
- Real-time status updates via SSE file watching
- Project health and task progress indicators

### Project Detail Views
- **Status View**: Phase info, health status, task progress
- **Kanban View**: Tasks organized by status (To Do, In Progress, Done)
- **Timeline View**: Phase history and completion status

### Command Palette

Press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to open the command palette.

**Features:**
- Execute any SpecKit CLI command from the dashboard
- Command arguments via inline prompt
- Real-time output streaming in side drawer
- Toast notifications for success/failure
- Command history (session-scoped)

**Available Commands:**
- `issue create` - Create a new backlog issue
- `issue list` - List all issues
- `tasks status` - Show task completion status
- `phase show` - Display phase details
- `status` - Show project status
- And more (discovered dynamically from `speckit help`)

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/projects` | GET | List registered projects |
| `/api/events` | GET | SSE endpoint for real-time updates |
| `/api/commands/list` | GET | Available speckit commands |
| `/api/commands/execute` | POST | Execute a command |
| `/api/commands/stream` | GET | SSE stream for command output |

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint
```

## Tech Stack

- Next.js 16 + React 19
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- chokidar for file watching
- Sonner for toast notifications
