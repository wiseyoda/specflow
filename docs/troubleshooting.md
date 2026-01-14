# Troubleshooting

Common issues and solutions for SpecKit.

## Quick Diagnostics

Run the doctor command first:

```bash
speckit doctor                    # Check everything
speckit doctor --fix              # Auto-fix common issues
speckit doctor --check <area>     # Check specific area
```

**Valid check areas:** `system`, `project`, `state`, `manifest`, `paths`, `git`, `templates`, `version`, `roadmap`, `reality`, `all`

---

## Installation Issues

### CLI Not Found

**Symptom:** `speckit: command not found`

**Solution:** Add to your shell config:

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.claude/speckit-system/bin:$PATH"
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
speckit doctor --check system
```

---

## State File Issues

### Invalid State File

**Symptom:** `Error: Invalid state file` or JSON parse errors

**Solutions:**

```bash
# Validate current state
speckit state validate

# Reset to defaults (loses current progress)
speckit state reset

# Or manually inspect
cat .specify/orchestration-state.json | jq .
```

### State Schema Mismatch

**Symptom:** Missing fields or version warnings

**Solution:** Migrate to v2.0:

```bash
speckit state migrate
```

This preserves your progress and upgrades the schema.

### State Out of Sync

**Symptom:** State shows different phase than file system

**Solution:**

```bash
# Preview what would change
speckit reconcile --dry-run

# Trust file system
speckit reconcile --trust-files

# Trust state file
speckit reconcile --trust-state
```

**Note:** `speckit status` automatically derives progress from filesystem artifacts. If your state file is outdated, the correct step and task counts will be detected from:
- Existing files: spec.md → plan.md → tasks.md → checklists/
- Task checkboxes in tasks.md

---

## Project Structure Issues

### Missing .specify Directory

**Symptom:** Commands fail with "not a SpecKit project"

**Solution:**

```bash
speckit scaffold --safe    # Preview
speckit scaffold           # Create structure
```

### Corrupted Structure

**Solution:**

```bash
speckit scaffold --force   # Recreate (preserves custom files)
```

### Wrong Project Type Detected

**Solution:**

```bash
speckit scaffold --type python  # Force specific type
```

---

## ROADMAP Issues

### Invalid ROADMAP Format

**Symptom:** `Error: Could not parse ROADMAP.md`

**Solution:**

```bash
speckit roadmap validate
```

Common issues:
- Missing phase headers (`### Phase NNNN:`)
- Invalid status values
- Duplicate phase numbers

### Phase Number Gaps

**Solution:**

```bash
speckit roadmap renumber
```

### 3-Digit to 4-Digit Migration

**Solution:**

```bash
speckit migrate roadmap
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
speckit git branch list

# Sync with remote
speckit git sync

# Force checkout (loses local changes)
git checkout -f main
```

---

## Template Issues

### Templates Not Found

**Note:** Missing templates are flagged as **errors** by `speckit doctor` since they can cause workflow failures.

**Solution:**

```bash
speckit templates check           # See what's missing
speckit templates sync            # Update outdated + copy missing (recommended)
speckit doctor --check templates  # Full template check
```

### Template Out of Date

**Solution:**

```bash
speckit templates diff <file>     # See changes
speckit templates update <file>   # Update specific
speckit templates update-all      # Update all outdated
speckit templates sync            # Update all + copy new templates
```

**Tip:** `speckit doctor` suggests `speckit templates sync` when templates need attention.

---

## Memory Document Issues

### Missing Constitution

**Symptom:** Warnings about missing constitution.md

**Solution:**

```bash
speckit memory init constitution
# or
/speckit.constitution
```

### Drift Detection

**Symptom:** Memory docs don't match codebase

**Solution:**

```bash
/speckit.memory --reconcile
```

---

## Orchestration Issues

### Stuck in Loop

**Symptom:** Orchestration keeps repeating steps

**Solutions:**

```bash
# Check current state
speckit status

# Force specific phase
/speckit.orchestrate --phase 0020

# Reset orchestration state
speckit state set "orchestration.step.current=specify"
```

### Gate Failures

**Symptom:** `Gate failed: <gate-name>`

**Solution:**

```bash
# Check what's failing
speckit gate status
speckit gate <gate-name>

# Skip gates (not recommended)
/speckit.orchestrate --skip-gates
```

---

## Performance Issues

### Slow Commands

**Symptom:** Commands take too long

**Solutions:**

```bash
# Quick status (skips deep validation)
speckit status --quick

# Skip reconciliation
/speckit.memory --no-reconcile
```

---

## Getting Help

1. **Smart entry point:** `/speckit.start` - auto-detects project state and routes to the right command
2. **Run diagnostics:** `speckit doctor`
3. **Check specific area:** `speckit doctor --check <area>`
4. **Verbose output:** Add `--verbose` to most commands
5. **JSON output:** Add `--json` for machine-readable errors
6. **File an issue:** https://github.com/wiseyoda/claude-speckit-orchestration/issues
