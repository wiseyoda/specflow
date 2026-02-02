import type { ProcessEnvOptions } from 'child_process';

/**
 * Ensure specflow CLI is on PATH for server-side exec calls.
 */
export function getSpecflowEnv(): ProcessEnvOptions['env'] {
  const homeDir = process.env.HOME || '/Users/ppatterson';
  const existingPath = process.env.PATH || '';
  const prefix = [
    `${homeDir}/.claude/specflow-system/bin`,
    `${homeDir}/.local/bin`,
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ].join(':');

  return {
    ...process.env,
    HOME: homeDir,
    PATH: `${prefix}:${existingPath}`,
  };
}
