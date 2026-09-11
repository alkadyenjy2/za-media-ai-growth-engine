-- P0-10: canonical ZA Media service catalog.
-- The catalog uses verified historical ZA Media public service descriptions plus
-- the current internal AI-growth direction. No pricing is fabricated.

insert into public.products (name, category, description, features, is_active)
select v.name, v.category, v.description, v.features, true
from (values
  ('Marketing Strategy & Planning', 'Growth Strategy',
   'Marketing strategy, market/competitor analysis, positioning, and campaign planning.',
   array['strategy','market research','competitor analysis','marketing plan','positioning']::text[]),
  ('Social Media Management', 'Content & Social',
   'Social media management, content planning, publishing, and community-facing execution.',
   array['social media','page management','content planning','community management']::text[]),
  ('Content & Creative Design', 'Content & Social',
   'Advertising content, creative design, campaign assets, and visual communication.',
   array['content','copywriting','design','creative assets','campaign content']::text[]),
  ('Branding & Brand Identity', 'Branding',
   'Brand identity and positioning work designed to strengthen differentiation and customer trust.',
   array['branding','brand identity','positioning','visual identity','brand trust']::text[]),
  ('Paid Advertising', 'Paid Advertising',
   'Paid advertising and promotional campaign planning focused on reaching relevant audiences.',
   array['advertising','paid media','promotion','audience targeting','campaigns']::text[]),
  ('Promotion & Campaigns', 'Promotion',
   'Promotional campaigns and integrated marketing execution for products and services.',
   array['promotion','campaign execution','product promotion','integrated marketing']::text[]),
  ('AI Growth & Automation', 'AI Automation',
   'Internal AI-powered growth and automation capability for lead intelligence, qualification, follow-up, and growth operations.',
   array['AI automation','lead intelligence','lead qualification','follow-up automation','growth operations']::text[])
) as v(name, category, description, features)
where not exists (
  select 1 from public.products p where lower(p.name) = lower(v.name)
);
