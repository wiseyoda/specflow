# SpecKit Edge Case Analysis

> Comprehensive analysis of project states and edge cases for safe, non-destructive handling.
>
> **North Star**: Only IMPROVE and enable the SpecKit flow, never be destructive.

---

## Table of Contents

1. [Scenario Analysis](#scenario-analysis)
2. [Detection Matrix](#detection-matrix)
3. [Healing Strategies](#healing-strategies)
4. [Implementation Plan](#implementation-plan)

---

## Scenario Analysis

### Scenario 1: Never Used SpecKit Before

**Indicators:**
- No `~/.claude/speckit-system/` directory
- No `.specify/` directory
- `speckit` command fails with "command not found"

**Current Behavior:**
- `/speckit.start` fails when CLI commands don't exist
- No guidance on how to install

**Gaps:**
- [ ] CLI availability check before any operations
- [ ] Installation guidance when CLI missing
- [ ] Graceful degradation without CLI

**Proposed Handling:**
```
┌─────────────────────────────────────────────────────────────┐
│ SpecKit is not installed on this system.                     │
│                                                               │
│ To install, run:                                              │
│   git clone https://github.com/USER/claude-speckit-orchestration │
│   cd claude-speckit-orchestration && ./install.sh            │
│                                                               │
│ After installation, add to your PATH:                         │
│   export PATH="$HOME/.claude/speckit-system/bin:$PATH"       │
│                                                               │
│ Then run /speckit.start again.                                │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 2: Installed from GitHub (Current Version)

**Indicators:**
- `~/.claude/speckit-system/` exists
- `~/.claude/speckit-system/VERSION` matches latest
- CLI commands work

**Current Behavior:**
- Works correctly ✅

**Gaps:**
- [ ] No VERSION file exists currently
- [ ] No version checking mechanism

**Proposed Handling:**
- Add VERSION file to installation
- Check version in `speckit.start`
- Continue normally if version is current

---

### Scenario 3: Old Version of SpecKit Installed

**Indicators:**
- `~/.claude/speckit-system/` exists
- VERSION file missing or outdated
- State file may be v1.0 format (uses `.project` instead of `.config`)
- Templates may lack version headers

**Current Behavior:**
- State file validation warns but doesn't fix
- May fail on missing sections
- Templates show as "needs update"

**Gaps:**
- [ ] No automatic state migration
- [ ] No upgrade path for old state files
- [ ] Could lose data if we just overwrite

**v1.0 to v2.0 State Migration:**
```json
// v1.0 format (old)
{
  "version": "1.0",
  "project": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "name": "MyProject"
  }
}

// v2.0 format (new)
{
  "version": "2.0",
  "config": {
    "roadmap_path": "ROADMAP.md",
    "memory_path": ".specify/memory/",
    "specs_path": "specs/",
    "scripts_path": ".specify/scripts/",
    "templates_path": ".specify/templates/"
  },
  "project": {
    "name": "MyProject",
    "description": null,
    "type": null,
    "criticality": null
  },
  "interview": { ... },
  "orchestration": { ... }
}
```

**Proposed Handling:**
```
┌─────────────────────────────────────────────────────────────┐
│ SpecKit State Migration Required                             │
│                                                               │
│ Your project uses SpecKit state format v1.0.                 │
│ Current version is v2.0.                                      │
│                                                               │
│ Changes:                                                      │
│ • Config paths moved from .project to .config                 │
│ • Added interview and orchestration tracking                  │
│ • All existing data will be preserved                         │
│                                                               │
│ [Migrate Now] [View Changes] [Skip (may cause issues)]        │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 4: New Repository

**Indicators:**
- CLI is available
- No `.specify/` directory
- No ROADMAP.md
- May have existing files to preserve

**Sub-scenarios to detect:**

| Existing Files | Handling |
|----------------|----------|
| None | Clean initialization |
| CLAUDE.md exists | Offer to merge or preserve |
| docs/ exists | Detect, offer integration |
| .github/ exists | Preserve, enhance |
| README.md exists | Preserve, never overwrite |
| specs/ exists (non-SpecKit) | Detect format, offer conversion |

**Current Behavior:**
- Initializes without checking for existing files
- May overwrite CLAUDE.md

**Gaps:**
- [ ] No detection of existing documentation
- [ ] No merge/preserve options
- [ ] Could overwrite user work

**Proposed Handling:**
```
┌─────────────────────────────────────────────────────────────┐
│ Existing Files Detected                                       │
│                                                               │
│ Found in this repository:                                     │
│ ✓ CLAUDE.md (2.1 KB) - Contains project instructions          │
│ ✓ docs/ (12 files) - Documentation directory                  │
│                                                               │
│ SpecKit will:                                                 │
│ • Create .specify/ for project memory (new)                   │
│ • Create specs/ for feature specifications (new)              │
│ • Create ROADMAP.md for development phases (new)              │
│                                                               │
│ Your existing files will NOT be modified.                     │
│                                                               │
│ Options for CLAUDE.md:                                        │
│ [Keep Existing] [Merge with SpecKit] [Replace]                │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 5: In-Progress Repository

**Indicators:**
- `.specify/` exists
- State file exists with orchestration data
- May be mid-workflow

**Sub-scenarios:**

| State | Handling |
|-------|----------|
| Interview in progress | Resume interview |
| Interview complete, no ROADMAP | Route to roadmap creation |
| Orchestration in progress | Resume at current step |
| All phases complete | Show completion, offer next actions |
| State corrupted | Offer repair options |
| State/files mismatch | Reconcile or choose source of truth |

**Current Behavior:**
- Routes based on state file
- No validation of state vs reality

**Gaps:**
- [ ] No validation that state matches file system
- [ ] No recovery from corrupted state
- [ ] No handling of manual file edits

**State/Reality Mismatches to Detect:**

```bash
# Task file says T001 complete, state says pending
# Branch state says "feat/003", git says "main"
# spec.md exists but state says "specify: pending"
# ROADMAP says phase 3 complete, state says in_progress
```

**Proposed Handling:**
```
┌─────────────────────────────────────────────────────────────┐
│ State Mismatch Detected                                       │
│                                                               │
│ Your state file and actual files don't match:                │
│                                                               │
│ Phase 003: Flow Engine                                        │
│ • State says: step=implement, tasks=5/15 complete             │
│ • tasks.md shows: 8/15 complete                               │
│ • Git branch: main (expected: feat/003-flow-engine)          │
│                                                               │
│ Options:                                                      │
│ [Trust Files] - Update state to match actual files            │
│ [Trust State] - Files may be out of sync                      │
│ [Show Diff] - See detailed comparison                         │
│ [Start Fresh] - Reset this phase (preserves completed work)   │
└─────────────────────────────────────────────────────────────┘
```

---

### Scenario 6: Other Documentation Framework in Use

**Indicators:**
- Has documentation in recognized patterns
- May have partial SpecKit setup
- May have their own CLAUDE.md

**Patterns to Detect:**

| Pattern | Framework | Integration Approach |
|---------|-----------|---------------------|
| `docs/` | Generic docs | Coexist, link from memory |
| `docs/adr/` or `ADR/` | Architecture Decision Records | Import to .specify/memory/adrs/ |
| `docs/rfcs/` | Request for Comments | Reference from specs |
| `wiki/` | Wiki-style docs | Link from memory docs |
| `.github/ISSUE_TEMPLATE/` | GitHub issues | Enhance, don't replace |
| `ARCHITECTURE.md` | Architecture doc | Reference in constitution |
| `CONTRIBUTING.md` | Contribution guide | Preserve, link from memory |
| `openapi.yaml` / `swagger.json` | API docs | Reference in api-standards.md |
| `Makefile` / `justfile` | Build automation | Preserve, integrate |

**Current Behavior:**
- Ignores existing documentation
- Could create confusion with duplicate docs

**Gaps:**
- [ ] No detection of other frameworks
- [ ] No integration path
- [ ] Could create conflicting documentation

**Proposed Handling:**
```
┌─────────────────────────────────────────────────────────────┐
│ Existing Documentation Detected                               │
│                                                               │
│ This project already has documentation:                       │
│                                                               │
│ 📁 docs/                                                      │
│ ├── architecture.md (3.2 KB)                                  │
│ ├── adr/ (5 decision records)                                 │
│ └── api/ (OpenAPI spec)                                       │
│                                                               │
│ 📄 ARCHITECTURE.md (1.8 KB)                                   │
│ 📄 CONTRIBUTING.md (2.1 KB)                                   │
│                                                               │
│ SpecKit can work alongside your existing docs:                │
│                                                               │
│ Integration options:                                          │
│ [Coexist] - Add SpecKit, link to existing docs                │
│ [Import ADRs] - Copy ADRs to .specify/memory/adrs/            │
│ [Full Integration] - Create references in memory docs         │
│ [Skip Detection] - Initialize without integration             │
└─────────────────────────────────────────────────────────────┘
```

---

## Detection Matrix

### System-Level Detection

| Check | Command | Good | Warning | Error |
|-------|---------|------|---------|-------|
| CLI installed | `which speckit` | Found in PATH | - | Not found |
| System dir | `ls ~/.claude/speckit-system` | Exists | - | Missing |
| VERSION file | `cat ~/.../VERSION` | Matches latest | Outdated | Missing |
| jq installed | `which jq` | Found | - | Missing |
| Scripts present | Check required scripts | All present | Some missing | Core missing |

### Project-Level Detection

| Check | Command | Good | Warning | Error |
|-------|---------|------|---------|-------|
| Git repo | `git rev-parse` | Is repo | - | Not repo |
| .specify/ | `ls .specify` | Exists | Partial | Missing |
| State file | `cat .specify/orchestration-state.json` | Valid JSON | Old version | Corrupt/missing |
| ROADMAP.md | Check exists & valid | Valid | Exists, invalid | Missing |
| CLAUDE.md | Check exists | Exists | - | Missing |

### State Validation

| Check | Method | Pass | Fail |
|-------|--------|------|------|
| JSON valid | `jq '.' file` | Parses | Syntax error |
| Version field | `.version` | "2.0" | Missing/old |
| Config section | `.config` | Present | Missing |
| Interview section | `.interview` | Present | Missing |
| Orchestration section | `.orchestration` | Present | Missing |
| Interview status | `.interview.status` | Valid enum | Invalid |
| Orchestration status | `.orchestration.status` | Valid enum | Invalid |

### Reality Check (State vs Files)

| State Says | Reality Check | Mismatch Action |
|------------|---------------|-----------------|
| Interview phase N | `.specify/discovery/state.md` progress | Sync or warn |
| Spec completed | `specs/NNN/spec.md` exists | Update state or warn |
| Tasks completed | Count `[x]` in tasks.md | Update state |
| Branch = X | `git branch --show-current` | Warn, offer switch |
| Phase complete | ROADMAP.md status | Sync bidirectionally |

---

## Healing Strategies

### Strategy 1: State Migration (v1.0 → v2.0)

```bash
# speckit state migrate
# 1. Backup current state
# 2. Extract data from v1.0 format
# 3. Map to v2.0 structure
# 4. Preserve all custom values
# 5. Add missing required sections with defaults
# 6. Validate result
# 7. Write new state file
```

**Data Preservation Rules:**
- Never delete existing data
- Move, don't overwrite
- Add missing fields with sensible defaults
- Preserve user-customized paths

### Strategy 2: State Repair

```bash
# speckit doctor --fix-state
# 1. Validate current JSON
# 2. If corrupt, try to extract valid portions
# 3. Merge with defaults for missing sections
# 4. Validate interview state against discovery/state.md
# 5. Validate orchestration against file system
# 6. Prompt for any unrecoverable conflicts
```

### Strategy 3: Reconciliation (State vs Reality)

```bash
# speckit reconcile
# 1. Compare state to file system
# 2. Show differences in interactive mode
# 3. Allow user to choose source of truth
# 4. Update chosen target to match
# 5. Log all changes to history
```

### Strategy 4: Safe Initialization

```bash
# speckit init --safe
# 1. Scan for existing documentation
# 2. Detect doc framework patterns
# 3. Detect existing CLAUDE.md
# 4. Present findings to user
# 5. Get explicit permission before any writes
# 6. Create new files only (never overwrite)
# 7. Offer integration for existing docs
```

### Strategy 5: Graceful Degradation

When CLI is unavailable:
- Commands should still work via Claude reading files directly
- Provide manual instructions as fallback
- Don't fail, just inform and suggest installation

---

## Implementation Plan

### Phase 1: Detection Infrastructure

- [ ] Add VERSION file to installation (`VERSION` containing e.g., "1.0.0")
- [ ] Add `speckit version` command to show installed version
- [ ] Add `speckit doctor --check version` for version validation
- [ ] Add `speckit doctor --check reality` for state/files comparison

### Phase 2: Existing Content Detection

- [ ] Add `speckit detect` command to scan for:
  - Existing CLAUDE.md
  - docs/ directory and patterns
  - ADR/RFC patterns
  - API documentation
  - Other spec formats
- [ ] Return detection results in structured format
- [ ] Update `speckit.start` to run detection before routing

### Phase 3: State Migration

- [ ] Add `speckit state migrate` command
- [ ] Implement v1.0 → v2.0 migration logic
- [ ] Add backup before migration
- [ ] Add rollback capability
- [ ] Update doctor to suggest migration when old version detected

### Phase 4: Reconciliation

- [ ] Add `speckit reconcile` command
- [ ] Implement state vs files comparison
- [ ] Add interactive mode for conflict resolution
- [ ] Add `--dry-run` flag to preview changes
- [ ] Update `speckit.start` to check for mismatches

### Phase 5: Safe Initialization

- [ ] Update `speckit scaffold` to detect existing content
- [ ] Add `--safe` flag for non-destructive mode
- [ ] Add merge logic for CLAUDE.md
- [ ] Add integration options for existing docs
- [ ] Update `speckit.init` to use safe mode by default

### Phase 6: Update speckit.start

- [ ] Add pre-flight checks (CLI, version, permissions)
- [ ] Add detection step before routing
- [ ] Add reconciliation check before continuing
- [ ] Add graceful fallback messages
- [ ] Update flowchart to show new checks

---

## Non-Destructive Principles

1. **Never overwrite without asking** - Always detect existing content first
2. **Always backup before migration** - Create `.specify/backup/` with timestamp
3. **Prefer merge over replace** - Add to existing files rather than replacing
4. **Show before modify** - Preview changes before applying
5. **Offer rollback** - Keep history of automated changes
6. **Fail gracefully** - Provide helpful messages, not cryptic errors
7. **Trust user content** - When in doubt, preserve what the user created
8. **Document changes** - Log all automated modifications
9. **Support coexistence** - Work alongside other tools, not against them
10. **Enable, don't require** - SpecKit features are additive, not mandatory

---

## Success Metrics

| Scenario | Success Criteria |
|----------|-----------------|
| New user | Clear install instructions, no confusing errors |
| Upgrade | Seamless migration, no data loss |
| New project | Safe init, existing content preserved |
| In-progress | Accurate state, smooth resume |
| Other framework | Coexistence, integration options |
| Corrupted state | Recovery possible, no data loss |
| CLI missing | Graceful fallback, manual instructions |

---

## Next Steps

1. Review this analysis with team
2. Prioritize which scenarios to address first
3. Implement detection infrastructure (Phase 1)
4. Add safe guards to existing commands
5. Create migration utilities
6. Update speckit.start with new checks
7. Test all scenarios end-to-end
