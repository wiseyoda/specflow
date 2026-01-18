# Command Mapping: Bash → TypeScript

## CLI Commands

### Keep (Migrate to TypeScript)

| Current Command | New Command | Notes |
|-----------------|-------------|-------|
| `specflow state` | `specflow state` | Core, migrate first |
| `specflow tasks` | `specflow tasks` | High usage |
| `specflow roadmap` | `specflow roadmap` | High usage |
| `specflow doctor` | `specflow doctor` | Health checks |
| `specflow phase` | `specflow phase` | Phase details |
| `specflow checklist` | `specflow checklist` | Verification |
| `specflow context` | `specflow context` | Current context |
| `specflow status` | `specflow status` | Summary view |

### Merge/Consolidate

| Current Commands | New Command | Reason |
|------------------|-------------|--------|
| `specflow detect` | `specflow status --detect` | Overlapping functionality |
| `specflow reconcile` | `specflow state reconcile` | Same domain |
| `specflow manifest` | `specflow templates --manifest` | Both handle versions |

### Delete (Rarely Used)

| Command | Reason | Alternative |
|---------|--------|-------------|
| `specflow claude-md` | Low usage, manual is fine | Edit CLAUDE.md directly |
| `specflow migrate` | One-time use, complete | N/A |
| `specflow import` | Rarely used | Manual import |

### Keep as Bash (Simple Wrappers)

| Command | Reason |
|---------|--------|
| `specflow git` | Just wraps git commands |
| `specflow scaffold` | One-time project setup |
| `specflow dashboard` | Just launches dashboard |

### Undecided

| Command | Usage | Decision Needed |
|---------|-------|-----------------|
| `specflow pdr` | Moderate | Keep separate or merge into roadmap? |
| `specflow issue` | Moderate | Keep separate or merge into phase? |
| `specflow lessons` | Low-moderate | Keep or merge into state? |
| `specflow gate` | Low | Keep or inline in orchestrate? |
| `specflow memory` | Low | Keep or merge into init? |
| `specflow templates` | Moderate | Keep separate |
| `specflow feature` | Low | Keep or merge into phase? |

---

## Slash Commands

### Keep (Active Workflow)

| Command | Purpose | Changes |
|---------|---------|---------|
| `/flow.orchestrate` | Main workflow | Update CLI calls to TS |
| `/flow.design` | Design artifacts | No changes |
| `/flow.implement` | Task execution | No changes |
| `/flow.verify` | Verification | No changes |
| `/flow.merge` | Phase completion | No changes |
| `/flow.init` | Project setup | No changes |

### Keep (Utilities)

| Command | Purpose | Changes |
|---------|---------|---------|
| `/flow.roadmap` | Roadmap ops | No changes |
| `/flow.memory` | Memory docs | No changes |
| `/flow.review` | Code review | No changes |

### Delete (Deprecated Stubs)

| Command | Redirect To | Action |
|---------|-------------|--------|
| `/flow.start` | `/flow.orchestrate` | Delete |
| `/flow.specify` | `/flow.design` | Delete |
| `/flow.clarify` | `/flow.design` | Delete |
| `/flow.plan` | `/flow.design --plan` | Delete |
| `/flow.tasks` | `/flow.design --tasks` | Delete |
| `/flow.checklist` | `/flow.design --checklist` | Delete |
| `/flow.constitution` | `/flow.init` | Delete |
| `/flow.phase` | `/flow.roadmap add-pdr` | Delete |
| `/flow.backlog` | `/flow.roadmap backlog` | Delete |

---

## Final Command Count

### Before Migration

| Category | Count |
|----------|-------|
| CLI scripts | 24 |
| Active slash commands | 9 |
| Deprecated slash commands | 9 |
| **Total** | **42** |

### After Migration

| Category | Count |
|----------|-------|
| TypeScript commands | 8-10 |
| Bash wrappers | 2-3 |
| Slash commands | 9 |
| **Total** | **~20** |

**Reduction: 50%+**

---

## State Schema Changes

### Fields to Remove

```diff
{
  "orchestration": {
    "step": {
      "current": "implement",
-     "index": 2,                    // Remove: derive from current
      "status": "in_progress"
    },
-   "progress": {                    // Remove: compute from tasks.md
-     "tasks_completed": 25,
-     "tasks_total": 42,
-     "percentage": 59.5
-   },
-   "steps": {                       // Remove: redundant
-     "implement": {
-       "tasks_completed": 25,
-       "tasks_total": 25
-     }
-   },
-   "design": {                      // Remove: infer from artifacts
-     "substep": "complete"
-   }
  }
}
```

### Simplified Schema

```json
{
  "schema_version": "3.0",
  "project": {
    "id": "uuid",
    "name": "string",
    "path": "string"
  },
  "orchestration": {
    "phase": {
      "number": "0076",
      "name": "phase-name",
      "branch": "branch-name",
      "status": "in_progress"
    },
    "step": {
      "current": "design|analyze|implement|verify",
      "status": "not_started|in_progress|completed|blocked|failed"
    }
  },
  "health": {
    "status": "ready|warning|error",
    "issues": []
  }
}
```

**Fields reduced: 25+ → 12**
