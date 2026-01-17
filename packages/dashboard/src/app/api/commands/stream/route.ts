import { cliExecutor } from '@/lib/cli-executor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const executionId = searchParams.get('id');

  if (!executionId) {
    return new Response('Missing execution ID', { status: 400 });
  }

  // Verify execution exists
  const execution = cliExecutor.getExecution(executionId);
  if (!execution) {
    return new Response('Execution not found', { status: 404 });
  }

  // Set up SSE response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial execution state
      const initialEvent = `data: ${JSON.stringify({
        type: 'init',
        execution: {
          id: execution.id,
          command: execution.command,
          status: execution.status,
          startedAt: execution.startedAt,
        },
      })}\n\n`;
      controller.enqueue(encoder.encode(initialEvent));

      // Send any existing output
      for (const line of execution.output) {
        const event = `data: ${JSON.stringify({ type: 'stdout', data: line })}\n\n`;
        controller.enqueue(encoder.encode(event));
      }

      // If already completed, send exit event and close
      if (execution.status !== 'running') {
        const exitEvent = `data: ${JSON.stringify({
          type: 'exit',
          code: execution.exitCode ?? -1,
          signal: null,
        })}\n\n`;
        controller.enqueue(encoder.encode(exitEvent));
        controller.close();
        return;
      }

      // Subscribe to new events
      const unsubscribe = cliExecutor.subscribe(executionId, (event) => {
        try {
          const sseEvent = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseEvent));

          // Close stream on exit or error
          if (event.type === 'exit' || event.type === 'error') {
            controller.close();
            unsubscribe();
          }
        } catch {
          // Stream closed, clean up
          unsubscribe();
        }
      });

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
