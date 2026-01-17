import { z } from 'zod';

/**
 * Schema for a single registered SpecKit project
 */
export const ProjectSchema = z.object({
  path: z.string().describe('Absolute path to project directory'),
  name: z.string().describe('Project display name'),
  registered_at: z.string().describe('ISO 8601 registration timestamp'),
  last_seen: z.string().optional().describe('ISO 8601 last access timestamp'),
});

/**
 * Schema for registry configuration
 */
export const RegistryConfigSchema = z.object({
  dev_folders: z
    .array(z.string())
    .optional()
    .describe('Allowed parent directories for projects (e.g., ~/dev). Projects outside these folders are hidden.'),
});

/**
 * Schema for the central project registry
 * Location: ~/.speckit/registry.json
 */
export const RegistrySchema = z.object({
  projects: z.record(z.string(), ProjectSchema),
  config: RegistryConfigSchema.optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type RegistryConfig = z.infer<typeof RegistryConfigSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
