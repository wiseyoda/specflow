import { initWatcher, addListener, getCurrentRegistry, getAllStates, getAllTasks, getAllWorkflows, getAllPhases, getAllSessions, startHeartbeat } from '@/lib/watcher';
import type { SSEEvent } from '@specflow/shared';

// Initialize watcher on first request
let watcherInitialized = false;

/**
 * Format SSE event data
 */
function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * SSE endpoint for real-time updates
 */
export async function GET(): Promise<Response> {
  // Initialize watcher singleton on first request
  if (!watcherInitialized) {
    await initWatcher();
    watcherInitialized = true;
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start: async (controller) => {
      const encoder = new TextEncoder();

      // Helper to send SSE event
      const send = (event: SSEEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          // Stream closed, ignore
        }
      };

      // Send connected event
      send({
        type: 'connected',
        timestamp: new Date().toISOString(),
      });

      // Send current registry data
      const registry = getCurrentRegistry();
      if (registry) {
        send({
          type: 'registry',
          timestamp: new Date().toISOString(),
          data: registry,
        });
      }

      // Send current state data for all projects
      const states = await getAllStates();
      for (const [projectId, state] of states) {
        send({
          type: 'state',
          timestamp: new Date().toISOString(),
          projectId,
          data: state,
        });
      }

      // Send current tasks data for all projects
      const tasks = await getAllTasks();
      for (const [projectId, taskData] of tasks) {
        send({
          type: 'tasks',
          timestamp: new Date().toISOString(),
          projectId,
          data: taskData,
        });
      }

      // Send current workflow data for all projects
      const workflows = await getAllWorkflows();
      for (const [projectId, workflowData] of workflows) {
        send({
          type: 'workflow',
          timestamp: new Date().toISOString(),
          projectId,
          data: workflowData,
        });
      }

      // Send current phases data for all projects
      const phases = await getAllPhases();
      for (const [projectId, phasesData] of phases) {
        send({
          type: 'phases',
          timestamp: new Date().toISOString(),
          projectId,
          data: phasesData,
        });
      }

      // Send current session content for active sessions
      const sessions = await getAllSessions();
      for (const { projectId, sessionId, content } of sessions) {
        send({
          type: 'session:message',
          timestamp: new Date().toISOString(),
          projectId,
          sessionId,
          data: content,
        });
      }

      // Add listener for future events
      const removeListener = addListener(send);

      // Start heartbeat
      const heartbeatInterval = startHeartbeat(send);

      // Cleanup on close (using AbortController pattern)
      // Note: Next.js handles cleanup through request.signal
      // but we also need to handle stream close
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        removeListener();
      };

      // Store cleanup in controller for access on cancel
      (controller as unknown as { cleanup: () => void }).cleanup = cleanup;
    },
    cancel(controller) {
      // Call cleanup when stream is cancelled
      const cleanup = (controller as unknown as { cleanup?: () => void }).cleanup;
      if (cleanup) cleanup();
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
