"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection } from '@/contexts/connection-context';
import type { ConnectionStatus } from './use-sse';

interface Project {
  id: string;
  name: string;
  path: string;
  registered_at: string;
  last_seen?: string;
  isUnavailable?: boolean;
}

interface ProjectsResult {
  projects: Project[];
  loading: boolean;
  error: Error | null;
  connectionStatus: ConnectionStatus;
  refetch: () => void;
}

// Fetch the project list from API (includes dev_folders filtering and path availability checks)
async function fetchProjects(): Promise<{ projects: Project[]; error?: string }> {
  const res = await fetch('/api/projects');
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}

/**
 * Hook for getting project list with real-time updates via SSE.
 *
 * Uses /api/projects as the source of truth (applies dev_folders filtering).
 * SSE registry events trigger a refetch to pick up changes in real-time.
 */
export function useProjects(): ProjectsResult {
  const { registry, connectionStatus, refetch: sseRefetch } = useConnection();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track the last registry update to detect changes
  const lastRegistryRef = useRef<typeof registry>(null);

  // Fetch filtered project data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProjects();
      setProjects(data.projects);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when connection is restored
  useEffect(() => {
    if (connectionStatus === 'connected' && projects.length === 0) {
      fetchData();
    }
  }, [connectionStatus, projects.length, fetchData]);

  // Refetch when SSE registry changes (new projects added/removed)
  useEffect(() => {
    // Skip if registry hasn't changed
    if (registry === lastRegistryRef.current) {
      return;
    }
    lastRegistryRef.current = registry;

    // If we have a registry update, refetch the filtered project list
    if (registry) {
      fetchData();
    }
  }, [registry, fetchData]);

  const refetch = useCallback(() => {
    fetchData();
    sseRefetch();
  }, [fetchData, sseRefetch]);

  return {
    projects,
    loading: loading && projects.length === 0,
    error,
    connectionStatus,
    refetch,
  };
}
