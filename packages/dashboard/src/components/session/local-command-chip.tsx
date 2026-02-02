'use client';

import { cn } from '@/lib/utils';
import {
  Trash2,
  Package,
  Settings,
  BarChart3,
  DollarSign,
  Stethoscope,
  LogOut,
  Download,
  HelpCircle,
  Rocket,
  Plug,
  Brain,
  Bot,
  Shield,
  FileText,
  Pencil,
  Play,
  RotateCcw,
  LineChart,
  Info,
  Palette,
  Keyboard,
  CheckSquare,
  Globe,
  Bug,
  Copy,
  ClipboardList,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

/**
 * Command category determines the chip's color scheme
 */
type CommandCategory = 'session' | 'config' | 'context' | 'tracking' | 'help' | 'workflow' | 'advanced';

/**
 * Command metadata for display
 */
interface CommandMeta {
  label: string;
  icon: LucideIcon;
  category: CommandCategory;
  description: string;
  hasArgs?: boolean;
  argHint?: string;
}

/**
 * Registry of all Claude Code CLI commands
 */
const COMMAND_REGISTRY: Record<string, CommandMeta> = {
  // Session Management
  'clear': {
    label: 'Clear',
    icon: Trash2,
    category: 'session',
    description: 'Clear conversation history',
  },
  'exit': {
    label: 'Exit',
    icon: LogOut,
    category: 'session',
    description: 'Exit session',
  },
  'rename': {
    label: 'Rename',
    icon: Pencil,
    category: 'session',
    description: 'Rename session',
    hasArgs: true,
    argHint: '[name]',
  },
  'resume': {
    label: 'Resume',
    icon: Play,
    category: 'session',
    description: 'Resume session',
    hasArgs: true,
    argHint: '[session]',
  },
  'copy': {
    label: 'Copy',
    icon: Copy,
    category: 'session',
    description: 'Copy last response',
  },
  'export': {
    label: 'Export',
    icon: Download,
    category: 'session',
    description: 'Export conversation',
    hasArgs: true,
    argHint: '[filename]',
  },

  // Configuration
  'config': {
    label: 'Config',
    icon: Settings,
    category: 'config',
    description: 'Open settings',
  },
  'status': {
    label: 'Status',
    icon: Info,
    category: 'config',
    description: 'Show status',
  },
  'model': {
    label: 'Model',
    icon: Bot,
    category: 'config',
    description: 'Change model',
  },
  'theme': {
    label: 'Theme',
    icon: Palette,
    category: 'config',
    description: 'Change theme',
  },
  'vim': {
    label: 'Vim',
    icon: Keyboard,
    category: 'config',
    description: 'Enable vim mode',
  },
  'permissions': {
    label: 'Permissions',
    icon: Shield,
    category: 'config',
    description: 'View permissions',
  },
  'statusline': {
    label: 'Statusline',
    icon: BarChart3,
    category: 'config',
    description: 'Configure status line',
  },
  'init': {
    label: 'Init',
    icon: Rocket,
    category: 'config',
    description: 'Initialize project',
  },
  'mcp': {
    label: 'MCP',
    icon: Plug,
    category: 'config',
    description: 'Manage MCP servers',
  },

  // Context & Memory
  'compact': {
    label: 'Compact',
    icon: Package,
    category: 'context',
    description: 'Compact conversation',
    hasArgs: true,
    argHint: '[instructions]',
  },
  'context': {
    label: 'Context',
    icon: BarChart3,
    category: 'context',
    description: 'Visualize context usage',
  },
  'memory': {
    label: 'Memory',
    icon: Brain,
    category: 'context',
    description: 'Edit CLAUDE.md',
  },
  'plan': {
    label: 'Plan',
    icon: FileText,
    category: 'context',
    description: 'Enter plan mode',
  },
  'tasks': {
    label: 'Tasks',
    icon: ClipboardList,
    category: 'context',
    description: 'List background tasks',
  },
  'todos': {
    label: 'Todos',
    icon: CheckSquare,
    category: 'context',
    description: 'List TODO items',
  },

  // Tracking & Stats
  'cost': {
    label: 'Cost',
    icon: DollarSign,
    category: 'tracking',
    description: 'Show token usage',
  },
  'stats': {
    label: 'Stats',
    icon: LineChart,
    category: 'tracking',
    description: 'Usage statistics',
  },
  'usage': {
    label: 'Usage',
    icon: BarChart3,
    category: 'tracking',
    description: 'Show usage limits',
  },

  // Help & Diagnostics
  'help': {
    label: 'Help',
    icon: HelpCircle,
    category: 'help',
    description: 'Get help',
  },
  'doctor': {
    label: 'Doctor',
    icon: Stethoscope,
    category: 'help',
    description: 'Health check',
  },

  // Advanced
  'rewind': {
    label: 'Rewind',
    icon: RotateCcw,
    category: 'advanced',
    description: 'Rewind conversation',
  },
  'teleport': {
    label: 'Teleport',
    icon: Globe,
    category: 'advanced',
    description: 'Resume remote session',
  },
  'bug': {
    label: 'Bug',
    icon: Bug,
    category: 'advanced',
    description: 'Report bug',
  },
};

/**
 * Color schemes for each category
 */
const CATEGORY_COLORS: Record<CommandCategory, { bg: string; text: string; border: string }> = {
  session: {
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/20',
  },
  config: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
  },
  context: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  tracking: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  help: {
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
  },
  workflow: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  advanced: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
};

