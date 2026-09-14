export type ZaAnalyticsEvent = 'demo_open' | 'demo_step_completed' | 'form_started' | 'form_submitted'

export function trackZaEvent(event: ZaAnalyticsEvent) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('za-analytics', { detail: { event } }))
}
