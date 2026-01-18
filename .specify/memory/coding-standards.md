# Coding Standards

> Bash and TypeScript conventions, patterns, and anti-patterns for SpecFlow.

**Last Updated**: 2026-01-18
**Archive Review**: PDRs directory (P003 promoted)
**Constitution Alignment**: Principles II (POSIX-Compliant Bash), IIa (TypeScript for CLI), IV (Simplicity)

---

## File Organization

### Directory Structure
```
bin/specflow                    Hybrid CLI dispatcher (routes to TS or bash)
packages/cli/
├── src/
│   ├── index.ts               CLI entry point (Commander.js)
│   ├── commands/              Command implementations
│   │   ├── status.ts
│   │   ├── next.ts
│   │   ├── mark.ts
│   │   ├── check.ts
│   │   ├── state/             State subcommands
│   │   └── phase/             Phase subcommands
│   └── lib/                   Shared libraries
│       ├── tasks.ts           Parse tasks.md
│       ├── roadmap.ts         Parse ROADMAP.md
│       ├── checklist.ts       Parse checklists
│       ├── context.ts         Project context
│       ├── health.ts          Health checks
│       └── state.ts           State file operations
├── tests/                     Vitest tests
└── dist/                      Compiled output
scripts/bash/
├── lib/
│   ├── common.sh              Core utilities (logging, paths, validation)
│   ├── json.sh                JSON manipulation (jq wrappers)
│   └── detection.sh           Project type detection
└── specflow-<command>.sh       Legacy command implementations
```

### Naming Conventions

#### Bash
| Type | Convention | Example |
|------|------------|---------|
| Executable | No extension | `specflow` |
| Library files | `.sh` extension | `common.sh` |
| Command scripts | `specflow-<cmd>.sh` | `specflow-state.sh` |
| Functions | `snake_case` | `get_repo_root()` |
| Constants | `UPPER_SNAKE_CASE` | `EXIT_SUCCESS` |
| Local variables | `lower_snake_case` | `local file_path` |
| Boolean checks | `is_` or `has_` prefix | `is_git_repo()` |

#### TypeScript
| Type | Convention | Example |
|------|------------|---------|
| Command files | `<command>.ts` | `status.ts` |
| Library files | `<name>.ts` | `tasks.ts` |
| Functions | `camelCase` | `parseTasksFile()` |
| Types/Interfaces | `PascalCase` | `TaskOutput` |
| Constants | `UPPER_SNAKE_CASE` | `EXIT_SUCCESS` |
| Variables | `camelCase` | `const filePath` |
| Boolean checks | `is` or `has` prefix | `isGitRepo()` |

---

## Script Header Pattern

```bash
#!/usr/bin/env bash
#
# Brief description of script purpose
# Usage: example command
#

set -euo pipefail  # Strict mode

# Guard against double-sourcing (libraries only)
if [[ -n "${SPECFLOW_COMMON_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
SPECFLOW_COMMON_LOADED=1

# Source libraries
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"
```

---

## Code Style

| Rule | Standard |
|------|----------|
| Indentation | 2 spaces (no tabs) |
| Line length | ~80-100 characters soft limit |
| Conditionals | `[[ ]]` (not `[ ]`) |
| Command substitution | `$(command)` (not backticks) |
| Variable expansion | Always quote: `"$var"`, `"${var}"` |
| Default values | `${var:-default}` syntax |
| Arithmetic | `(( ))` or `$((expr))` |

---

## Exit Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 0 | Success | `return 0` or `exit 0` |
| 1 | Error | `exit 1` for fatal errors |
| 2 | Warning | `exit 2` for non-critical issues |
| 64 | Usage error | Invalid command/arguments |

---

## Logging Functions

| Function | Purpose | Output |
|----------|---------|--------|
| `log_info` | General information | stdout (blue) |
| `log_success` | Success message | stdout (green) |
| `log_warn` | Warning | stderr (yellow) |
| `log_error` | Error | stderr (red) |
| `log_debug` | Debug (SPECFLOW_DEBUG=1) | stdout (dim) |
| `log_step` | Major operation | stdout (cyan, bold) |

**Three-Line Output Rule**: User-critical info in first 3 lines.

---

## JSON Handling

| Function | Purpose |
|----------|---------|
| `json_get <file> <key>` | Read value |
| `json_set <file> <key> <val>` | Write value (auto-types) |
| `json_set_string <file> <key> <val>` | Write as string |
| `json_has <file> <key>` | Check key exists |
| `json_validate <file>` | Validate syntax |

---

## Error Handling Patterns

```bash
# Pattern 1: Early validation exit
if ! is_git_repo; then
  log_error "Not in a git repository"
  exit 1
fi

# Pattern 2: Command with fallback
value=$(json_get "$file" "$key" 2>/dev/null || echo "")

# Pattern 3: Require command
if ! command_exists jq; then
  log_error "Required: jq"
  exit 1
fi
```

---

## Argument Parsing Pattern

```bash
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--verbose) VERBOSE=1; shift ;;
    --json) JSON_OUTPUT=1; shift ;;
    -h|--help) show_help; exit 0 ;;
    *) REMAINING_ARGS+=("$1"); shift ;;
  esac
done
```

---

## Anti-Patterns to Avoid

