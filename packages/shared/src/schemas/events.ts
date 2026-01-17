import { z } from 'zod';
import { RegistrySchema } from './registry';

/**
 * Schema for orchestration state (simplified for SSE events)
 */
export const OrchestrationStateSchema = z.object({
  schema_version: z.string(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
  }),
  orchestration: z.object({
    phase: z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      status: z.string().optional(),
      step: z.string().optional(),
    }).optional(),
  }).optional(),
  health: z.object({
    status: z.enum(['healthy', 'warning', 'error']).optional(),
    last_check: z.string().optional(),
  }).optional(),
}).passthrough(); // Allow additional fields

/**
 * SSE Event Types
 */
export const SSEEventTypeSchema = z.enum([
  'connected',    // Initial connection established
  'heartbeat',    // Keep-alive ping
  'registry',     // Registry file changed
  'state',        // Project state file changed
]);

/**
 * Connected event - sent when client first connects
 */
export const ConnectedEventSchema = z.object({
  type: z.literal('connected'),
  timestamp: z.string(),
});

/**
 * Heartbeat event - keep-alive ping
 */
export const HeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  timestamp: z.string(),
});

/**
 * Registry event - registry.json changed
 */
export const RegistryEventSchema = z.object({
  type: z.literal('registry'),
  timestamp: z.string(),
  data: RegistrySchema,
});

/**
 * State event - project state file changed
 */
export const StateEventSchema = z.object({
  type: z.literal('state'),
  timestamp: z.string(),
  projectId: z.string(),
  data: OrchestrationStateSchema,
});

/**
 * Union of all SSE event types
 */
export const SSEEventSchema = z.discriminatedUnion('type', [
  ConnectedEventSchema,
  HeartbeatEventSchema,
  RegistryEventSchema,
  StateEventSchema,
]);

// Type exports
export type SSEEventType = z.infer<typeof SSEEventTypeSchema>;
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>;
export type RegistryEvent = z.infer<typeof RegistryEventSchema>;
export type StateEvent = z.infer<typeof StateEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
export type OrchestrationState = z.infer<typeof OrchestrationStateSchema>;