/**
 * Parsed local command data
 */
export interface LocalCommandData {
  command: string;
  message?: string;
  args?: string;
  stdout?: string;
}

/**
 * Parse the XML-like format from local commands
 */
export function parseLocalCommand(content: string): LocalCommandData | null {
  // Check for the caveat marker
  if (!content.includes('<local-command-caveat>')) {
    return null;
  }

  // Extract command name (strip leading /)
  const commandMatch = content.match(/<command-name>\/?([^<]+)<\/command-name>/);
  if (!commandMatch) {
    return null;
  }

  const command = commandMatch[1].trim();

  // Extract optional fields
  const messageMatch = content.match(/<command-message>([^<]*)<\/command-message>/);
  const argsMatch = content.match(/<command-args>([^<]*)<\/command-args>/);
  const stdoutMatch = content.match(/<local-command-stdout>([^<]*)<\/local-command-stdout>/);

  return {
    command,
    message: messageMatch?.[1]?.trim() || undefined,
    args: argsMatch?.[1]?.trim() || undefined,
    stdout: stdoutMatch?.[1]?.trim() || undefined,
  };
}

export interface LocalCommandChipProps {
  /** The command data */
  data: LocalCommandData;
  /** Optional additional class names */
  className?: string;
}

/**
 * LocalCommandChip component
 *
 * Displays a beautiful chip for Claude Code CLI commands.
 * Automatically styles based on command type with appropriate icons and colors.
 */
export function LocalCommandChip({ data, className }: LocalCommandChipProps) {
  const meta = COMMAND_REGISTRY[data.command];

  // Fallback for unknown commands
  if (!meta) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
          'bg-surface-200 text-zinc-400 border border-surface-300',
          className
        )}
        title={`Unknown command: /${data.command}`}
      >
        <Terminal className="w-3.5 h-3.5 flex-shrink-0" />
        <span>/{data.command}</span>
        {data.args && <span className="opacity-60">{data.args}</span>}
      </span>
    );
  }

  const colors = CATEGORY_COLORS[meta.category];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
        colors.bg,
        colors.text,
        'border',
        colors.border,
        className
      )}
      title={meta.description}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{meta.label}</span>
      {data.args && <span className="opacity-60">{data.args}</span>}
    </span>
  );
}

/**
 * Check if content is a local command
 */
export function isLocalCommand(content: string): boolean {
  return content.includes('<local-command-caveat>');
}