| Avoid | Use Instead |
|-------|-------------|
| `$var` unquoted | `"$var"` always |
| `[ ]` conditionals | `[[ ]]` |
| Backticks `` `cmd` `` | `$(cmd)` |
| `$var` undefined | `${var:-default}` |
| Silent failures | Log errors with context |
| Direct temp files | `mktemp` + trap cleanup |
| Non-atomic writes | Write to temp, then `mv` |
| Hardcoded paths | Use `get_*` functions |

---

## Help Text Pattern

```bash
show_help() {
  cat << 'EOF'
specflow <command> - Brief description

USAGE:
    specflow <command> [options]

COMMANDS:
    subcommand    Description

OPTIONS:
    -h, --help    Show help
    --json        JSON output

EXAMPLES:
    specflow command action
EOF
}
```

---

## Bash Code Review Checklist

- [ ] All variables quoted
- [ ] `[[ ]]` for conditionals
- [ ] Error handling on external commands
- [ ] No hardcoded paths
- [ ] Help text matches implementation
- [ ] Exit codes documented
- [ ] Tests pass with `set -euo pipefail`

---

# TypeScript CLI Standards

> TypeScript conventions for `packages/cli/` following Constitution Principle IIa.

---

## TypeScript Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| `strict` | `true` | Type safety |
| `module` | `ESNext` | Modern ESM |
| `target` | `ES2022` | Node 18+ features |
| `moduleResolution` | `bundler` | tsup compatibility |

---

## Command Structure Pattern

```typescript
// src/commands/<command>.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { output } from '../lib/output.js';

export interface CommandOutput {
  // Typed output schema
}

export function registerCommand(program: Command): void {
  program
    .command('name')
    .description('Brief description')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const result = await execute(options);
      output(result, options.json);
    });
}

async function execute(options: Options): Promise<CommandOutput> {
  // Implementation
}
```

---

## Output Patterns

### Three-Line Rule Compliance

```typescript
// Human-readable output must prioritize critical info
function formatHuman(result: StatusOutput): string {
  const lines = [
    `${result.health.status === 'healthy' ? 'OK' : 'WARN'}: Phase ${result.phase.number}`,
    `Progress: ${result.progress.percentage}% (${result.progress.tasksCompleted}/${result.progress.tasksTotal})`,
    `Next: ${result.nextAction}`,
  ];
  // Additional details after line 3
  return lines.join('\n');
}
```

### JSON Output

```typescript
// All commands support --json flag
import { output } from '../lib/output.js';

// output() handles both JSON and human-readable
output(result, options.json);
```

---

## Library Patterns

### File Parsing

```typescript
// src/lib/<parser>.ts
export interface ParsedItem {
  // Strongly typed result
}

export async function parseFile(filePath: string): Promise<ParsedItem[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  // Parse and return typed result
}
```

### Error Handling

```typescript
// Use custom error classes with context
export class SpecflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = 'SpecflowError';
  }
}

// Always include actionable guidance (Principle V)
throw new SpecflowError(
  'No tasks.md found',
  'TASKS_NOT_FOUND',
  'Run /flow.design to create design artifacts',
);
```

---

## Validation with Zod

```typescript
import { z } from 'zod';

// Define schemas in @specflow/shared
export const StateSchema = z.object({
  orchestration: z.object({
    phase: z.object({
      number: z.string(),
      name: z.string(),
      status: z.enum(['pending', 'in_progress', 'complete']),
    }),
    step: z.object({
      current: z.string(),
      index: z.number(),
    }),
  }),
});

export type State = z.infer<typeof StateSchema>;
```

---

## Testing Patterns

```typescript
// tests/commands/<command>.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { vol } from 'memfs';

describe('command', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should return expected output', async () => {
    // Setup fixtures with memfs
    vol.fromJSON({
      '/project/tasks.md': '- [ ] T001 Task one',
    });

    const result = await execute({ json: true });

    expect(result.tasks).toHaveLength(1);
  });
});
```

---

## TypeScript Code Review Checklist

- [ ] All functions have explicit return types
- [ ] No `any` types (use `unknown` if needed)
- [ ] Errors include context and suggestions
- [ ] JSON output matches documented schema
- [ ] Human output follows Three-Line Rule
- [ ] Tests use memfs for file system isolation
- [ ] Zod schemas validate external data

---

## UI Design Documentation

> Pattern for phases involving visual UI changes. Adopted from Phase 0050 (UX Simplification).

### Detection Keywords

Phases containing these keywords trigger automatic UI design artifact creation:

`dashboard`, `form`, `button`, `screen`, `page`, `view`, `component`, `modal`, `dialog`, `panel`, `widget`, `layout`, `navigation`, `menu`, `sidebar`, `header`, `footer`, `table`, `list`, `tab`

### Artifact Location

- **File**: `specs/NNNN-name/ui-design.md`
- **Created by**: `/flow.design` (step 2.5)
- **Verified by**: `specflow check --gate implement`

### Required Sections

| Section | Purpose |
|---------|---------|
| Current State (Before) | Existing UI or "New feature - no existing UI" |
| Proposed Design (After) | Description of proposed changes |
| Visual Mockup | ASCII or Mermaid diagram |
| Rationale | Why these design decisions were made |
| Component Inventory | Table of UI elements (name, type, notes) |

### Inline References

When `spec.md` mentions UI elements, add cross-references:
```markdown
The dashboard shows project status (see [ui-design.md](ui-design.md#dashboard)).
```
