import { describe, expect, it } from 'vitest';
import { parseCodexJsonlOutput } from '../../src/lib/claude-runner.js';

describe('parseCodexJsonlOutput', () => {
  it('parses thread.started session id and final agent_message payload', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-123' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_0',
          type: 'reasoning',
          text: 'thinking...',
        },
      }),
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'agent_message',
          text: '{"status":"completed","message":"done"}',
        },
      }),
    ].join('\n');

    const result = parseCodexJsonlOutput(stdout);

    expect(result.sessionId).toBe('thread-123');
    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({
      status: 'completed',
      message: 'done',
    });
  });

  it('returns error when final agent_message is missing', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-123' }),
      JSON.stringify({ type: 'turn.started' }),
    ].join('\n');

    const result = parseCodexJsonlOutput(stdout);

    expect(result.sessionId).toBe('thread-123');
    expect(result.output).toBeUndefined();
    expect(result.error).toContain('missing final agent_message');
  });

  it('falls back to plain completed message when final payload is not JSON', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-abc' }),
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'agent_message',
          text: 'Done with manual output',
        },
      }),
    ].join('\n');

    const result = parseCodexJsonlOutput(stdout);

    expect(result.sessionId).toBe('thread-abc');
    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({
      status: 'completed',
      message: 'Done with manual output',
    });
  });

  it('accepts strict-schema nulls and coerces to workflow output', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 'thread-xyz' }),
      JSON.stringify({
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'agent_message',
          text: JSON.stringify({
            status: 'needs_input',
            phase: null,
            message: 'Need one answer',
            questions: null,
            artifacts: null,
          }),
        },
      }),
    ].join('\n');

    const result = parseCodexJsonlOutput(stdout);

    expect(result.sessionId).toBe('thread-xyz');
    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({
      status: 'needs_input',
      message: 'Need one answer',
    });
  });
});

