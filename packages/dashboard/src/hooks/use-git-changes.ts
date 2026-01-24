'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface FileChange {
  path: string;
  filename: string;
  directory: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

interface UseGitChangesResult {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** Debounce delay for refresh trigger (2 seconds) */
const REFRESH_DEBOUNCE_MS = 2000;

/**
 * Hook to fetch git file changes for a project
 *
 * @param projectPath - Absolute path to the project
 * @param refreshTrigger - Optional value that triggers a refresh when changed (debounced)
 *                         Can be a number, string, or any value - changes trigger refresh
 */
export function useGitChanges(
  projectPath: string | null,
  refreshTrigger?: string | number
): UseGitChangesResult {
  const [files, setFiles] = useState<FileChange[]>([]);
  const [totalAdditions, setTotalAdditions] = useState(0);
  const [totalDeletions, setTotalDeletions] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track debounce timeout
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChanges = useCallback(async () => {
    if (!projectPath) {
      setFiles([]);
      setTotalAdditions(0);
      setTotalDeletions(0);
      setTotalFiles(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/git/changes?projectPath=${encodeURIComponent(projectPath)}`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch git changes: ${res.status}`);
      }

      const data = await res.json();
      setFiles(data.files || []);
      setTotalAdditions(data.totalAdditions || 0);
      setTotalDeletions(data.totalDeletions || 0);
      setTotalFiles(data.totalFiles || 0);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  // Initial fetch on mount/path change
  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  // Debounced refresh on trigger change
  useEffect(() => {
    // Skip if no trigger value or initial render
    if (refreshTrigger === undefined) {
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced fetch
    debounceTimeoutRef.current = setTimeout(() => {
      fetchChanges();
    }, REFRESH_DEBOUNCE_MS);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [refreshTrigger, fetchChanges]);

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalFiles,
    isLoading,
    error,
    refresh: fetchChanges,
  };
}
