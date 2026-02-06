---
description: Diagnose and migrate SpecFlow projects. Detects version, runs intelligent analysis, and guides through migration from v1.0/v2.0 to v3.0.
handoffs:
  - label: Run Upgrade
    agent: bash
    prompt: specflow upgrade
  - label: Initialize New Project
    agent: specflow.init
    prompt: Initialize this project with SpecFlow
  - label: Check Health
    agent: bash
    prompt: specflow check
---

## User Input

```text
$ARGUMENTS
```

Arguments:
- Empty: Run diagnostics only (detect version, health check)
- `migrate`: Run full migration with intelligent analysis
- `--dry-run`: Preview migration without changes

You **MUST** consider the user input before proceeding (if not empty).

## Agent Teams Mode (Opus 4.6)

- This command is primarily sequential; use Agent Teams only for optional parallel deep analysis during migration.
- If parallel work is introduced, prefer Agent Teams when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, then fall back to Task agents.
- Preserve existing safety constraints (unique write targets, synchronization barrier, timeout, and failure thresholds).

## Goal

Diagnose SpecFlow project state and optionally guide through migration:

1. Detect current version (v1.0, v2.0, v3.0, or uninitialized)
2. Analyze project health and compliance
3. If migrating: run CLI upgrade + intelligent analysis
4. Generate actionable migration guide with findings

---

## Step 1: Detect Project Version

Run version detection:

```bash
specflow upgrade --dry-run --json
```

Parse the JSON to understand:
- `detection.version`: Current version (v1.0, v2.0, v3.0, uninitialized)
- `detection.confidence`: How certain we are (high, medium, low)
- `detection.indicators`: What signals were found

### Handle Special Cases

**If uninitialized:**
```
No SDD artifacts found in this repository.

This project has not been initialized with SpecFlow.

Would you like to:
1. Initialize as a new SpecFlow project → Run /flow.init
2. Exit and initialize manually
```

Use AskUserQuestion to get user choice.

**If already v3.0:**
```
This project is already at SpecFlow v3.0.

Run `specflow check` to validate project health.
```

Stop unless `migrate` was specified (to re-run analysis).

---

## Step 2: Show Version Analysis

Display current state:

```markdown
# Project Diagnosis

## Version Detection

| Property | Value |
|----------|-------|
| Current Version | {version} |
| Confidence | {confidence} |
| Target Version | v3.0 |

## Indicators Found

{list indicators}

## Required Migration Steps

{list steps from getMigrationSteps()}
```

If just running diagnostics (no `migrate` argument), show this and ask:
- "Run full migration?" → Proceed to Step 3
- "Exit" → Stop

---

## Step 3: Run CLI Upgrade

If migrating, run the CLI upgrade command:

```bash
specflow upgrade --json
```

Parse results:
- `actions.scaffolding`: Directories created/existing
- `actions.manifest`: Manifest migration result
- `actions.state`: State file migration result
- `actions.templates`: Templates synced
- `actions.rewrites`: Command references updated
- `actions.legacyRemoved`: Legacy scripts backed up
- `errors`: Any errors during upgrade

Display progress:

```markdown
## CLI Upgrade Complete

### Scaffolding
{list created directories}

### Schema Migration
- Manifest: {action} - {details}
- State: {action} - {details}

### Templates
- Synced: {count} files

### Command References
- Updated: {replacements} references in {files} files

### Legacy Cleanup
{list backed up items}
```

---

## Step 4: Intelligent Analysis

Now perform Claude-powered analysis that the CLI cannot do:

### 4a. ROADMAP.md Analysis

Read ROADMAP.md and analyze:

1. **Phase Status Accuracy**
   - Are completed phases actually complete?
   - Do in-progress phases have the correct step?
   - Are phase numbers following ABBC convention?

2. **USER GATE Compliance**
   - Are USER GATE phases properly marked?
   - Do they have verification criteria?

3. **Phase Organization**
   - Are phases logically sequenced?
   - Are milestones clear?

**Report findings:**
```markdown
### ROADMAP Analysis

| Check | Status | Finding |
|-------|--------|---------|
| Phase numbering | PASS/WARN | {details} |
| Status accuracy | PASS/WARN | {details} |
| USER GATES | PASS/WARN | {details} |
| Milestone clarity | PASS/WARN | {details} |
```

### 4b. Memory Document Analysis

Check `.specify/memory/` for:

1. **Constitution Completeness**
   - Has core principles defined?
   - Has governance section?
   - No placeholder text (TODO, TBD, ???)?

