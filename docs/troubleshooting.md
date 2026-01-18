# Troubleshooting

Common issues and solutions for SpecFlow.

## Quick Diagnostics

Run the doctor command first:

```bash
specflow doctor                    # Check everything
specflow doctor --fix              # Auto-fix common issues
specflow doctor --check <area>     # Check specific area
```

**Valid check areas:** `system`, `project`, `state`, `manifest`, `paths`, `git`, `templates`, `version`, `roadmap`, `reality`, `all`

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

### Missing jq

**Symptom:** `jq: command not found` or JSON parsing errors

**Solution:**

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Fedora/RHEL
sudo dnf install jq
```

### Installation Verification

```bash
./install.sh --check
specflow doctor --check system
```

---

## State File Issues

### Invalid State File

**Symptom:** `Error: Invalid state file` or JSON parse errors

**Solutions:**

```bash
# Validate current state
specflow state validate

# Reset to defaults (loses current progress)
specflow state reset

# Or manually inspect
cat .specify/orchestration-state.json | jq .
```

### State Schema Mismatch

**Symptom:** Missing fields or version warnings

**Solution:** Migrate to v2.0:

```bash
specflow state migrate
```

This preserves your progress and upgrades the schema.

### State Out of Sync

**Symptom:** State shows different phase than file system

**Solution:**

```bash
# Preview what would change
specflow reconcile --dry-run

# Trust file system
specflow reconcile --trust-files

# Trust state file
specflow reconcile --trust-state
```

**Note:** `specflow status` automatically derives progress from filesystem artifacts. If your state file is outdated, the correct step and task counts will be detected from:
- Existing files: spec.md → plan.md → tasks.md → checklists/
- Task checkboxes in tasks.md

---

## Project Structure Issues

### Missing .specify Directory

**Symptom:** Commands fail with "not a SpecFlow project"

**Solution:**

```bash
specflow scaffold --safe    # Preview
specflow scaffold           # Create structure
```

### Corrupted Structure

**Solution:**

```bash
specflow scaffold --force   # Recreate (preserves custom files)
```

### Wrong Project Type Detected

**Solution:**

```bash
specflow scaffold --type python  # Force specific type
```

---

## ROADMAP Issues

### Invalid ROADMAP Format

**Symptom:** `Error: Could not parse ROADMAP.md`

**Solution:**

```bash
specflow roadmap validate
```

Common issues:
- Missing phase headers (`### Phase NNNN:`)
- Invalid status values
- Duplicate phase numbers

### Phase Number Gaps

**Solution:**

```bash
specflow roadmap renumber
```

### 3-Digit to 4-Digit Migration

**Solution:**

```bash
specflow migrate roadmap
```

---

## Git Issues

### Not a Git Repository

**Symptom:** Git commands fail

**Solution:**

```bash
git init
git add .
git commit -m "Initial commit"
```

### Branch Conflicts

**Symptom:** Can't create feature branch

**Solutions:**

```bash
# Check current branches
specflow git branch list

# Sync with remote
specflow git sync

# Force checkout (loses local changes)
git checkout -f main
```

---

## Template Issues

### Templates Not Found

**Note:** Missing templates are flagged as **errors** by `specflow doctor` since they can cause workflow failures.

**Solution:**

```bash
specflow templates check           # See what's missing
specflow templates sync            # Update outdated + copy missing (recommended)
specflow doctor --check templates  # Full template check
```

### Template Out of Date

**Solution:**

```bash
specflow templates diff <file>     # See changes
specflow templates update <file>   # Update specific
specflow templates update-all      # Update all outdated
specflow templates sync            # Update all + copy new templates
```

**Tip:** `specflow doctor` suggests `specflow templates sync` when templates need attention.

---

## Memory Document Issues

### Missing Constitution

**Symptom:** Warnings about missing constitution.md

**Solution:**

```bash
specflow memory init constitution
# or
/specflow.constitution
```

### Drift Detection

**Symptom:** Memory docs don't match codebase

**Solution:**

```bash
/specflow.memory --reconcile
```

---

## Orchestration Issues

### Stuck in Loop

**Symptom:** Orchestration keeps repeating steps

**Solutions:**

```bash
# Check current state
specflow status

# Force specific phase
/specflow.orchestrate --phase 0020

# Reset orchestration state
specflow state set "orchestration.step.current=specify"
```

### Gate Failures

**Symptom:** `Gate failed: <gate-name>`

**Solution:**

```bash
# Check what's failing
specflow gate status
specflow gate <gate-name>

# Skip gates (not recommended)
/specflow.orchestrate --skip-gates
```

---

## Performance Issues

### Slow Commands

**Symptom:** Commands take too long

**Solutions:**

```bash
# Quick status (skips deep validation)
specflow status --quick

# Skip reconciliation
/specflow.memory --no-reconcile
```

---

## Getting Help

1. **Smart entry point:** `/specflow.start` - auto-detects project state and routes to the right command
2. **Run diagnostics:** `specflow doctor`
3. **Check specific area:** `specflow doctor --check <area>`
4. **Verbose output:** Add `--verbose` to most commands
5. **JSON output:** Add `--json` for machine-readable errors
6. **File an issue:** https://github.com/wiseyoda/claude-specflow-orchestration/issues
