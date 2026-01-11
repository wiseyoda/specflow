# Coding Standards

> POSIX-compliant bash conventions, patterns, and anti-patterns for SpecKit scripts.

**Last Updated**: 2026-01-11
**Constitution Alignment**: Principles II (POSIX-Compliant Bash), IV (Simplicity)

---

## File Organization

### Directory Structure
```
bin/speckit                    Main CLI dispatcher
scripts/bash/
├── lib/
│   ├── common.sh              Core utilities (logging, paths, validation)
│   ├── json.sh                JSON manipulation (jq wrappers)
│   └── detection.sh           Project type detection
└── speckit-<command>.sh       Individual command implementations
```

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Executable | No extension | `speckit` |
| Library files | `.sh` extension | `common.sh` |
| Command scripts | `speckit-<cmd>.sh` | `speckit-state.sh` |
| Functions | `snake_case` | `get_repo_root()` |
| Constants | `UPPER_SNAKE_CASE` | `EXIT_SUCCESS` |
| Local variables | `lower_snake_case` | `local file_path` |
| Boolean checks | `is_` or `has_` prefix | `is_git_repo()` |

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
if [[ -n "${SPECKIT_COMMON_LOADED:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi
SPECKIT_COMMON_LOADED=1

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
| `log_debug` | Debug (SPECKIT_DEBUG=1) | stdout (dim) |
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
speckit <command> - Brief description

USAGE:
    speckit <command> [options]

COMMANDS:
    subcommand    Description

OPTIONS:
    -h, --help    Show help
    --json        JSON output

EXAMPLES:
    speckit command action
EOF
}
```

---

## Code Review Checklist

- [ ] All variables quoted
- [ ] `[[ ]]` for conditionals
- [ ] Error handling on external commands
- [ ] No hardcoded paths
- [ ] Help text matches implementation
- [ ] Exit codes documented
- [ ] Tests pass with `set -euo pipefail`
