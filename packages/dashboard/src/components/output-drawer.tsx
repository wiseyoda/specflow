"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Check, Trash2, Terminal, AlertCircle, CheckCircle2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface OutputLine {
  type: "stdout" | "stderr" | "info"
  text: string
  timestamp?: string
}

interface OutputDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  output: OutputLine[]
  status?: "running" | "completed" | "failed" | "cancelled"
  onClear?: () => void
}

export function OutputDrawer({
  open,
  onOpenChange,
  title = "Command Output",
  description,
  output,
  status = "running",
  onClear,
}: OutputDrawerProps) {
  const outputRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, autoScroll])

  // Detect manual scroll
  const handleScroll = () => {
    if (outputRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current
      // If user scrolled up, disable auto-scroll
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
    }
  }

  // Copy output to clipboard
  const handleCopy = async () => {
    const text = output.map((line) => line.text).join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Status indicator element
  const statusIndicator = (() => {
    switch (status) {
      case "running":
        return (
          <div className="flex items-center gap-2 text-blue-500">
            <Terminal className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Running...</span>
          </div>
        )
      case "completed":
        return (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Completed</span>
          </div>
        )
      case "failed":
        return (
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed</span>
          </div>
        )
      case "cancelled":
        return (
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Cancelled</span>
          </div>
        )
    }
  })()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[600px] sm:max-w-[600px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {title}
            </SheetTitle>
            {statusIndicator}
          </div>
          {description && (
            <SheetDescription className="font-mono text-xs">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Output area */}
        <div
          ref={outputRef}
          onScroll={handleScroll}
          className="flex-1 mt-4 overflow-auto bg-neutral-950 rounded-md p-4 font-mono text-xs leading-relaxed"
        >
          {output.length === 0 ? (
            <div className="text-neutral-500 italic">Waiting for output...</div>
          ) : (
            <pre className="whitespace-pre overflow-x-auto">
              {output.map((line, index) => (
                <span
                  key={index}
                  className={cn(
                    line.type === "stderr" && "text-red-400",
                    line.type === "stdout" && "text-neutral-100",
                    line.type === "info" && "text-blue-400"
                  )}
                >
                  {line.text}
                </span>
              ))}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs text-neutral-500">
            {output.length} line{output.length !== 1 ? "s" : ""}
            {!autoScroll && (
              <span className="ml-2 text-yellow-500">(Scroll paused)</span>
            )}
          </div>
          <div className="flex gap-2">
            {onClear && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                disabled={status === "running"}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={output.length === 0}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
