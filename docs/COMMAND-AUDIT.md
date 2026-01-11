# SpecKit Command Audit

> Updated during v2.0+ maintenance - reflects current command state

## CLI Commands (bin/speckit)

| Command | Script | Status | Notes |
|---------|--------|--------|-------|
| `state` | speckit-state.sh | ✅ Implemented | Full CRUD operations |
| `scaffold` | speckit-scaffold.sh | ✅ Implemented | Project structure creation |
| `context` | speckit-context.sh | ✅ Implemented | Project context (replaced check-prerequisites.sh) |
| `feature` | speckit-feature.sh | ✅ Implemented | Feature management |
| `git` | speckit-git.sh | ✅ Implemented | Branch, commit, merge, push |
| `roadmap` | speckit-roadmap.sh | ✅ Implemented | Status, update, insert, defer, restore, backlog |
| `claude-md` | speckit-claude-md.sh | ✅ Implemented | Update and sync |
| `checklist` | speckit-checklist.sh | ✅ Implemented | Status, list, incomplete |
| `tasks` | speckit-tasks.sh | ✅ Implemented | Mark, status, list |
| `templates` | speckit-templates.sh | ✅ Implemented | Check, update, diff |
| `doctor` | speckit-doctor.sh | ✅ Implemented | Diagnostics, auto-fix |
| `detect` | speckit-detect.sh | ✅ Implemented | Content detection |
| `reconcile` | speckit-reconcile.sh | ✅ Implemented | State/file sync |
| `memory` | speckit-memory.sh | ✅ Implemented | Memory document operations |
| `gate` | speckit-gate.sh | ✅ Implemented | Validation gates (specify, plan, tasks, implement) |
| `lessons` | speckit-lessons.sh | ✅ Implemented | Lessons learned tracking |
| `migrate` | speckit-migrate.sh | ✅ Implemented | ROADMAP format migration |
| `manifest` | speckit-manifest.sh | ✅ Implemented | Version manifest operations |

## Claude Commands (commands/*.md)

### Core Workflow
| Command | Purpose | Status |
|---------|---------|--------|
| `/speckit.start` | Smart entry point | ✅ Active |
| `/speckit.init` | Project initialization (unified interview) | ✅ Active |
| `/speckit.orchestrate` | Full workflow automation | ✅ Active |
| `/speckit.specify` | Create feature specification | ✅ Active |
| `/speckit.clarify` | Resolve specification ambiguities | ✅ Active |
| `/speckit.plan` | Create technical implementation plan | ✅ Active |
| `/speckit.tasks` | Generate actionable task list | ✅ Active |
| `/speckit.analyze` | Cross-artifact consistency check | ✅ Active |
| `/speckit.checklist` | Create verification checklist | ✅ Active |
| `/speckit.implement` | Execute all tasks | ✅ Active |
| `/speckit.verify` | Verify completion and update ROADMAP | ✅ Active |

### Phase Completion
| Command | Purpose | Status |
|---------|---------|--------|
| `/speckit.merge` | Complete phase: push, PR, merge, cleanup | ✅ Active |
| `/speckit.backlog` | Triage backlog items into phases | ✅ Active |

### Memory & Configuration
| Command | Purpose | Status |
|---------|---------|--------|
| `/speckit.constitution` | Create/update project constitution | ✅ Active |
| `/speckit.roadmap` | Create/update ROADMAP.md | ✅ Active |
| `/speckit.memory` | Verify and reconcile memory documents | ✅ Active |
| `/speckit.memory-init` | Generate memory docs from codebase analysis | ✅ Active |

### Utilities
| Command | Purpose | Status |
|---------|---------|--------|
| `/speckit.taskstoissues` | Convert tasks to GitHub issues | ✅ Active (utilities/) |

### Deleted (v2.1)
| Command | Reason | Replacement |
|---------|--------|-------------|
| `/speckit.issue` | CLI works directly | `speckit issue` CLI |

## Archived Commands

The following were consolidated into `/speckit.init` (v2.0):
- ~~`speckit.init-status`~~ → `/speckit.init status`
- ~~`speckit.init-skip`~~ → `/speckit.init skip`
- ~~`speckit.init-pause`~~ → `/speckit.init pause`
- ~~`speckit.init-validate`~~ → `/speckit.init validate`
- ~~`speckit.init-export`~~ → `/speckit.init export`
- ~~`speckit.init-compare`~~ → `/speckit.init compare`
- ~~`speckit.init-deeper`~~ → `/speckit.init deeper`
- ~~`speckit.init-faster`~~ → `/speckit.init faster`
- ~~`speckit.init-focus`~~ → `/speckit.init focus`
- ~~`speckit.init-research`~~ → `/speckit.init research`
- ~~`speckit.init-revisit`~~ → `/speckit.init revisit`

These files have been **deleted** from `commands/archive/` as of v2.0 cleanup.

## Scripts Library

### lib/common.sh
Provides:
- Logging: `log_info`, `log_error`, `log_warn`, `log_success`, `log_debug`, `log_step`
- Paths: `get_repo_root`, `get_specify_dir`, `get_state_file`, `get_speckit_system_dir`
- Validation: `is_git_repo`, `is_speckit_project`, `validate_context`, `validate_speckit_project`
- Utils: `command_exists`, `require_jq`, `ensure_dir`, `file_exists`
- Output: `print_header`, `print_section`, `print_status`, `is_json_output`

### lib/json.sh
Provides:
- JSON operations via jq wrappers
