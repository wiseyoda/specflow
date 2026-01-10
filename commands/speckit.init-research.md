# Research Topic for Interview

> **Note**: This command is deprecated. Use `/speckit.init research` instead.
> This file is kept for backwards compatibility.

Use the Explore agent to research a topic relevant to interview decisions.

## Arguments
$ARGUMENTS - Topic to research (e.g., "error handling patterns", "authentication approaches")

## Actions

1. Read `.specify/discovery/context.md` to understand project type and constraints
2. Use Task tool with subagent_type="Explore" to research "$ARGUMENTS"
3. Focus research on:
   - Patterns in existing codebase (if any)
   - Best practices for the project type
   - Common approaches and trade-offs
   - Relevant examples

## Research Prompt for Explore Agent

```
Research "$ARGUMENTS" in the context of this project:
- Project type: [from context.md]
- Constraints: [from context.md]

Find:
1. Existing patterns in this codebase related to this topic
2. Best practices for this project type
3. Common approaches with pros/cons
4. Code examples if available

Return findings organized as:
- Current state (what exists)
- Options (approaches to consider)
- Recommendation (based on project context)
```

## Output Format

```markdown
## Research: $ARGUMENTS

### Context
[Project type and relevant constraints]

### Findings

#### Current State
[What exists in codebase, if anything]

#### Options

**Option A: [Name]**
- Description: [...]
- Pros: [...]
- Cons: [...]
- Fits project because: [...]
- Memory Doc Impact: [Which docs this affects]

**Option B: [Name]**
- Description: [...]
- Pros: [...]
- Cons: [...]
- Fits project because: [...]
- Memory Doc Impact: [Which docs this affects]

#### Recommendation
Based on [project constraints], recommend [option] because [rationale].

### Questions to Consider
[Questions to ask in next interview round]

### Decision Template
If you'd like to capture this as a decision:
\`\`\`markdown
#### D-N: [Topic] Approach
- **Phase**: [Current phase]
- **Status**: Tentative
- **Confidence**: [Based on research]
- **Context**: [From research]
- **Decision**: [Recommended option]
- **Alternatives**: [Other options considered]
- **Memory Doc Impact**: [Affected documents]
\`\`\`
```

After research, offer to add a decision based on findings or ask follow-up questions.

## User Input

```text
$ARGUMENTS
```
