import { Lead, RevenueMetrics, ActivityLog } from '../types';
import { 
  fetchAuditLogsFromSupabase, 
  insertAuditLogToSupabase,
  fetchIncomeRecordsFromSupabase 
} from '../lib/supabase';

/**
 * Service Layer for Dashboard Metrics & Live Database Analytics
 */

export function calculateRevenueMetrics(leads: Lead[], incomeRecords?: any[]): RevenueMetrics {
  const totalPipelineValue = leads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
  
  // MRR Projected = monthly budget sum for leads in active/qualified stages
  const activeStages = ['qualified', 'discovery', 'proposal', 'closed_won'];
  const mrrProjected = leads
    .filter(lead => activeStages.includes(lead.stage))
    .reduce((sum, lead) => sum + (lead.monthlyBudget || 0), 0);

  // Closed Revenue MTD = sum of estimated values for closed_won leads (or from income records if available)
  const closedWonLeadsSum = leads
    .filter(lead => lead.stage === 'closed_won')
    .reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);

  // Calculate sum from income_records table joined with leads
  let incomeRecordsSum = 0;
  let paidLeadCountFromIncome = 0;

  if (incomeRecords && Array.isArray(incomeRecords)) {
    incomeRecords.forEach(record => {
      const amount = Number(record.amount) || 0;
      if (record.status === 'paid' || !record.status) {
        incomeRecordsSum += amount;
        paidLeadCountFromIncome += 1;
      }
    });
  }

  const closedRevenueMtd = Math.max(closedWonLeadsSum, incomeRecordsSum);

  const totalCount = leads.length;
  const closedWonCount = Math.max(
    leads.filter(lead => lead.stage === 'closed_won').length,
    paidLeadCountFromIncome
  );
  
  // Dynamic conversion rate calculated from actual closed revenue / leads
  const conversionRatePercent = totalCount > 0 ? parseFloat(((closedWonCount / totalCount) * 100).toFixed(1)) : 0;
  const avgDealSize = totalCount > 0 ? Math.round(totalPipelineValue / totalCount) : 0;

  return {
    totalPipelineValue,
    mrrProjected,
    closedRevenueMtd,
    conversionRatePercent,
    avgDealSize,
    avgQualificationSpeedSec: 1.4
  };
}

export async function getActivityLogs(): Promise<ActivityLog[] | null> {
  return await fetchAuditLogsFromSupabase();
}

export async function logActivity(
  title: string, 
  description: string, 
  type: string = 'qualification',
  leadName?: string,
  status?: string
) {
  await insertAuditLogToSupabase({ title, description, type, leadName, status });
}