2. **Tech Stack Documentation**
   - tech-stack.md exists?
   - Lists approved technologies?
   - Has version constraints?

3. **Required Documents**
   - constitution.md (required)
   - coding-standards.md (recommended)
   - tech-stack.md (recommended)

**Report findings:**
```markdown
### Memory Documents

| Document | Status | Finding |
|----------|--------|---------|
| constitution.md | PASS/WARN/MISSING | {details} |
| tech-stack.md | PASS/WARN/MISSING | {details} |
| coding-standards.md | PASS/WARN/MISSING | {details} |
```

### 4c. Artifact Compliance

For active phase (if any), check artifacts:

1. **Design Artifacts**
   - spec.md format correct?
   - plan.md has phases?
   - tasks.md has proper structure?

2. **Checklist Compliance**
   - checklists/implementation.md exists?
   - checklists/verification.md exists?
   - Items use correct prefixes (I-, V-)?

### 4d. Remaining References Check

Search for any remaining v2.0 references not caught by CLI:

```bash
grep -r "speckit" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v ".git"
```

Report any missed references.

---

## Step 5: Update Migration Guide

Read the existing migration guide:

```bash
cat .specify/specflow-migration-guide.md
```

Append intelligent analysis findings:

```markdown
## Intelligent Analysis (Added by /flow.doctor)

### ROADMAP Analysis
{findings from 4a}

### Memory Document Analysis
{findings from 4b}

### Artifact Compliance
{findings from 4c}

### Remaining References
{findings from 4d}

### Claude Recommendations

Based on my analysis, here are prioritized recommendations:

1. **High Priority**
   - {specific action items}

2. **Medium Priority**
   - {specific action items}

3. **Low Priority**
   - {specific action items}
```

Write updated guide back to file.

---

## Step 6: Interactive Walkthrough

Ask user if they want to walk through the guide:

Use AskUserQuestion:
```
Migration guide has been updated with my analysis.

Would you like me to walk through the manual actions?
```

Options:
- **Yes, help me complete them** → Proceed to Step 7
- **No, I'll review later** → Show summary and exit
- **Show me the guide** → Display guide contents

---

## Step 7: Guided Completion

If user wants help, work through each manual action:

### For each high-priority item:

1. **Read the item** from the guide
2. **Check current state** - Is it already done?
3. **If not done**, offer to help:
   - Can I fix this automatically? → Fix it
   - Needs user input? → Ask via AskUserQuestion
   - Cannot be automated? → Explain what user needs to do

4. **Mark as complete** in the guide when done

### Example flow:

```
Manual Action: Review ROADMAP.md for accurate phase statuses

Let me check the current ROADMAP.md...

[Reads and analyzes ROADMAP.md]

I found 2 issues:
1. Phase 0140 marked complete but tasks.md shows 3 incomplete
2. Phase 0151 missing USER GATE marker mentioned in phase file

Would you like me to:
1. Fix the phase status in ROADMAP.md
2. Skip this and continue
3. Stop and let you handle manually
```

---

## Step 8: Final Verification

After completing manual actions:

```bash
specflow check --json
```

Report final status:

```markdown
# Migration Complete

## Final Verification

| Gate | Status |
|------|--------|
| Design | {status} |
| Implement | {status} |
| Verify | {status} |
| Memory | {status} |

## Summary

- Version: v3.0
- Schema: 3.0
- Templates: Synced
- Memory: {status}
- Remaining issues: {count}

## Next Steps

{recommendations based on final state}
```

---

## Operating Principles

### Intelligent Analysis

- **Be thorough**: The CLI handles mechanics; you handle judgment
- **Be specific**: Cite exact files, line numbers, issues
- **Be actionable**: Every finding should have a clear fix
- **Be helpful**: Offer to fix what you can

### Version-Specific Handling

**For v1.0 repos:**
- May need to create ROADMAP.md from scratch
- Constitution likely exists but may need reformatting
- No state file to preserve

**For v2.0 repos:**
- Rich existing artifacts to preserve
- Focus on command reference updates
- State file should migrate cleanly

### Context Efficiency

- Use CLI commands for structured data
- Read files directly for content analysis
- Summarize rather than dump large files
- Ask before making significant changes

### User Communication

- Explain what you're doing at each step
- Offer choices when there are multiple valid approaches
- Show progress for long operations
- Confirm before destructive actions

## Context

$ARGUMENTS
