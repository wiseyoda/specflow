import { NextResponse } from 'next/server';
import { CommandExecuteRequestSchema } from '@specflow/shared';
import { cliExecutor } from '@/lib/cli-executor';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = CommandExecuteRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { command, args, projectPath } = parseResult.data;

    // Execute the command
    const executionId = cliExecutor.execute(command, args, projectPath);

    // Return execution ID and stream URL
    return NextResponse.json({
      executionId,
      streamUrl: `/api/commands/stream?id=${executionId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (message.includes('not allowed')) {
      return NextResponse.json(
        { error: 'Command not allowed', message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Execution failed', message },
      { status: 500 }
    );
  }
}
