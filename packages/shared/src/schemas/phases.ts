import { z } from 'zod';

/**
 * Phase status values (from ROADMAP.md parsing)
 */
export const RoadmapPhaseStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'complete',
  'awaiting_user',
  'blocked',
]);

/**
 * Single phase from ROADMAP.md
 */
export const RoadmapPhaseSchema = z.object({
  number: z.string(),
  name: z.string(),
  status: RoadmapPhaseStatusSchema,
  hasUserGate: z.boolean(),
  verificationGate: z.string().optional(),
});

/**
 * Phases data for SSE events
 */
export const PhasesDataSchema = z.object({
  phases: z.array(RoadmapPhaseSchema),
  activePhase: RoadmapPhaseSchema.nullable(),
  progress: z.object({
    total: z.number(),
    completed: z.number(),
  }),
});

// Type exports
export type RoadmapPhaseStatus = z.infer<typeof RoadmapPhaseStatusSchema>;
export type RoadmapPhase = z.infer<typeof RoadmapPhaseSchema>;
export type PhasesData = z.infer<typeof PhasesDataSchema>;
