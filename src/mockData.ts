import { Lead, RevenueMetrics, ActivityLog, StoryItem } from './types';

export const INITIAL_REVENUE_METRICS: RevenueMetrics = {
  totalPipelineValue: 0,
  mrrProjected: 0,
  closedRevenueMtd: 0,
  conversionRatePercent: 0,
  avgDealSize: 0,
  avgQualificationSpeedSec: 0,
};

export const INITIAL_STORIES: StoryItem[] = [];
export const INITIAL_LEADS: Lead[] = [];
export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];
