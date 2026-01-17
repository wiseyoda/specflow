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
