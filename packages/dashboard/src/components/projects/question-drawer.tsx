'use client';

/**
 * Question Drawer component
 *
 * Slide-in panel for answering workflow questions.
 * Supports single-select (radio), multi-select (checkbox), and free-text questions.
 */

import * as React from 'react';
import { HelpCircle, Loader2, Send } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkflowExecution } from '@/lib/services/workflow-service';

export interface QuestionDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current workflow execution with questions */
  execution: WorkflowExecution | null;
  /** Callback to submit answers */
  onSubmit: (answers: Record<string, string>) => Promise<void>;
}

/**
 * Drawer for answering workflow questions
 */
export function QuestionDrawer({
  open,
  onOpenChange,
  execution,
  onSubmit,
}: QuestionDrawerProps) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [followUp, setFollowUp] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const questions = execution?.output?.questions ?? [];
  const hasQuestions = questions.length > 0;

  // Reset answers when drawer opens with new questions
  React.useEffect(() => {
    if (open && hasQuestions) {
      setAnswers({});
      setFollowUp('');
    }
  }, [open, execution?.id, hasQuestions]);

  // Handle answer change for radio/text
  const handleAnswerChange = (questionIndex: number, value: string) => {
    const question = questions[questionIndex];
    const key = question?.header || `q${questionIndex}`;
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Handle multi-select change
  const handleMultiSelectChange = (
    questionIndex: number,
    option: string,
    checked: boolean
  ) => {
    const question = questions[questionIndex];
    const key = question?.header || `q${questionIndex}`;
    const current = answers[key] ? answers[key].split(',').filter(Boolean) : [];

    let updated: string[];
    if (checked) {
      updated = [...current, option];
    } else {
      updated = current.filter((o) => o !== option);
    }

    setAnswers((prev) => ({ ...prev, [key]: updated.join(',') }));
  };

  // Check if all questions are answered
  const allQuestionsAnswered = () => {
    return questions.every((q, i) => {
      const key = q.header || `q${i}`;
      return answers[key] && answers[key].length > 0;
    });
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!allQuestionsAnswered()) return;

    setIsSubmitting(true);
    try {
      const finalAnswers = { ...answers };
      if (followUp.trim()) {
        finalAnswers['_followup'] = followUp.trim();
      }
      await onSubmit(finalAnswers);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = allQuestionsAnswered() && !isSubmitting;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-yellow-500" />
            Questions
          </SheetTitle>
          <SheetDescription>
            Answer the questions below to continue the workflow.
          </SheetDescription>
        </SheetHeader>

        {/* Questions area */}
        <div className="flex-1 mt-4 -mx-6 px-6 overflow-y-auto">
          {!hasQuestions ? (
            <div className="text-neutral-500 dark:text-neutral-400 text-sm">
              No questions pending.
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4"
                >
                  {/* Question header badges */}
                  <div className="flex items-center gap-2 mb-2">
                    {q.header && (
                      <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 text-xs px-2 py-0.5 rounded font-medium">
                        {q.header}
                      </span>
                    )}
                    {q.multiSelect && (
                      <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 text-xs px-2 py-0.5 rounded">
                        Multi-select
                      </span>
                    )}
                  </div>

                  {/* Question text */}
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-3">
                    {q.question}
                  </p>

                  {/* Options or text input */}
                  {q.options && q.options.length > 0 ? (
                    <div className="space-y-2">
                      {q.options.map((opt, j) => (
                        <label
                          key={j}
                          className={cn(
                            'flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors',
                            'bg-white dark:bg-neutral-800',
                            'hover:bg-neutral-100 dark:hover:bg-neutral-700',
                            'border border-neutral-200 dark:border-neutral-700'
                          )}
                        >
                          {q.multiSelect ? (
                            <input
                              type="checkbox"
                              checked={(answers[q.header || `q${i}`] || '')
                                .split(',')
                                .includes(opt.label)}
                              onChange={(e) =>
                                handleMultiSelectChange(i, opt.label, e.target.checked)
                              }
                              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                            />
                          ) : (
                            <input
                              type="radio"
                              name={`q${i}`}
                              value={opt.label}
                              checked={answers[q.header || `q${i}`] === opt.label}
                              onChange={() => handleAnswerChange(i, opt.label)}
                              className="mt-0.5 h-4 w-4 border-neutral-300 text-blue-600 focus:ring-blue-500"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {opt.label}
                            </div>
                            {opt.description && (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {opt.description}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={answers[q.header || `q${i}`] || ''}
                      onChange={(e) => handleAnswerChange(i, e.target.value)}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-sm',
                        'bg-white dark:bg-neutral-800',
                        'border-neutral-200 dark:border-neutral-700',
                        'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500'
                      )}
                      placeholder="Type your answer..."
                      rows={3}
                    />
                  )}
                </div>
              ))}

              {/* Follow-up input */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                  Follow-up message (optional)
                </label>
                <textarea
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-sm',
                    'bg-white dark:bg-neutral-800',
                    'border-neutral-200 dark:border-neutral-700',
                    'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                  placeholder="Add clarification or additional context..."
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer with submit button */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
