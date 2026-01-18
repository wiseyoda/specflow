# Implementation Plan: Pre-Workflow Commands Consolidation

**Phase**: 0070-preworkflow-consolidation
**Created**: 2026-01-17
**Status**: In Progress

---

## Technical Context

### Affected Files

| Category | Files | Changes |
|----------|-------|---------|
| Create/Major Edit | `commands/specflow.init.md` | Expand with constitution, memory, roadmap generation |
| Create/Major Edit | `commands/specflow.roadmap.md` | Add `add-pdr` subcommand routing |
| Reduce | `commands/specflow.memory.md` | Remove `generate` subcommand section |
| Replace with Stub | `commands/specflow.start.md` | Deprecation stub → `/specflow.orchestrate` |
| Replace with Stub | `commands/specflow.constitution.md` | Deprecation stub → `/specflow.init` |
| Replace with Stub | `commands/specflow.phase.md` | Deprecation stub → `/specflow.roadmap add-pdr` |
| Delete | `commands/specflow.memory-init.md` | Remove entirely |
| Update | `CLAUDE.md` | Update command documentation |
| Update | `docs/commands-analysis.md` | Update command inventory |

### Constitution Compliance Check

| Principle | Compliance |
|-----------|------------|
| I. Developer Experience First | ✅ Consolidation reduces confusion, single entry point |
| II. POSIX-Compliant Bash | ✅ No bash changes, only markdown command files |
| III. CLI Over Direct Edits | ✅ Init will use CLI commands internally |
| IV. Simplicity Over Cleverness | ✅ Fewer commands = simpler mental model |
| V. Helpful Error Messages | ✅ Deprecation stubs guide to new commands |
| VI. Graceful Degradation | ✅ Init skips completed steps, continues |
| VII. Three-Line Output Rule | ✅ N/A for slash commands (markdown files) |

---

## Implementation Approach

### Phase 1: Create Deprecation Stubs (Low Risk)

Replace existing complex commands with minimal stubs that show deprecation notices. This is safe because:
- No functionality is removed yet (just hidden)
- Users get clear guidance to new commands
- Can be done incrementally

**Order**:
1. `/specflow.memory-init` - Delete (already deprecated)
2. `/specflow.start` - Replace with stub
3. `/specflow.constitution` - Replace with stub
4. `/specflow.phase` - Replace with stub (save logic for later)

### Phase 2: Expand `/specflow.init` (Medium Risk)

Add the consolidated setup flow. This requires careful integration of:
- Existing interview flow (preserve)
- Constitution generation (from `/specflow.constitution`)
- Memory document generation (from memory generate)
- Roadmap creation (from `/specflow.roadmap`)

**Key Design Decisions**:

1. **Smart Idempotency**: Check for completion, not just file existence
   - Look for template placeholders: `[PROJECT_NAME]`, `[PRINCIPLE_1]`, etc.
   - Check for required sections being populated
   - If file exists but appears incomplete → regenerate

2. **Step-by-Step Flow**:
   ```
   /specflow.init
   ├── 0. Pre-flight checks (create .specify/ if needed)
   ├── 1. Discovery Interview (if not complete)
   ├── 2. Constitution Generation (if not complete)
   ├── 3. Memory Document Generation (if not complete)
   └── 4. Roadmap Creation (if not exists)
   ```

3. **Abort on Active Phase**: If orchestration is in progress, warn and abort

### Phase 3: Reduce `/specflow.memory` (Low Risk)

Remove the `generate` subcommand section and update documentation.
- Keep: verify, reconcile, promote
- Remove: generate subcommand section (~50 lines)
- Add: Helpful message if user tries `generate`

### Phase 4: Expand `/specflow.roadmap` (Medium Risk)

Add `add-pdr` as a subcommand:
- Move logic from `/specflow.phase` into `/specflow.roadmap`
- Update argument routing table
- Preserve existing roadmap create/update behavior

### Phase 5: Update Documentation (Low Risk)

- Update CLAUDE.md command section
- Update docs/commands-analysis.md
- Search for and update references to deprecated commands

---

## File Modification Details

### Deprecation Stub Template

