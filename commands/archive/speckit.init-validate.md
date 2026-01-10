# Validate Interview

> **Note**: This command is deprecated. Use `/speckit.init validate` instead.
> This file is kept for backwards compatibility.

Check interview decisions for contradictions, gaps, and quality issues.

## Actions

1. Read `.specify/discovery/decisions.md` - all decisions
2. Read `.specify/discovery/context.md` - project type and constraints
3. Read `.specify/discovery/state.md` - phase progress
4. Read `~/.claude/speckit-system/QUESTION_CATEGORIES.md` - required phases

## Validation Checks

### 1. Contradiction Detection
Scan all decisions for conflicts:

| Pattern | Check |
|---------|-------|
| Scope vs Resources | "Simple" + "Complex architecture" |
| Timeline vs Quality | "Ship fast" + "Comprehensive testing" |
| Users Conflict | "Developers" + "Non-technical users" without segmentation |
| Tech Mismatch | Incompatible technology choices |
| Scale Mismatch | Small team + large scope |
| Principle Conflict | Constitution principles that contradict each other |

### 2. Coverage Gaps
Based on project type from context.md:
- List "Required" phases that are incomplete
- List critical questions not yet answered
- Flag phases marked "skipped" that might be needed

### 3. Memory Document Readiness
For each memory document:
- Count decisions that will feed into it
- Flag documents with < 3 relevant decisions as "insufficient"
- Identify documents ready for generation

### 4. Confidence Issues
- List all Low confidence decisions
- List all "Tentative" or "Needs-validation" decisions
- Suggest which need follow-up

### 5. Dependency Check
- Verify all decision dependencies are satisfied
- Flag circular dependencies
- Identify orphan decisions (no dependencies when expected)

### 6. SDD Principle Alignment
Check decisions against SDD best practices:
- Are principles testable and measurable?
- Is there a clear separation between "what" and "how"?
- Are there enough decisions to draft a constitution?

## Output Format

```markdown
## Interview Validation Report

### Contradictions Found: [N]
| ID | Decisions | Conflict | Suggested Resolution |
|----|-----------|----------|----------------------|
| C1 | D-5, D-12 | [Description] | [Suggestion] |

### Coverage Gaps: [N]
| Phase | Gap | Impact | Priority |
|-------|-----|--------|----------|
| Phase 4 | No security decisions | security-checklist.md empty | HIGH |

### Memory Document Readiness
| Document | Decisions | Status | Ready for Export? |
|----------|-----------|--------|-------------------|
| constitution.md | 12 | Sufficient | Yes |
| tech-stack.md | 3 | Minimal | Partial |
| security-checklist.md | 0 | Empty | No |

### Low Confidence Decisions: [N]
| ID | Title | Issue | Follow-up Question |
|----|-------|-------|-------------------|
| D-8 | [Title] | Low confidence | [Question to ask] |

### Quality Score: [X/10]
Based on:
- Coverage of required phases: [X]/12
- Decision confidence levels: [Y]% high confidence
- Contradictions resolved: [Z]/[total]
- Memory doc readiness: [W]/8 ready

### Recommendations
1. **[Priority 1]**: [Most important action]
2. **[Priority 2]**: [Second priority]
3. **[Priority 3]**: [Third priority]

### Next Steps
- [ ] Resolve [N] contradictions before export
- [ ] Add decisions for [empty memory docs]
- [ ] Validate [N] low-confidence decisions
```

If issues found, suggest specific questions to resolve them using AskUserQuestion.

## User Input

```text
$ARGUMENTS
```
