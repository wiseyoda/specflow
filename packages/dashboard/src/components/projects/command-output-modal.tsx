'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Loader2,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CommandOutputEvent } from '@specflow/shared';

export interface CommandOutputModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Command being executed (for display) */
  command: string;
  /** Execution ID for streaming */
  executionId?: string;
  /** Project path (for display) */
  projectPath?: string;
  /** Callback when command completes */
  onComplete?: (success: boolean) => void;
}

interface OutputLine {
  type: 'stdout' | 'stderr';
  text: string;
  timestamp: number;
}

type ExecutionStatus = 'running' | 'completed' | 'failed' | 'error';

export function CommandOutputModal({
  open,
  onOpenChange,
  command,
  executionId,
  projectPath,
  onComplete,
}: CommandOutputModalProps) {
  const [output, setOutput] = React.useState<OutputLine[]>([]);
  const [status, setStatus] = React.useState<ExecutionStatus>('running');
  const [exitCode, setExitCode] = React.useState<number | null>(null);
  const [startTime] = React.useState<number>(Date.now());
  const [endTime, setEndTime] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);
  const outputRef = React.useRef<HTMLDivElement>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  // Connect to SSE stream when executionId is available
  React.useEffect(() => {
    if (!executionId || !open) return;

    const eventSource = new EventSource(
      `/api/commands/stream?id=${executionId}`
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (e) => {
      try {
        const event: CommandOutputEvent = JSON.parse(e.data);

        if (event.type === 'stdout' || event.type === 'stderr') {
          setOutput((prev) => [
            ...prev,
            { type: event.type, text: event.data, timestamp: Date.now() },
          ]);
        } else if (event.type === 'exit') {
          setStatus(event.code === 0 ? 'completed' : 'failed');
          setExitCode(event.code);
          setEndTime(Date.now());
          onComplete?.(event.code === 0);
          eventSource.close();
        } else if (event.type === 'error') {
          setOutput((prev) => [
            ...prev,
            { type: 'stderr', text: event.message, timestamp: Date.now() },
          ]);
          setStatus('error');
          setEndTime(Date.now());
          onComplete?.(false);
          eventSource.close();
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      if (status === 'running') {
        setStatus('error');
        setEndTime(Date.now());
        setOutput((prev) => [
          ...prev,
          {
            type: 'stderr',
            text: 'Connection lost. Command may still be running.',
            timestamp: Date.now(),
          },
        ]);
        onComplete?.(false);
      }
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [executionId, open, status, onComplete]);

  // Auto-scroll to bottom when new output arrives
  React.useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Reset state when modal opens with new execution
  React.useEffect(() => {
    if (open && executionId) {
      setOutput([]);
      setStatus('running');
      setExitCode(null);
      setEndTime(null);
      setCopied(false);
    }
  }, [open, executionId]);

  const handleCopy = React.useCallback(async () => {
    const text = output.map((line) => line.text).join('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [output]);

  const executionTime = React.useMemo(() => {
    const end = endTime || Date.now();
    const seconds = ((end - startTime) / 1000).toFixed(1);
    return `${seconds}s`;
  }, [startTime, endTime]);

  const statusIcon = React.useMemo(() => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  }, [status]);

  const statusText = React.useMemo(() => {
    switch (status) {
      case 'running':
        return 'Running...';
      case 'completed':
        return `Completed in ${executionTime}`;
      case 'failed':
        return `Failed (exit code ${exitCode}) in ${executionTime}`;
      case 'error':
        return `Error after ${executionTime}`;
    }
  }, [status, executionTime, exitCode]);

  return (
    <Dialog open={open} onOpenChange={status === 'running' ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside during execution
          if (status === 'running') {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-neutral-500" />
            <DialogTitle className="text-base font-medium">
              {status === 'running' ? 'Running: ' : ''}specflow {command}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-sm text-neutral-500">{statusText}</span>
          </div>
        </DialogHeader>

        {projectPath && (
          <p className="text-xs text-neutral-400 truncate -mt-1">
            {projectPath}
          </p>
        )}

        <div
          ref={outputRef}
          className="mt-2 h-80 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-950 p-4 font-mono text-sm"
        >
          <div className="text-neutral-400 mb-2">
            $ specflow {command}
          </div>
          {output.map((line, index) => (
            <div
              key={index}
              className={cn(
                'whitespace-pre-wrap break-all',
                line.type === 'stderr'
                  ? 'text-amber-400'
                  : 'text-neutral-200'
              )}
            >
              {line.text}
            </div>
          ))}
          {status === 'running' && output.length === 0 && (
            <div className="text-neutral-500 animate-pulse">
              Waiting for output...
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {exitCode !== null && (
              <span className="text-xs text-neutral-500">
                Exit code: {exitCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={output.length === 0}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
            {status !== 'running' && (
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
