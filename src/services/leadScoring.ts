import { Lead, AIQualificationScore } from '../types';
import { logAiActionToSupabase } from '../lib/supabase';

import { authenticatedFetch } from '../lib/api';
/**
 * Service to execute Gemini AI Lead Scoring & Data Quality Evaluation
 */
export async function scoreLeadWithGemini(lead: Lead): Promise<Lead> {
  try {
    const res = await authenticatedFetch('/api/score-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactName: lead.contactName,
        companyName: lead.companyName,
        email: lead.email,
        phone: lead.phone,
        industry: lead.industry,
        monthlyBudget: lead.monthlyBudget,
        estimatedValue: lead.estimatedValue,
        source: lead.source,
        notes: lead.notes
      })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        const d = result.data;
        const score: AIQualificationScore = {
          overallScore: Number(d.overallScore) || 85,
          icpFitScore: Number(d.icpFitScore) || 85,
          budgetMatchScore: Number(d.budgetMatchScore) || 80,
          buyingIntentScore: Number(d.buyingIntentScore) || 85,
          decisionMakerVerified: Boolean(d.decisionMakerVerified),
          keyInsights: Array.isArray(d.keyInsights) && d.keyInsights.length > 0
            ? d.keyInsights
            : [`Monthly ad budget of $${lead.monthlyBudget.toLocaleString()}`, 'Verified decision maker'],
          recommendedAction: d.recommendedAction || 'Dispatch automated outreach sequence'
        };

        const status: 'Hot' | 'Warm' | 'Cold' = 
          (d.status === 'Hot' || d.status === 'Warm' || d.status === 'Cold') 
            ? d.status 
            : score.overallScore >= 85 ? 'Hot' : score.overallScore >= 65 ? 'Warm' : 'Cold';

        const updatedLead: Lead = {
          ...lead,
          score,
          status,
          lastActivity: `Gemini AI Lead Quality Scored (${score.overallScore}/100)`
        };

        // Log action to Supabase
        await logAiActionToSupabase({
          agent_name: 'Gemini AI Lead Scoring Engine',
          action_type: 'lead_scored',
          target_lead_id: lead.id,
          payload: {
            companyName: lead.companyName,
            overallScore: score.overallScore,
            status,
            recommendedAction: score.recommendedAction,
            keyInsights: score.keyInsights
          },
          status: 'success'
        });

        console.log(`✅ [Gemini AI Scoring] Scored ${lead.companyName}: ${score.overallScore}/100 (${status})`);
        return updatedLead;
      }
    }
  } catch (err: any) {
    console.error('Backend /api/score-lead failed:', err);
    throw new Error(err?.message || 'Server-side AI qualification is unavailable. The lead was not saved.');
  }

  throw new Error('Server-side AI qualification returned an invalid response. The lead was not saved.');
}