```markdown
---
description: DEPRECATED - Use [NEW_COMMAND] instead
---

## DEPRECATED

This command has been consolidated into `[NEW_COMMAND]`.

**Reason**: [Brief explanation of consolidation]

**Migration**:
\`\`\`
# OLD (deprecated)
/specflow.[OLD_COMMAND]

# NEW (use this)
[NEW_COMMAND_USAGE]
\`\`\`

For more information, run `/specflow.help` or see the documentation.
```

### Init Flow Implementation

The expanded init needs to:

1. **Check Prerequisites**
   - Run `specflow scaffold --status` to check/create project structure
   - Check if orchestration is in progress → abort if so

2. **Discovery Interview Step**
   - Check `.specify/discovery/state.md` for completion status
   - If incomplete or missing → run interview
   - If complete → skip with "Discovery complete, skipping..."

3. **Constitution Step**
   - Check `.specify/memory/constitution.md` for completion
   - Detection: Look for `[PROJECT_NAME]` or `[PRINCIPLE` placeholders
   - If incomplete → generate from discovery decisions
   - If complete → skip with "Constitution exists, skipping..."

4. **Memory Documents Step**
   - Check `.specify/memory/tech-stack.md` and other docs
   - Detection: Look for placeholder patterns
   - If missing or incomplete → generate from constitution/discovery
   - If complete → skip with "Memory documents exist, skipping..."

5. **Roadmap Step**
   - Check `ROADMAP.md` exists and is valid
   - If missing → run roadmap creation flow
   - If exists → skip with "ROADMAP exists, skipping..."

### Roadmap add-pdr Implementation

Move the `/specflow.phase` logic into `/specflow.roadmap` as a subcommand:

```markdown
## Argument Routing

| Argument | Action |
|----------|--------|
| (empty) | Default roadmap create/update |
| `[description]` | Create roadmap from description |
| `add-pdr` | List available PDRs for conversion |
| `add-pdr [filename]` | Convert specific PDR to phase |
| `--force` | Regenerate even if exists |
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Deprecation stubs provide clear guidance |
| Init regenerating completed work | Smart idempotency with completion detection |
| Lost functionality | Phase logic preserved in roadmap add-pdr |
| Documentation drift | Update docs in same PR |

---

## Testing Strategy

### Manual Testing Steps

1. **Fresh project test**: Run `/specflow.init` on empty directory
   - Verify all artifacts created
   - Verify ready for `/specflow.orchestrate`

2. **Partial project test**: Run `/specflow.init` on project with only constitution
   - Verify constitution preserved
   - Verify memory/roadmap created

3. **Deprecated command test**: Run each deprecated command
   - Verify deprecation notice shown
   - Verify correct replacement command suggested

4. **add-pdr test**: Create PDR, run `/specflow.roadmap add-pdr`
   - Verify PDR listed
   - Verify phase added to ROADMAP.md

---

## Dependencies

### Existing CLI Commands Used

```bash
specflow scaffold          # Create project structure
specflow scaffold --status # Check project structure
specflow state get/set     # State management
specflow doctor            # Project health checks
specflow roadmap validate  # Validate ROADMAP.md
specflow roadmap status    # Get phase statuses
specflow pdr list          # List PDRs
specflow pdr show          # Show PDR details
specflow pdr mark          # Mark PDR as processed
```

---

## Deliverables

| Deliverable | File | Description |
|-------------|------|-------------|
| Deprecation stub | `commands/specflow.start.md` | Points to `/specflow.orchestrate` |
| Deprecation stub | `commands/specflow.constitution.md` | Points to `/specflow.init` |
| Deprecation stub | `commands/specflow.phase.md` | Points to `/specflow.roadmap add-pdr` |
| Deleted file | `commands/specflow.memory-init.md` | Removed |
| Expanded init | `commands/specflow.init.md` | Full setup flow |
| Reduced memory | `commands/specflow.memory.md` | Without generate |
| Expanded roadmap | `commands/specflow.roadmap.md` | With add-pdr |
| Updated docs | `CLAUDE.md` | New command structure |
| Updated docs | `docs/commands-analysis.md` | New command inventory |
