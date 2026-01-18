# Discovery: Phase 0076 - Command Rebrand

## Codebase Examination Summary

### Files Requiring Rename

**Binary (1 file)**
- `bin/speckit` → `bin/specflow`

**Bash Scripts (25 files in scripts/bash/)**
- `speckit-*.sh` files → `specflow-*.sh`
- All contain internal references to `speckit`

**Command Files (20 files)**
- `commands/speckit.*.md` → `commands/flow.*.md`
- `commands/utilities/speckit.*.md` → `commands/utilities/flow.*.md`
- Internal references change from `/speckit.*` to `/flow.*`

### Files Requiring Content Updates

**Core Documentation (4 files)**
- `README.md` - Repository URL, CLI name, examples
- `CLAUDE.md` - All command references, binary name
- `install.sh` - Binary name, paths, URLs
- `VERSION` file (if branding mentioned)

**Docs Directory (9 files)**
- `docs/cli-reference.md` - Full CLI documentation
- `docs/commands-analysis.md` - Command analysis
- `docs/slash-commands.md` - Slash command reference
- `docs/configuration.md` - Config references
- `docs/integration-guide.md` - Integration docs
- `docs/project-structure.md` - Structure references
- `docs/templates.md` - Template docs
- `docs/troubleshooting.md` - Troubleshooting guides
- `docs/COMMAND-AUDIT.md` - Audit document

**Memory Documents (5 files in .specify/memory/)**
- `constitution.md` - CLI references
- `coding-standards.md` - Naming conventions
- `glossary.md` - Command glossary
- `tech-stack.md` - May have references
- `testing-strategy.md` - Test command references

**Library Files (4 files in scripts/bash/lib/)**
- `common.sh` - Function names, paths, messages
- `json.sh` - Any references
- `detection.sh` - Detection logic
- Other lib files

**Templates (unknown count in templates/)**
- May contain speckit references

### Reference Counts

| Location | File Count | Approximate References |
|----------|------------|----------------------|
| Bash scripts | 44 | Many |
| Markdown files | 157 | Many |
| Binary | 1 | ~23 |
| Total estimated | 200+ | 1000+ |

### Naming Changes Summary

| Old | New |
|-----|-----|
| `speckit` (CLI) | `specflow` |
| `speckit-system` (install dir) | `specflow-system` |
| `/speckit.*` (slash commands) | `/flow.*` |
| `speckit-*.sh` (scripts) | `specflow-*.sh` |
| `~/.speckit/` (user dir) | `~/.specflow/` |
| `SPECKIT_*` (env vars) | `SPECFLOW_*` |

### Command Mapping (10 Active Commands)

| Old Name | New Name |
|----------|----------|
| `/speckit.init` | `/flow.init` |
| `/speckit.memory` | `/flow.memory` |
| `/speckit.roadmap` | `/flow.roadmap` |
| `/speckit.orchestrate` | `/flow.orchestrate` |
| `/speckit.design` | `/flow.design` |
| `/speckit.analyze` | `/flow.analyze` |
| `/speckit.implement` | `/flow.implement` |
| `/speckit.verify` | `/flow.verify` |
| `/flow.merge` | `/flow.merge` |
| `/speckit.review` | `/flow.review` |

### Deprecated Commands (Still Need Stubs)

Per phase PDR, we're doing a **clean break with no deprecation stubs**. However, these deprecated commands exist:
- `/speckit.start`
- `/speckit.constitution`
- `/speckit.phase`
- `/speckit.specify`
- `/speckit.clarify`
- `/speckit.plan`
- `/speckit.tasks`
- `/speckit.checklist`
- `/speckit.backlog`

**Decision needed**: Delete these entirely or convert to `/flow.*` deprecation stubs?

### GitHub Repository

Current: `wiseyoda/claude-speckit-orchestration`
Target: `wiseyoda/specflow` (or similar)

### Confirmed Decisions

1. **Repository name**: `specflow` (short and clean)
2. **Deprecated commands**: Clean delete (no stubs, no backwards compatibility)
3. **User directory**: `~/.specflow/` (clean break, fresh installation)
4. **Environment variables**: Rename `SPECKIT_*` → `SPECFLOW_*` (consistent branding)
5. **Order of operations**: Files first, repository rename last
6. **Project directory**: Keep `.specify/` (specification artifacts, not tool branding - no migration needed)

## Implementation Approach (Initial)

1. Create new command files (`flow.*.md`) with updated content
2. Rename bash scripts to `specflow-*.sh`
3. Update `bin/speckit` → `bin/specflow`
4. Update `install.sh` with new paths
5. Update all documentation
6. Delete old `speckit.*` files
7. Rename GitHub repository (last)

## Risks

- Breaking existing installations (users have `speckit` in PATH)
- GitHub URLs change breaking documentation links
- Migration path for existing users unclear
