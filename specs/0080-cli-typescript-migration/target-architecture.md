# Target Architecture

## Package Structure

```
specflow/
├── bin/
│   └── specflow                    # Thin bash dispatcher → node
│
├── packages/
│   ├── cli/                        # NEW: TypeScript CLI
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts            # Entry point
│   │   │   ├── commands/
│   │   │   │   ├── state.ts        # state get/set/init/reset
│   │   │   │   ├── tasks.ts        # tasks status/mark/list
│   │   │   │   ├── roadmap.ts      # roadmap status/update/next
│   │   │   │   ├── doctor.ts       # doctor check/fix
│   │   │   │   ├── phase.ts        # phase show/list/archive
│   │   │   │   ├── checklist.ts    # checklist status/list
│   │   │   │   ├── context.ts      # context (current feature)
│   │   │   │   └── status.ts       # status (overview)
│   │   │   ├── lib/
│   │   │   │   ├── state.ts        # State file operations
│   │   │   │   ├── tasks.ts        # Task parsing/marking
│   │   │   │   ├── roadmap.ts      # Roadmap parsing
│   │   │   │   ├── markdown.ts     # Markdown utilities
│   │   │   │   ├── git.ts          # Git operations
│   │   │   │   └── paths.ts        # Path resolution
│   │   │   └── types/
│   │   │       └── index.ts        # Re-export from shared
│   │   └── tests/
│   │       ├── commands/
│   │       ├── lib/
│   │       └── fixtures/
│   │
│   ├── shared/                     # EXISTING: Shared types
│   │   └── src/
│   │       └── schemas/
│   │           ├── state.ts        # OrchestrationState schema
│   │           ├── roadmap.ts      # Phase/Roadmap schemas
│   │           └── tasks.ts        # Task schemas
│   │
│   └── dashboard/                  # EXISTING: Web UI
│       └── ...
│
├── commands/                       # EXISTING: Slash commands
│   ├── flow.orchestrate.md
│   ├── flow.design.md
│   ├── flow.implement.md
│   ├── flow.verify.md
│   ├── flow.merge.md
│   ├── flow.init.md
│   ├── flow.roadmap.md
│   ├── flow.memory.md
│   └── flow.review.md
│
├── scripts/
│   └── bash/                       # REDUCED: Only simple wrappers
│       ├── lib/
│       │   └── common.sh           # Keep for bash wrappers
│       ├── specflow-git.sh         # Keep (wraps git)
│       ├── specflow-scaffold.sh    # Keep (one-time setup)
│       └── specflow-dashboard.sh   # Keep (launches dashboard)
│
└── templates/                      # EXISTING: Document templates
    └── ...
```

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                     bin/specflow                             │
│                   (bash dispatcher)                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌───────────┐ ┌──────────────────┐
│ packages/cli    │ │ bash/     │ │ packages/        │
│ (TypeScript)    │ │ wrappers  │ │ dashboard        │
└────────┬────────┘ └───────────┘ └────────┬─────────┘
         │                                  │
         └──────────────┬──────────────────┘
                        ▼
              ┌─────────────────┐
              │ packages/shared │
              │ (types/schemas) │
              └─────────────────┘
```

## Command Routing

```bash
#!/usr/bin/env bash
# bin/specflow

SCRIPT_DIR="$(dirname "$0")"
CLI_BIN="$SCRIPT_DIR/../packages/cli/dist/index.js"

case "$1" in
  # TypeScript commands (most)
  state|tasks|roadmap|doctor|phase|checklist|context|status)
    exec node "$CLI_BIN" "$@"
    ;;

  # Bash wrappers (few)
  git|scaffold|dashboard)
    exec bash "$SCRIPT_DIR/../scripts/bash/specflow-$1.sh" "${@:2}"
    ;;

  # Help/version
  --help|-h)
    exec node "$CLI_BIN" --help
    ;;
  --version|-v)
    exec node "$CLI_BIN" --version
    ;;

  *)
    echo "Unknown command: $1"
    exit 1
    ;;
esac
```

## Shared Types Flow

```typescript
// packages/shared/src/schemas/state.ts
export const OrchestrationStateSchema = z.object({...});
export type OrchestrationState = z.infer<typeof OrchestrationStateSchema>;

// packages/cli/src/lib/state.ts
import { OrchestrationState } from '@specflow/shared';

// packages/dashboard/src/lib/state.ts
import { OrchestrationState } from '@specflow/shared';

// Both CLI and Dashboard use the same types!
```

## Build & Test

```bash
# From repo root
pnpm install                    # Install all packages
pnpm --filter @specflow/cli build    # Build CLI
pnpm --filter @specflow/cli test     # Test CLI
pnpm --filter @specflow/shared build # Build shared types

# Development
pnpm --filter @specflow/cli dev      # Watch mode

# Full build
pnpm build                      # Build all packages
pnpm test                       # Test all packages
```

## Installation

### Development (from repo)
```bash
./install.sh --upgrade          # Copies to ~/.claude/
```

### Future: npm (optional)
```bash
npm install -g @specflow/cli    # Global install
```

## Line Count Comparison

| Component | Current (Bash) | Target (TypeScript) |
|-----------|---------------|---------------------|
| CLI scripts | ~18,000 | ~4,000 |
| Library code | ~1,400 | ~1,500 |
| Shared types | 0 | ~500 |
| Tests | 0 | ~2,000 |
| **Total** | **~19,400** | **~8,000** |

**Reduction: ~60% less code** (with tests added)
