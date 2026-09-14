export type DemoLeadInput = { full_name: string; email: string; company?: string }
export type DemoQualification = { priority: 'High' | 'Medium' | 'Low'; leadType: string; nextAction: string }

export function qualifyDemoLead(input: DemoLeadInput): DemoQualification {
  const hasCompany = Boolean(input.company?.trim())
  const hasWorkEmail = /@[^@\s]+\.[^@\s]+$/.test(input.email.trim())
  if (hasCompany && hasWorkEmail) return { priority: 'High', leadType: 'Growth planning request', nextAction: 'Review the request and prepare a tailored growth plan.' }
  if (hasWorkEmail) return { priority: 'Medium', leadType: 'Marketing planning request', nextAction: 'Review the request and confirm the primary growth priority.' }
  return { priority: 'Low', leadType: 'Early-stage request', nextAction: 'Review the request and collect the missing business context.' }
}
