import { qualifyDemoLead } from '../src/lib/demoQualification'

const result = qualifyDemoLead({ full_name: 'Test User', email: 'test@example.com', company: 'Acme' })
if (result.priority !== 'High') throw new Error(`Expected High, got ${result.priority}`)
if (!result.nextAction) throw new Error('Expected recommended next action')
console.log('demo qualification test passed')
