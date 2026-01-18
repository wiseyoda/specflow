# Implementation Plan: Command JSON Output

**Branch**: `1046-command-json-output` | **Date**: 2026-01-18 | **Spec**: [spec.md](spec.md)

## Summary

Add `--json` output support to the remaining 3 state commands (`set`, `init`, `sync`) and create comprehensive JSON schema documentation for all CLI commands. Following established patterns in `lib/output.ts` and existing commands.

## Technical Context

**Language/Version**: TypeScript 5.7+ (strict mode)
**Primary Dependencies**: Commander.js 12.x, chalk 5.x
**Storage**: N/A (output formatting only)
**Testing**: Vitest 2.x
**Target Platform**: Node.js 18+
**Project Type**: Monorepo CLI package
**Performance Goals**: N/A (trivial overhead)
**Constraints**: Backward compatible, text output unchanged
**Scale/Scope**: 3 commands + 1 documentation file

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| VII: Three-Line Output Rule | N/A | JSON mode is for machine parsing |
| IIa: TypeScript for CLI Packages | Pass | Using typed interfaces |
| III: CLI Over Direct Edits | Pass | Enables dashboard to use CLI programmatically |
| V: Helpful Error Messages | Pass | Error JSON includes message and hint |

## Project Structure

### Documentation (this feature)

```text
specs/1046-command-json-output/
├── discovery.md          # Codebase examination findings
├── spec.md               # Feature specification
├── requirements.md       # Requirements checklist
├── plan.md               # This file
├── tasks.md              # Implementation tasks
└── checklists/
    ├── implementation.md # Implementation guidance
    └── verification.md   # Verification checklist
```

### Source Code

```text
packages/cli/src/
├── commands/
│   └── state/
│       ├── set.ts        # Add --json flag, StateSetOutput interface
│       ├── init.ts       # Add --json flag, StateInitOutput interface
│       └── sync.ts       # Add --json flag, StateSyncOutput interface
└── lib/
    └── output.ts         # Existing - no changes needed

.specify/memory/
└── cli-json-schema.md    # NEW: JSON schema documentation
```

## Implementation Approach

### Pattern to Follow

All existing commands use this pattern (from `status.ts`, `next.ts`):

```typescript
// 1. Define typed output interface
export interface StateSetOutput {
  status: "success" | "error";
  command: "state set";
  key: string;
  value: unknown;
  previousValue?: unknown;
  error?: { message: string; hint: string };
}

// 2. Build result object
const result: StateSetOutput = {
  status: "success",
  command: "state set",
  key,
  value,
  previousValue,
};

// 3. Format human-readable output
function formatHumanReadable(result: StateSetOutput): string {
  return `Set ${result.key} = ${JSON.stringify(result.value)}`;
}

// 4. Call output() with both
output(result, formatHumanReadable(result));
```

### Changes Per Command

**state set** (`set.ts`):
- Add `--json` option
- Define `StateSetOutput` interface
- Wrap existing logic in try/catch that returns error JSON
- Use `output()` instead of `success()`

**state init** (`init.ts`):
- Add `--json` option
- Define `StateInitOutput` interface
- Return project info, state path, registry status
- Use `output()` instead of `success()`

**state sync** (`sync.ts`):
- Add `--json` option
- Define `StateSyncOutput` interface
- Collect changes into array instead of inline `info()` calls
- Return changes, warnings, dry-run status
- Use `output()` for final result

### Schema Documentation

Create `.specify/memory/cli-json-schema.md` documenting:
- All command output interfaces (14 existing + 3 new)
- Common patterns (status field, error structure)
- Examples for each command

## Testing Strategy

- Unit tests for each command's JSON output
- Verify JSON is valid and matches interface
- Verify error cases return proper error JSON
- Verify `--quiet` + `--json` interaction

## Complexity Tracking

No constitution violations. Implementation follows established patterns exactly.
