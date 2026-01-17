# Data Model: Core UI Scaffold

**Phase**: 1010
**Date**: 2026-01-17

---

## Overview

The dashboard reads from existing SpecKit data files. No new storage is introduced in this phase.

---

## Data Sources

### 1. Registry (`~/.speckit/registry.json`)

Central project registry maintained by SpecKit CLI.

**Schema**:
```typescript
// packages/shared/src/schemas/registry.ts
import { z } from 'zod';

export const ProjectSchema = z.object({
  path: z.string().describe('Absolute path to project directory'),
  name: z.string().describe('Project display name'),
  registered_at: z.string().datetime().describe('ISO 8601 registration timestamp'),
  last_seen: z.string().datetime().optional().describe('ISO 8601 last access timestamp'),
});

export const RegistrySchema = z.object({
  projects: z.record(
    z.string().uuid().describe('Project UUID'),
    ProjectSchema
  ),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
```

**Example**:
```json
{
  "projects": {
    "9234cca2-5b60-48dd-9864-76dc8dba77f7": {
      "path": "/Users/dev/my-project",
      "name": "my-project",
      "registered_at": "2026-01-10T22:31:20Z",
      "last_seen": "2026-01-17T10:00:00Z"
    }
  }
}
```

---

### 2. Orchestration State (`.specify/orchestration-state.json`)

Per-project state file. Read-only for dashboard (this phase).

**Relevant fields for display**:
```typescript
export const OrchestrationStateSchema = z.object({
  schema_version: z.string(),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    path: z.string(),
  }),
  orchestration: z.object({
    phase: z.object({
      number: z.string().nullable(),
      name: z.string().nullable(),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']).nullable(),
    }),
    step: z.object({
      current: z.string().nullable(),
      index: z.number().nullable(),
      status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'failed']).nullable(),
    }),
  }),
});
```

---

## Client-Side State

### Theme Preference

**Storage**: `localStorage`
**Key**: `speckit-dashboard-theme`
**Values**: `"light"` | `"dark"` | `"system"`

Managed by `next-themes` library.

---

### Expanded Projects

**Storage**: React state (not persisted)
**Type**: `Set<string>` (project UUIDs)

Which projects are currently expanded in the list view.

---

## API Responses

### GET /api/projects

**Success Response**:
```typescript
interface ProjectsResponse {
  projects: Array<[string, Project]>;  // [uuid, project]
  empty?: boolean;  // true if registry doesn't exist
}
```

**Error Response**:
```typescript
interface ErrorResponse {
  error: string;
  code?: 'INVALID_REGISTRY' | 'READ_ERROR';
}
```

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│                     File System                          │
├──────────────────────────────────────────────────────────┤
│  ~/.speckit/registry.json                                │
│  ~/project/.specify/orchestration-state.json             │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼ (read by API route)
┌──────────────────────────────────────────────────────────┐
│                    API Routes                            │
├──────────────────────────────────────────────────────────┤
│  GET /api/projects                                       │
│    → Reads registry.json                                 │
│    → Validates with Zod                                  │
│    → Returns project list                                │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼ (fetched by polling hook)
┌──────────────────────────────────────────────────────────┐
│                   React Components                       │
├──────────────────────────────────────────────────────────┤
│  usePolling('/api/projects', 5000)                       │
│    → Stores in React state                               │
│    → Re-renders ProjectList                              │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼ (rendered)
┌──────────────────────────────────────────────────────────┐
│                      Browser                             │
├──────────────────────────────────────────────────────────┤
│  localStorage: theme preference                          │
│  React state: expanded projects                          │
└──────────────────────────────────────────────────────────┘
```

---

## Validation Rules

| Field | Rule | Error Handling |
|-------|------|----------------|
| `projects[uuid]` | Valid UUID format | Show "unavailable" badge |
| `projects[uuid].path` | Directory exists | Show "unavailable" badge |
| `registered_at` | ISO 8601 datetime | Graceful fallback to "Unknown" |
| `last_seen` | ISO 8601 datetime or missing | Show "Never" if missing |

---

## Future Considerations (Not This Phase)

- **SQLite caching**: Cache registry + state in local DB for faster queries
- **Project status enrichment**: Read ROADMAP.md, tasks.md for richer display
- **Write operations**: Allow dashboard to modify state (via CLI subprocess)
