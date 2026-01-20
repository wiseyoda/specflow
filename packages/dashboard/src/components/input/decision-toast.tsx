'use client'

import { cn } from '@/lib/utils'
import { HelpCircle, MessageSquare } from 'lucide-react'
import { useState } from 'react'

interface Question {
  question: string
  options: Array<{
    label: string
    description?: string
  }>
}

interface DecisionToastProps {
  questions: Question[]
  currentIndex?: number
  onAnswer: (answer: string) => void
  onCustomAnswer?: (answer: string) => void
  className?: string
}

export function DecisionToast({
  questions,
  currentIndex = 0,
  onAnswer,
  onCustomAnswer,
  className,
}: DecisionToastProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const currentQuestion = questions[currentIndex]
  if (!currentQuestion) return null

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onCustomAnswer?.(customValue.trim())
      setCustomValue('')
      setShowCustomInput(false)
    }
  }

  return (
    <div
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 animate-slide-up',
        className
      )}
    >
      {/* Beam progress indicator */}
      <div className="h-1 w-full rounded-t-lg bg-surface-300 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-accent to-transparent animate-beam" />
      </div>

      {/* Toast content */}
      <div className="glass rounded-b-lg p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-5 h-5 text-warning" />
          <span className="font-medium text-white">Decision Required</span>
          {questions.length > 1 && (
            <span className="text-sm text-surface-500 ml-auto">
              {currentIndex + 1} of {questions.length}
            </span>
          )}
        </div>

        {/* Question text */}
        <p className="text-sm text-zinc-400 mb-4">{currentQuestion.question}</p>

        {/* Option buttons */}
        {!showCustomInput && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => onAnswer(option.label)}
                  className="p-3 rounded-xl border border-surface-300 bg-surface-200/50 hover:bg-surface-200 hover:border-accent/30 transition-all text-left"
                >
                  <div className="text-sm font-medium text-white">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-zinc-500 mt-1">{option.description}</div>
                  )}
                </button>
              ))}
            </div>

            {/* Custom answer link */}
            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-2 text-sm text-accent hover:text-accent-light transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Provide custom instructions</span>
            </button>
          </>
        )}

        {/* Custom input */}
        {showCustomInput && (
          <div className="space-y-3">
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
