'use client';

import { useState, useEffect, useCallback } from 'react';

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

/**
 * Hook to fetch git file changes for a project
 */
export function useGitChanges(projectPath: string | null): UseGitChangesResult {
  const [files, setFiles] = useState<FileChange[]>([]);
  const [totalAdditions, setTotalAdditions] = useState(0);
  const [totalDeletions, setTotalDeletions] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

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
