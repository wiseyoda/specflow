import { toast } from "sonner"

/**
 * Show a success toast for completed command
 */
export function toastCommandSuccess(command: string, message?: string) {
  toast.success(message ?? `Command completed: ${command}`, {
    description: command,
    duration: 3000,
  })
}

/**
 * Show an error toast for failed command
 */
export function toastCommandError(
  command: string,
  error: string,
  onViewDetails?: () => void
) {
  toast.error(`Command failed: ${command}`, {
    description: error.slice(0, 100) + (error.length > 100 ? "..." : ""),
    duration: 10000,
    action: onViewDetails
      ? {
          label: "View Details",
          onClick: onViewDetails,
        }
      : undefined,
  })
}

/**
 * Show an info toast for command started
 */
export function toastCommandStarted(command: string) {
  toast.info(`Running: ${command}`, {
    description: "Command output will appear in the drawer",
    duration: 2000,
  })
}

/**
 * Show a warning toast
 */
export function toastWarning(title: string, description?: string) {
  toast.warning(title, {
    description,
    duration: 5000,
  })
}

/**
 * Show a generic error toast
 */
export function toastError(title: string, description?: string) {
  toast.error(title, {
    description,
    duration: 5000,
  })
}

/**
 * Show a workflow started toast
 */
export function toastWorkflowStarted(skill: string) {
  toast.success(`Workflow started: ${skill}`, {
    description: "The workflow is now running",
    duration: 3000,
  })
}

/**
 * Show a workflow error toast
 */
export function toastWorkflowError(error: string) {
  toast.error("Workflow failed", {
    description: error.slice(0, 150) + (error.length > 150 ? "..." : ""),
    duration: 8000,
  })
}

/**
 * Show a workflow already running toast
 */
export function toastWorkflowAlreadyRunning() {
  toast.warning("Workflow already running", {
    description: "Please wait for the current workflow to complete or cancel it",
    duration: 5000,
  })
}

/**
 * Show a workflow cancelled toast
 */
export function toastWorkflowCancelled() {
  toast.info("Workflow cancelled", {
    description: "The workflow has been stopped",
    duration: 3000,
  })
}
