/**
 * Browser Notification API wrapper for workflow questions.
 */

const PERMISSION_REQUESTED_KEY = 'specflow:notificationPermissionRequested'

/**
 * Check if browser supports notifications.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Check if notifications are enabled (permission granted).
 */
export function isNotificationEnabled(): boolean {
  if (!isNotificationSupported()) return false
  return Notification.permission === 'granted'
}

/**
 * Check if we've already requested permission this session.
 */
export function hasRequestedPermission(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(PERMISSION_REQUESTED_KEY) === 'true'
}

/**
 * Request notification permission from the user.
 * Returns true if permission was granted, false otherwise.
 * Only requests once per browser (tracked in localStorage).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false
  }

  // Already granted
  if (Notification.permission === 'granted') {
    return true
  }

  // Already denied - can't re-prompt
  if (Notification.permission === 'denied') {
    return false
  }

  // Mark that we've requested
  localStorage.setItem(PERMISSION_REQUESTED_KEY, 'true')

  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    // Safari and older browsers may throw
    return false
  }
}

/**
 * Show a notification when a workflow has questions pending.
 * Only shows if window is not focused and permission is granted.
 */
export function showQuestionNotification(projectName: string): void {
  if (!isNotificationEnabled()) {
    return
  }

  // Don't show if window is focused
  if (typeof document !== 'undefined' && document.hasFocus()) {
    return
  }

  const notification = new Notification(`${projectName} Needs Your Input`, {
    body: 'Answer questions to continue workflow',
    icon: '/icon-192.png',
    tag: `specflow-question-${projectName}`,
    requireInteraction: false,
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}

/**
 * Show a notification when a workflow completes.
 */
export function showWorkflowCompleteNotification(projectName: string): void {
  if (!isNotificationEnabled()) {
    return
  }

  if (typeof document !== 'undefined' && document.hasFocus()) {
    return
  }

  const notification = new Notification(`${projectName} Workflow Complete`, {
    body: 'Your workflow has finished running',
    icon: '/icon-192.png',
    tag: `specflow-complete-${projectName}`,
    requireInteraction: false,
  })

  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
