export type MarketingSkill = {
  id: string;
  name: string;
  category: string;
};

export const MARKETING_SKILLS: Record<string, MarketingSkill> = {
  'product-marketing': { id: 'product-marketing', name: 'Product Marketing', category: 'strategy' },
  copywriting: { id: 'copywriting', name: 'Copywriting', category: 'content' },
  'copy-editing': { id: 'copy-editing', name: 'Copy Editing', category: 'content' },
  cro: { id: 'cro', name: 'Conversion Rate Optimization', category: 'conversion' },
  'seo-audit': { id: 'seo-audit', name: 'SEO Audit', category: 'seo' },
  'ai-seo': { id: 'ai-seo', name: 'AI SEO', category: 'seo' },
  'content-strategy': { id: 'content-strategy', name: 'Content Strategy', category: 'content' },
  social: { id: 'social', name: 'Social Media', category: 'social' },
  emails: { id: 'emails', name: 'Email Marketing', category: 'lifecycle' },
  'cold-email': { id: 'cold-email', name: 'Cold Email', category: 'outreach' },
  prospecting: { id: 'prospecting', name: 'Prospecting', category: 'outreach' },
  revops: { id: 'revops', name: 'Revenue Operations', category: 'sales' },
  'sales-enablement': { id: 'sales-enablement', name: 'Sales Enablement', category: 'sales' },
  analytics: { id: 'analytics', name: 'Marketing Analytics', category: 'analytics' },
  'competitor-profiling': { id: 'competitor-profiling', name: 'Competitor Profiling', category: 'research' },
  offers: { id: 'offers', name: 'Offers', category: 'monetization' },
  pricing: { id: 'pricing', name: 'Pricing', category: 'monetization' },
  'marketing-loops': { id: 'marketing-loops', name: 'Marketing Loops', category: 'growth' },
};
