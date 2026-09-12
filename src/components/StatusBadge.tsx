import type { LeadStatus } from '../types/database'

const labels: Record<LeadStatus, string> = { Hot: 'Hot', Warm: 'Warm', Cold: 'Cold' }
const classes: Record<LeadStatus, string> = { Hot: 'badge-error', Warm: 'badge-warning', Cold: 'badge-neutral' }

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={classes[status]}>{labels[status]}</span>
}
