# Troubleshooting

Common issues and solutions for SpecFlow.

## Quick Diagnostics

Run the check command first:

```bash
specflow check                    # Check everything
specflow check --fix              # Auto-fix common issues
specflow check --gate design      # Check specific gate
specflow check --gate implement   # Check implementation gate
specflow check --gate verify      # Check verification gate
specflow check --gate memory      # Check memory documents
```

---

## Installation Issues

### CLI Not Found

**Symptom:** `specflow: command not found`

**Solution:** Add to your shell config:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.claude/specflow-system/bin:$PATH"
```

Then reload:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

### TypeScript CLI Not Built

**Symptom:** `TypeScript CLI not built` error

**Solution:**

```bash
cd /path/to/specflow
pnpm --filter @specflow/cli build
```

### Installation Verification

```bash
specflow --version
specflow status
```

---

## State File Issues

### Invalid State File

**Symptom:** `Error: Invalid state file` or JSON parse errors

**Solutions:**

```bash
# Show current state
specflow state show

# Initialize new state
specflow state init

# Or manually inspect
cat .specify/orchestration-state.json | jq .
```

### State Out of Sync

**Symptom:** State shows different phase than file system

**Solution:**

The `specflow status` command automatically derives progress from filesystem artifacts. If your state file is outdated, the correct step and task counts will be detected from:
- Existing files: spec.md → plan.md → tasks.md → checklists/
- Task checkboxes in tasks.md

Run `specflow check --fix` to auto-correct state issues.

---

## Project Structure Issues

### Missing .specify Directory

**Symptom:** Commands fail with "not a SpecFlow project"

**Solution:**

Run `/flow.init` in Claude Code to initialize the project structure.

### Missing constitution.md

**Symptom:** Warnings about missing constitution.md

**Solution:**

Run `/flow.init` to create memory documents, or manually create:

```bash
mkdir -p .specify/memory
touch .specify/memory/constitution.md
```

---

## ROADMAP Issues

### Invalid ROADMAP Format

**Symptom:** `Error: Could not parse ROADMAP.md`

**Common issues:**
- Missing phase headers (`### Phase NNNN:`)
- Invalid status values
- Duplicate phase numbers

**Solution:**

Check ROADMAP.md format. Each phase should look like:

```markdown
### Phase 0010: Feature Name
**Status:** pending
**Branch:** `0010-feature-name`
```

Valid status values: `pending`, `in_progress`, `complete`

### Phase Not Found

**Symptom:** `specflow phase open` fails with phase not found

**Solution:**

1. Check that the phase exists in ROADMAP.md
2. Use the correct 4-digit phase number (e.g., `0010` not `10`)
3. Or add the phase first: `specflow phase add 0010 "feature-name"`

---

## Task Issues

### Task Not Found

**Symptom:** `specflow mark T001` fails

**Solutions:**

1. Check tasks.md exists in the current phase directory
2. Verify task ID format (T001, T002, etc.)
3. Run `specflow next` to see available tasks

### Checklist Item Not Found

**Symptom:** `specflow mark V-001` fails

**Solutions:**

1. Check checklists exist in `specs/NNNN-feature/checklists/`
2. Use correct prefix: `V-` for verification, `I-` for implementation
3. Check that the checklist file contains the item

---

## Git Issues

### Not a Git Repository

**Symptom:** Git-related commands fail

**Solution:**

```bash
git init
git add .
git commit -m "Initial commit"
```

### Branch Conflicts

**Symptom:** `specflow phase open` can't create branch

**Solutions:**

```bash
# Check current branches
git branch -a

# Ensure you're on main/master
git checkout main

# Delete conflicting branch if needed
git branch -D 0010-feature-name
```

---

## Orchestration Issues

### Stuck in Loop

**Symptom:** Orchestration keeps repeating steps

**Solutions:**

```bash
# Check current state
specflow status

# Reset orchestration step
specflow state set "orchestration.step.current=design"

# Or skip to specific step
/flow.orchestrate skip-to implement
```

### Gate Failures

**Symptom:** Validation gate fails

**Solution:**

```bash
# Check what's failing
specflow check --gate design
specflow check --gate implement
specflow check --gate verify

# Auto-fix issues
specflow check --fix
```

---

## Memory Document Issues

### Missing Memory Documents

**Symptom:** `/flow.memory` reports missing documents

**Solution:**

Run `/flow.init` to generate memory documents from your project context.

### Drift Detection

**Symptom:** Memory docs don't match codebase

**Solution:**

```
/flow.memory              # Full reconciliation
/flow.memory --fix        # Auto-fix without confirmation
```

---

## Performance Issues

### Slow Commands

**Symptom:** Commands take too long

**Solutions:**

```bash
# Quick status (skips deep validation)
specflow status --quick

# Skip reconciliation for memory checks
/flow.memory --no-reconcile
```

---

## Common Error Messages

| Error | Solution |
|-------|----------|
| `Command 'X' is deprecated` | Use the new TypeScript CLI commands (see [CLI Reference](cli-reference.md)) |
| `Not a SpecFlow project` | Run `/flow.init` to initialize |
| `Phase not found` | Check ROADMAP.md or run `specflow phase add` |
| `Tasks file not found` | Run `/flow.design` to create design artifacts |
| `Invalid state file` | Run `specflow state init` to reinitialize |

---

## Getting Help

1. **Run diagnostics:** `specflow check --fix`
2. **Check status:** `specflow status --json`
3. **Verbose output:** Most slash commands support `--verbose`
4. **JSON output:** Add `--json` for machine-readable errors
5. **File an issue:** https://github.com/wiseyoda/claude-specflow-orchestration/issues
