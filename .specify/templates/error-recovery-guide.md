# Error Recovery Guide

This guide defines standardized error handling patterns for all SpecFlow commands.

## Error Severity Levels

| Level | Meaning | User Interaction | State Update |
|-------|---------|------------------|--------------|
| **CRITICAL** | Cannot proceed, workflow blocked | HALT and report | `step.status=failed` |
| **RECOVERABLE** | Can retry or skip | Offer options | Keep `step.status=in_progress` |
| **WARNING** | Non-blocking issue | Log and continue | No state change |

## Standard Error Recovery Pattern

All commands should follow this pattern when encountering errors:

```
1. DETECT: Identify the error type and severity
2. LOG: Record error details for debugging
3. DECIDE: Based on severity:
   - CRITICAL → HALT
   - RECOVERABLE → Offer options
   - WARNING → Continue
4. RECOVER: Execute chosen recovery action
5. RESUME: Continue workflow or exit gracefully
```

## Recovery Options by Error Type

### Prerequisites Not Met

```markdown
| Error | Severity | Recovery |
|-------|----------|----------|
| constitution.md missing | CRITICAL | Run `/flow.init` |
| No active phase | CRITICAL | Run `specflow phase open` |
| Design gate failed | RECOVERABLE | Run `/flow.design` or skip with `--force` |
| Branch mismatch | RECOVERABLE | Checkout correct branch |
```

### State Errors

```markdown
| Error | Severity | Recovery |
|-------|----------|----------|
| State file corrupted | RECOVERABLE | Run `specflow check --fix` |
| Step out of sync | RECOVERABLE | Run `specflow status --json` to diagnose |
| Missing state fields | WARNING | Initialize with defaults |
```

### Artifact Errors

```markdown
| Error | Severity | Recovery |
|-------|----------|----------|
| spec.md missing | CRITICAL | Run `/flow.design` |
| tasks.md unparseable | RECOVERABLE | Fix format, re-run |
| Checklist malformed | WARNING | Regenerate with `/flow.design --checklist` |
```

### Git Errors

```markdown
| Error | Severity | Recovery |
|-------|----------|----------|
| Merge conflict | RECOVERABLE | Resolve manually, then continue |
| Push rejected | RECOVERABLE | Pull and rebase, then retry |
| Branch deleted | RECOVERABLE | Check ROADMAP, recreate or close phase |
```

## Standard State Updates on Error

When errors occur, update state appropriately:

```bash
# On CRITICAL error - halt workflow
specflow state set orchestration.step.status=failed
specflow state set orchestration.lastError="Description of error"

# On RECOVERABLE error - keep trying
# Don't change status, log error for debugging

# On WARNING - continue
# Don't change status, may log warning
```

## User Communication Pattern

Use consistent language when reporting errors:

```markdown
**CRITICAL Error**: [Brief description]

What happened: [Details of the error]
Why it matters: [Impact on workflow]
How to fix: [Specific recovery steps]

Recovery options:
1. [Option 1 - recommended]
2. [Option 2]
3. [Option 3 - abort]
```

## Error Recovery in Each Command

### /flow.design
- CRITICAL: No phase context → "Run `specflow phase open <number>` first"
- CRITICAL: Constitution violation → Block and report specific violation
- RECOVERABLE: Validation fails → Retry up to 3 times, then ask user

### /flow.analyze
- CRITICAL: Gate failed → "Run `/flow.design` first"
- RECOVERABLE: >50% agents fail → Abort with "Parallel scan failed"
- RECOVERABLE: Max iterations reached → Ask user to continue or abort

### /flow.implement
- CRITICAL: No tasks → "Run `/flow.design` first"
- RECOVERABLE: Task fails → Retry once, then mark blocked
- RECOVERABLE: Critical path blocked → Halt and report blockers

### /flow.verify
- CRITICAL: No implementation → "Run `/flow.implement` first"
- RECOVERABLE: Checklist item fails → Note failure, continue others
- RECOVERABLE: Constitution violation → Block verification

### /flow.merge
- CRITICAL: Not verified → "Run `/flow.verify` first"
- CRITICAL: On main branch → "Switch to feature branch"
- RECOVERABLE: Merge conflict → "Resolve manually"
- RECOVERABLE: Push fails → "Check network or credentials"

### /flow.review
- CRITICAL: No ROADMAP → "Run `/flow.roadmap` first"
- CRITICAL: No constitution → "Run `/flow.init` first"
- RECOVERABLE: Scan agent fails → Continue with other results
