"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Terminal,
  Loader2,
} from "lucide-react"
import type { CommandList as CommandListType } from "@specflow/shared"
import { OutputDrawer, type OutputLine } from "@/components/output-drawer"
import {
  toastCommandStarted,
  toastCommandSuccess,
  toastCommandError,
} from "@/lib/toast-helpers"
import { useConnection } from "@/contexts/connection-context"
import { cn } from "@/lib/utils"
import { isGlobalCommand } from "@/lib/allowed-commands"

interface CommandHistoryEntry {
  id: string
  command: string
  timestamp: string
  status: "completed" | "failed"
}

export function CommandPalette() {
  const { selectedProject } = useConnection()
  const inputRef = useRef<HTMLInputElement>(null)

  // Palette state
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Command list state
  const [commands, setCommands] = useState<CommandListType | null>(null)
  const [loadingCommands, setLoadingCommands] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)

  // Execution state
  const [executing, setExecuting] = useState(false)

  // Output drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState("")
  const [drawerOutput, setDrawerOutput] = useState<OutputLine[]>([])
  const [drawerStatus, setDrawerStatus] = useState<"running" | "completed" | "failed">("running")

  // Command history (session-scoped)
  const [history, setHistory] = useState<CommandHistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Keyboard shortcut to open palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Fetch commands when palette opens
  useEffect(() => {
    if (open && !commands && !loadingCommands) {
      fetchCommands()
    }
  }, [open, commands, loadingCommands])

  // Reset state when palette closes
  useEffect(() => {
    if (!open) {
      setInputValue("")
      setSelectedIndex(0)
      setHistoryIndex(-1)
    } else {
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Reset selected index when input changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [inputValue])

  const fetchCommands = async () => {
    setLoadingCommands(true)
    setCommandError(null)
    try {
      const response = await fetch("/api/commands/list")
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to load commands")
      }
      const data = await response.json()
      setCommands(data)
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setLoadingCommands(false)
    }
  }

  const executeCommand = useCallback(async (commandString: string) => {
    if (!commandString.trim()) return

    // Check if command requires a project
    if (!selectedProject && !isGlobalCommand(commandString)) {
      toastCommandError(commandString, "Select a project first")
      return
    }

    setExecuting(true)
    setDrawerTitle(commandString)
    setDrawerOutput([])
    setDrawerStatus("running")
    setDrawerOpen(true)
    setOpen(false)

    toastCommandStarted(commandString)

    try {
      // Parse command string into command and args
      const parts = commandString.trim().split(/\s+/)
      const command = parts.slice(0, 2).join(" ") // e.g., "issue create" or "help"
      const args = parts.slice(2) // remaining args

      // Start execution
      const execResponse = await fetch("/api/commands/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          args,
          projectPath: selectedProject?.path || process.cwd(),
        }),
      })

      if (!execResponse.ok) {
        const error = await execResponse.json()
        throw new Error(error.message || "Execution failed")
      }

      const { executionId, streamUrl } = await execResponse.json()

      // Connect to SSE stream
      const eventSource = new EventSource(streamUrl)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "stdout") {
            setDrawerOutput((prev) => [...prev, { type: "stdout", text: data.data }])
          } else if (data.type === "stderr") {
            setDrawerOutput((prev) => [...prev, { type: "stderr", text: data.data }])
          } else if (data.type === "exit") {
            const success = data.code === 0
            setDrawerStatus(success ? "completed" : "failed")
            setExecuting(false)

            if (success) {
              toastCommandSuccess(commandString)
            } else {
              toastCommandError(commandString, `Exit code: ${data.code}`, () =>
                setDrawerOpen(true)
              )
            }

            // Add to history
            setHistory((prev) => [
              {
                id: executionId,
                command: commandString,
                timestamp: new Date().toISOString(),
                status: success ? "completed" : "failed",
              },
              ...prev.slice(0, 49), // Keep last 50
            ])

            eventSource.close()
          } else if (data.type === "error") {
            setDrawerOutput((prev) => [...prev, { type: "stderr", text: data.message }])
            setDrawerStatus("failed")
            setExecuting(false)
            toastCommandError(commandString, data.message, () => setDrawerOpen(true))
            eventSource.close()
          }
        } catch {
          // Ignore parse errors
        }
      }

      eventSource.onerror = () => {
        setDrawerStatus("failed")
        setExecuting(false)
        eventSource.close()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      setDrawerOutput([{ type: "stderr", text: message }])
      setDrawerStatus("failed")
      setExecuting(false)
      toastCommandError(commandString, message, () => setDrawerOpen(true))
    }
  }, [selectedProject])

  // Get suggestions based on input
  const getSuggestions = (): string[] => {
    if (!commands || !inputValue.trim()) return []

    const input = inputValue.toLowerCase().trim()
    const parts = input.split(/\s+/)
    const suggestions: string[] = []

    if (parts.length === 1) {
      // Suggest top-level commands
      for (const cmd of commands.commands) {
        if (cmd.name.toLowerCase().startsWith(parts[0])) {
          suggestions.push(cmd.name)
        }
      }
    } else if (parts.length >= 2) {
      // Find the command and suggest subcommands
      const cmdName = parts[0]
      const subInput = parts[1]
      const cmd = commands.commands.find(c => c.name.toLowerCase() === cmdName.toLowerCase())

      if (cmd) {
        for (const sub of cmd.subcommands) {
          if (sub.name.toLowerCase().startsWith(subInput.toLowerCase())) {
            suggestions.push(`${cmd.name} ${sub.name}`)
          }
        }
      }
    }

    return suggestions.slice(0, 8) // Limit to 8 suggestions
  }

  const suggestions = getSuggestions()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (inputValue.trim()) {
        executeCommand(inputValue.trim())
      }
    } else if (e.key === "Tab") {
      e.preventDefault()
      if (suggestions.length > 0) {
        const selected = suggestions[selectedIndex] || suggestions[0]
        setInputValue(selected + " ")
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (suggestions.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
      } else if (history.length > 0) {
        // Navigate history
        const newIndex = historyIndex + 1
        if (newIndex < history.length) {
          setHistoryIndex(newIndex)
          setInputValue(history[newIndex].command)
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (suggestions.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (history.length > 0) {
        // Navigate history
        const newIndex = historyIndex - 1
        if (newIndex >= 0) {
          setHistoryIndex(newIndex)
          setInputValue(history[newIndex].command)
        } else if (newIndex === -1) {
          setHistoryIndex(-1)
          setInputValue("")
        }
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion + " ")
    inputRef.current?.focus()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-xl">
          <DialogTitle className="sr-only">Command Palette</DialogTitle>

          {/* Input */}
          <div className="flex items-center border-b border-neutral-200 dark:border-neutral-800 px-3">
            <Terminal className="h-4 w-4 text-neutral-500 mr-2" />
            <span className="text-sm text-neutral-500 mr-1">specflow</span>
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="help, status, issue create..."
              className="border-0 focus-visible:ring-0 px-1 h-12"
              autoFocus
            />
            {executing && <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />}
          </div>

          {/* Suggestions */}
          {loadingCommands ? (
            <div className="p-4 text-center text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading commands...
            </div>
          ) : commandError ? (
            <div className="p-4 text-center text-red-500 text-sm">
              {commandError}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="p-2 max-h-[200px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded text-sm font-mono flex items-center gap-2",
                    index === selectedIndex
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  )}
                >
                  <Terminal className="h-3 w-3 text-neutral-400" />
                  <span>{suggestion}</span>
                  {index === selectedIndex && (
                    <span className="ml-auto text-xs text-neutral-400">Tab to complete</span>
                  )}
                </button>
              ))}
            </div>
          ) : inputValue.trim() ? (
            <div className="p-4 text-center text-neutral-500 text-sm">
              Press Enter to run: <code className="bg-neutral-100 dark:bg-neutral-800 px-1 rounded">specflow {inputValue}</code>
            </div>
          ) : (
            <div className="p-4 text-sm text-neutral-500">
              <p className="mb-2">Type a command and press <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">Enter</kbd> to run</p>
              <p className="text-xs">
                <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">Tab</kbd> autocomplete
                {" · "}
                <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">↑↓</kbd> navigate
                {" · "}
                <kbd className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded">Esc</kbd> close
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <OutputDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerTitle}
        description={selectedProject?.path}
        output={drawerOutput}
        status={drawerStatus}
        onClear={() => setDrawerOutput([])}
      />
    </>
  )
}
