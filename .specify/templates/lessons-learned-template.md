---
version: '1.0'
description: 'Accumulated knowledge from implementation - check before making decisions'
---

# Lessons Learned

> **Purpose**: Capture errors, decisions, and gotchas during implementation. Agents SHOULD check this file before starting tasks to avoid repeating mistakes.

**Feature**: [FEATURE NAME]
**Created**: [DATE]
**Last Updated**: [DATE]

---

## Error Patterns

> Document errors encountered and how they were resolved. Check here before debugging.

<!--
### [YYYY-MM-DD] Error: [Brief description]

**Context**: What we were doing when this occurred
**Symptoms**: How the error manifested
**Root Cause**: Why it happened
**Fix**: How we resolved it
**Prevention**: How to avoid in future

```
[Error message or stack trace if helpful]
```
-->

---

## Architecture Decisions

> Record significant technical decisions made during implementation.

<!--
### [YYYY-MM-DD] Decision: [Brief description]

**Context**: Why we needed to make this decision
**Options Considered**:
1. Option A - [pros/cons]
2. Option B - [pros/cons]

**Chosen**: Option [X] because [rationale]
**Outcome**: [How it worked out, any regrets]
-->

---

## Technology Gotchas

> Quick reference for technology-specific issues and workarounds.

| Technology | Gotcha | Workaround |
|------------|--------|------------|
| [e.g., React] | [Issue description] | [Solution] |

<!--
Examples:
| macOS sed | Doesn't support -i without backup | Use sed -i '' or use temp file |
| Bash 3.x | No associative arrays (declare -A) | Use indexed arrays or temp files |
| jq | Fails silently on invalid JSON | Add error handling: jq '.' || exit 1 |
-->

---

## Performance Notes

> Observations about performance, optimization attempts, and results.

<!--
### [YYYY-MM-DD] Optimization: [What was optimized]

**Before**: [Metric/observation]
**After**: [Metric/observation]
**How**: [What was changed]
**Worth It**: Yes/No - [Why]
-->

---

## Testing Insights

> Lessons learned about testing this feature.

<!--
- [Test type] revealed [insight]
- Edge case discovered: [description]
- Flaky test pattern: [cause and fix]
-->

---

## Integration Notes

> Issues encountered when integrating with other systems/features.

<!--
- Integration with [system]: [issue and resolution]
- API compatibility: [notes]
- Data migration: [notes]
-->

---

## Quick Reference

> Frequently needed commands, endpoints, or configurations for this feature.

```bash
# [Command description]
# [command]
```

---

## Future Improvements

> Ideas for improvements that weren't implemented but should be considered.

- [ ] [Improvement idea]

---

## Memory Promotion Markers

Use these markers to flag content for promotion to permanent memory documents:

| Marker | Purpose | Example |
|--------|---------|---------|
| `[PROMOTE]` | Flag content for memory promotion | `[PROMOTE] Always check for null before accessing .length` |
| `[MEMORY]` | Same as PROMOTE | `[MEMORY] This gotcha applies to all bash scripts` |

**Good candidates for promotion**:
- Error patterns that apply beyond this phase (e.g., "always validate input X")
- Architecture decisions that should become project standards
- Technology gotchas that affect the entire codebase
- Performance insights that inform future work

**What happens**: During `/flow.memory --archive`, marked content is presented for review and can be promoted to constitution.md, coding-standards.md, or tech-stack.md.

---

## Usage Instructions

This file should be:
1. **Checked BEFORE starting implementation tasks** - Agents should scan for relevant entries
2. **Updated AFTER encountering issues** - Add entries when problems are solved
3. **Reviewed at phase completion** - During `/flow.verify`, add any new learnings
4. **Scanned for [PROMOTE] markers** - During `/flow.memory --archive`, promote learnings to memory docs

### Adding Entries

```bash
# CLI command (if available)
specflow lessons add --type error "Brief description"
specflow lessons add --type decision "Brief description"
specflow lessons add --type gotcha "Technology" "Issue" "Workaround"

# Or manually edit this file
```

### Searching Entries

```bash
# CLI command (if available)
specflow lessons check "keyword"

# Or use grep
grep -i "keyword" lessons-learned.md
```
