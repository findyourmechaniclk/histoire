import type { RuntimeStatus } from '../protocol.js'

/** Headline shared by server-rendered startup page and live status updates. */
export function statusTitle(status: RuntimeStatus): string {
  switch (status) {
    case 'failed': return 'Failed to start'
    case 'restarting': return 'Restarting'
    case 'closed': return 'Stopped'
    default: return 'Starting'
  }
}
