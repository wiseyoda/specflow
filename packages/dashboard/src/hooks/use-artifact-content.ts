'use client';

import { useState, useCallback } from 'react';

export interface ArtifactContent {
  path: string;
  title: string;
  content: string;
}

interface UseArtifactContentResult {
  artifact: ArtifactContent | null;
  isLoading: boolean;
  error: Error | null;
  fetchArtifact: (path: string) => Promise<void>;
  clearArtifact: () => void;
}

/**
 * Hook to fetch artifact file content
 */
export function useArtifactContent(): UseArtifactContentResult {
  const [artifact, setArtifact] = useState<ArtifactContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchArtifact = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/artifacts?path=${encodeURIComponent(path)}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to fetch artifact: ${res.status}`);
      }

      const data = await res.json();
      setArtifact(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
      setArtifact(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearArtifact = useCallback(() => {
    setArtifact(null);
    setError(null);
  }, []);

  return {
    artifact,
    isLoading,
    error,
    fetchArtifact,
    clearArtifact,
  };
}
