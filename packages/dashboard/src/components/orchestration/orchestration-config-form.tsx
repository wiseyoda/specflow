'use client';

/**
 * Orchestration Configuration Form
 *
 * Form for configuring orchestration options.
 * Includes Core Options section and collapsible Advanced Options.
 */

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { OrchestrationConfig, OrchestrationBudget } from '@specflow/shared';

// =============================================================================
// Toggle Component (Simple checkbox with label)
// =============================================================================

interface ToggleOptionProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleOption({ id, label, description, checked, onChange, disabled }: ToggleOptionProps) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-neutral-300 dark:border-neutral-600 text-purple-600 focus:ring-purple-500 dark:focus:ring-purple-400"
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {label}
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {description}
        </span>
      </div>
    </label>
  );
}

// =============================================================================
// Number Input Component
// =============================================================================

interface NumberInputProps {
  id: string;
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  disabled?: boolean;
}

function NumberInput({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  prefix,
  disabled,
}: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {prefix && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">{prefix}</span>
        )}
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-24 px-2 py-1 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
        />
      </div>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">{description}</span>
    </div>
  );
}

// =============================================================================
// Main Component Props
// =============================================================================

export interface OrchestrationConfigFormProps {
  config: OrchestrationConfig;
  onChange: (config: OrchestrationConfig) => void;
  disabled?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function OrchestrationConfigForm({
  config,
  onChange,
  disabled = false,
}: OrchestrationConfigFormProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const updateConfig = React.useCallback(
    (partial: Partial<OrchestrationConfig>) => {
      onChange({ ...config, ...partial });
    },
    [config, onChange]
  );

  const updateBudget = React.useCallback(
    (partial: Partial<OrchestrationBudget>) => {
      onChange({ ...config, budget: { ...config.budget, ...partial } });
    },
    [config, onChange]
  );

  return (
    <div className="space-y-6">
      {/* Core Options */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Core Options
        </h3>

        <ToggleOption
          id="auto-merge"
          label="Auto-merge on completion"
          description="Automatically run /flow.merge after verify succeeds"
          checked={config.autoMerge}
          onChange={(autoMerge) => updateConfig({ autoMerge })}
          disabled={disabled}
        />

        <ToggleOption
          id="skip-design"
          label="Skip design"
          description="Skip /flow.design if specs already exist"
          checked={config.skipDesign}
          onChange={(skipDesign) => updateConfig({ skipDesign })}
          disabled={disabled}
        />

        <ToggleOption
          id="skip-analyze"
          label="Skip analyze"
          description="Skip /flow.analyze step"
          checked={config.skipAnalyze}
          onChange={(skipAnalyze) => updateConfig({ skipAnalyze })}
          disabled={disabled}
        />

        {/* Additional Context */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="additional-context"
            className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
          >
            Additional context
          </label>
          <textarea
            id="additional-context"
            value={config.additionalContext}
            onChange={(e) => updateConfig({ additionalContext: e.target.value })}
            disabled={disabled}
            placeholder="(optional) Context injected into all skill prompts..."
            rows={3}
            className="px-3 py-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 resize-none"
          />
        </div>
      </div>

      {/* Advanced Options (Collapsible) */}
      <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced Options
        </button>

        {advancedOpen && (
          <div className="mt-4 space-y-4 pl-6">
            <ToggleOption
              id="auto-heal"
              label="Auto-heal enabled"
              description="Attempt automatic recovery on batch failure"
              checked={config.autoHealEnabled}
              onChange={(autoHealEnabled) => updateConfig({ autoHealEnabled })}
              disabled={disabled}
            />

            <NumberInput
              id="max-heal-attempts"
              label="Max heal attempts"
              description="Retry limit per batch (prevents infinite loops)"
              value={config.maxHealAttempts}
              onChange={(maxHealAttempts) => updateConfig({ maxHealAttempts })}
              min={0}
              max={5}
              disabled={disabled || !config.autoHealEnabled}
            />

            <NumberInput
              id="batch-size-fallback"
              label="Batch size fallback"
              description="Task count per batch if no ## sections found"
              value={config.batchSizeFallback}
              onChange={(batchSizeFallback) => updateConfig({ batchSizeFallback })}
              min={1}
              max={50}
              disabled={disabled}
            />

            <ToggleOption
              id="pause-between-batches"
              label="Pause between batches"
              description="Require user confirmation between implement batches"
              checked={config.pauseBetweenBatches}
              onChange={(pauseBetweenBatches) => updateConfig({ pauseBetweenBatches })}
              disabled={disabled}
            />

            {/* Budget Limits */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
                Budget Limits
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  id="batch-budget"
                  label="Max per batch"
                  description=""
                  value={config.budget.maxPerBatch}
                  onChange={(maxPerBatch) => updateBudget({ maxPerBatch })}
                  min={0}
                  step={0.5}
                  prefix="$"
                  disabled={disabled}
                />

                <NumberInput
                  id="total-budget"
                  label="Max total"
                  description=""
                  value={config.budget.maxTotal}
                  onChange={(maxTotal) => updateBudget({ maxTotal })}
                  min={0}
                  step={1}
                  prefix="$"
                  disabled={disabled}
                />

                <NumberInput
                  id="heal-budget"
                  label="Healing budget"
                  description=""
                  value={config.budget.healingBudget}
                  onChange={(healingBudget) => updateBudget({ healingBudget })}
                  min={0}
                  step={0.5}
                  prefix="$"
                  disabled={disabled}
                />

                <NumberInput
                  id="decision-budget"
                  label="Decision budget"
                  description=""
                  value={config.budget.decisionBudget}
                  onChange={(decisionBudget) => updateBudget({ decisionBudget })}
                  min={0}
                  step={0.1}
                  prefix="$"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
