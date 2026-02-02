'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Check if content contains box-drawing characters (ASCII art tables).
 * These need monospace rendering, not markdown parsing.
 */
function containsBoxDrawing(content: string): boolean {
  // Box drawing characters: ─ │ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼ and their variants
  return /[─│┌┐└┘├┤┬┴┼╭╮╯╰═║╔╗╚╝╠╣╦╩╬]/.test(content);
}

/**
 * Preprocess content to fix malformed markdown tables.
 * Detects rows with pipe characters and ensures separator rows have correct column count.
 */
function preprocessMarkdown(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this is a malformed separator row (only has one separator like |---|)
    if (/^\|[\s-]+\|$/.test(trimmed) || /^\|-+\|$/.test(trimmed)) {
      // Look at previous line to get column count
      const prevLine = result[result.length - 1]?.trim() || '';
      if (prevLine.startsWith('|') && prevLine.endsWith('|')) {
        // Count columns in previous line
        const cols = (prevLine.match(/\|/g) || []).length - 1;
        if (cols > 1) {
          // Generate proper separator with correct column count
          const separator = '| ' + Array(cols).fill('---').join(' | ') + ' |';
          result.push(separator);
          continue;
        }
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  // If content contains box-drawing characters, render as monospace preformatted text
  if (containsBoxDrawing(content)) {
    return (
      <pre className={cn('font-mono text-xs text-zinc-400 whitespace-pre-wrap overflow-x-auto', className)}>
        {content}
      </pre>
    );
  }

  const processedContent = preprocessMarkdown(content);

  return (
    <div className={cn('prose prose-invert prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-white mt-6 mb-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-white mt-5 mb-2 border-b border-surface-300 pb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-medium text-zinc-300 mt-3 mb-1">{children}</h4>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-sm text-zinc-400 leading-relaxed mb-3">{children}</p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-zinc-400">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-zinc-400">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-zinc-400">{children}</li>
          ),

          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-surface-300 text-accent font-mono text-xs">
                  {children}
                </code>
              );
            }
            return (
              <code className={cn('block', className)} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-surface-200 border border-surface-300 rounded-lg p-3 overflow-x-auto mb-3 text-xs">
              {children}
            </pre>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-accent hover:text-accent-light underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-accent pl-4 italic text-zinc-500 my-3">
              {children}
            </blockquote>
          ),

          // Horizontal rules
          hr: () => <hr className="border-surface-300 my-4" />,

          // Strong/Bold
          strong: ({ children }) => (
            <strong className="font-semibold text-zinc-200">{children}</strong>
          ),

          // Emphasis/Italic
          em: ({ children }) => (
            <em className="italic text-zinc-300">{children}</em>
          ),

          // Tables (if needed)
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full text-sm border border-surface-300 rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-300">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-surface-300">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-surface-200/50">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-medium text-zinc-300">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-zinc-400">{children}</td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
