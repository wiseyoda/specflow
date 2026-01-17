import { NextResponse } from 'next/server';
import { discoverCommands, getCachedCommands, refreshCommands } from '@/lib/command-discovery';
import { ALLOWED_COMMANDS } from '@/lib/allowed-commands';
import type { CommandList } from '@speckit/shared';

export const dynamic = 'force-dynamic';

/**
 * Filter commands to only include allowed ones
 */
function filterAllowedCommands(commandList: CommandList): CommandList {
  return {
    ...commandList,
    commands: commandList.commands.filter(cmd => ALLOWED_COMMANDS.has(cmd.name)),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    let commands: CommandList;

    // Force refresh if requested
    if (forceRefresh) {
      commands = await refreshCommands();
    } else {
      // Try to use cache first for fast response
      const cached = getCachedCommands();
      commands = cached || await discoverCommands();
    }

    // Filter to only allowed commands
    const filtered = filterAllowedCommands(commands);
    return NextResponse.json(filtered);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check if speckit is not installed
    if (message.includes('ENOENT') || message.includes('not found')) {
      return NextResponse.json(
        {
          error: 'SpecKit CLI not found',
          message: 'Please ensure speckit is installed and in your PATH',
          installInstructions: 'Run: ./install.sh from the SpecKit repository',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to discover commands', message },
      { status: 500 }
    );
  }
}
