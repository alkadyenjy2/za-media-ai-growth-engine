import { describe, expect, it } from 'vitest';
import { MARKETING_SKILLS } from './marketingSkills';

describe('Marketing Skills Registry', () => {
  it('registers the approved ZA Media marketing skills', () => {
    const expected = [
      'product-marketing',
      'copywriting',
      'copy-editing',
      'cro',
      'seo-audit',
      'ai-seo',
      'content-strategy',
      'social',
      'emails',
      'cold-email',
      'prospecting',
      'revops',
      'sales-enablement',
      'analytics',
      'competitor-profiling',
      'offers',
      'pricing',
      'marketing-loops',
    ];

    expect(Object.keys(MARKETING_SKILLS)).toEqual(expect.arrayContaining(expected));
    expect(Object.keys(MARKETING_SKILLS)).toHaveLength(expected.length);
  });
});
