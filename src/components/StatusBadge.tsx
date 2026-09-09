import type { LeadStatus } from '../types/database'

const labels: Record<LeadStatus, string> = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', appointment: 'Appointment', won: 'Won', lost: 'Lost' }
const classes: Record<LeadStatus, string> = { new: 'badge-primary', contacted: 'badge-neutral', qualified: 'badge-success', appointment: 'badge-warning', won: 'badge-success', lost: 'badge-error' }

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={classes[status]}>{labels[status]}</span>
}
