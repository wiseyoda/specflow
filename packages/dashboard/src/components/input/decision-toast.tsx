'use client'

import { cn } from '@/lib/utils'
import { Check, HelpCircle, MessageSquare, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MarkdownContent } from '@/components/ui/markdown-content'

interface Question {
  question: string
  options: Array<{
    label: string
    description?: string
  }>
  multiSelect?: boolean
}

interface DecisionToastProps {
  questions: Question[]
  currentIndex?: number
  onAnswer: (answer: string) => void
  onCustomAnswer?: (answer: string) => void
  /** Dismiss the question without answering */
  onDismiss?: () => void
  /** Whether the questions are still loading */
  isLoading?: boolean
  className?: string
}

export function DecisionToast({
  questions,
  currentIndex = 0,
  onAnswer,
  onCustomAnswer,
  onDismiss,
  isLoading = false,
  className,
}: DecisionToastProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])

  const currentQuestion = questions[currentIndex]

  useEffect(() => {
    setShowCustomInput(false)
    setCustomValue('')
    setSelectedOptions([])
  }, [currentIndex, currentQuestion?.question])

  // Show loading state when waiting for questions
  if (isLoading && !currentQuestion) {
    return (
      <div
        className={cn(
          'fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-3xl z-50 animate-slide-up',
          className
        )}
      >
        {/* Beam progress indicator */}
        <div className="h-1 w-full rounded-t-lg bg-surface-300 overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-beam" />
        </div>

        {/* Toast content - loading state */}
        <div className="glass rounded-b-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-5 h-5 text-warning animate-pulse" />
            <span className="font-medium text-white">Loading question...</span>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-auto p-1 rounded hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-zinc-400">Retrieving the question from the session...</p>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onCustomAnswer?.(customValue.trim())
      setCustomValue('')
      setShowCustomInput(false)
    }
  }

  const isMultiSelect = !!currentQuestion?.multiSelect

  const toggleOption = (label: string) => {
    setSelectedOptions((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    )
  }

  const handleMultiSelectSubmit = () => {
    if (selectedOptions.length > 0) {
      onAnswer(selectedOptions.join(', '))
    }
  }

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-3xl z-50 animate-slide-up',
        className
      )}
    >
      {/* Beam progress indicator */}
      <div className="h-1 w-full rounded-t-lg bg-surface-300 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-beam" />
      </div>

      {/* Toast content */}
      <div className="glass rounded-b-lg p-4 max-h-[60vh] flex flex-col">
        {/* Header - fixed */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <HelpCircle className="w-5 h-5 text-warning" />
          <span className="font-medium text-white">Decision Required</span>
          {questions.length > 1 && (
            <span className="text-sm text-surface-500 ml-auto">
              {currentIndex + 1} of {questions.length}
            </span>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-auto p-1 rounded hover:bg-surface-300 text-surface-500 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Question text - scrollable area */}
        <div className="text-sm text-zinc-400 mb-4 overflow-y-auto flex-1 min-h-0">
          <MarkdownContent content={currentQuestion.question} className="prose-p:mb-2 prose-p:last:mb-0" />
        </div>
        {isMultiSelect && (
          <div className="text-xs text-zinc-500 mb-3">Select all that apply.</div>
        )}

        {/* Option buttons - fixed at bottom */}
        {!showCustomInput && (
          <div className="flex-shrink-0">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => (isMultiSelect ? toggleOption(option.label) : onAnswer(option.label))}
                  className={cn(
                    'p-3 rounded-xl border border-surface-300 bg-surface-200/50 hover:bg-surface-200 hover:border-accent/30 transition-all text-left',
                    isMultiSelect && selectedOptions.includes(option.label) && 'border-accent/50 bg-surface-200'
                  )}
                >
                  <div className="flex items-start gap-2 text-sm font-medium text-white">
                    {isMultiSelect && (
                      <span
                        className={cn(
                          'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border',
                          selectedOptions.includes(option.label)
                            ? 'border-accent/50 bg-accent/20 text-accent'
                            : 'border-surface-400 text-transparent'
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <span>{option.label}</span>
                  </div>
                  {option.description && (
                    <div className="text-xs text-zinc-500 mt-1">
                      <MarkdownContent content={option.description} className="prose-p:mb-0 prose-sm" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {isMultiSelect && (
              <button
                onClick={handleMultiSelectSubmit}
                disabled={selectedOptions.length === 0}
                className={cn(
                  'w-full mb-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  selectedOptions.length > 0
                    ? 'bg-accent text-white hover:bg-accent-dark'
                    : 'bg-surface-300 text-surface-500 cursor-not-allowed'
                )}
              >
                Submit selections
              </button>
            )}

            {/* Custom answer link */}
            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-2 text-sm text-accent hover:text-accent-light transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Provide custom instructions</span>
            </button>
          </div>
        )}

        {/* Custom input - fixed at bottom */}
        {showCustomInput && (
          <div className="space-y-3 flex-shrink-0">
            <textarea
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Type your custom response..."
              className="w-full p-3 rounded-lg bg-surface-100 border border-surface-300 text-sm text-white placeholder-surface-500 resize-none outline-none focus:border-accent"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCustomInput(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-surface-300 text-sm text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  customValue.trim()
                    ? 'bg-accent text-white hover:bg-accent-dark'
                    : 'bg-surface-300 text-surface-500 cursor-not-allowed'
                )}
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
