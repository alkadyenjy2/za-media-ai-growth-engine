create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  connection_type text not null check (connection_type in ('meta_business','facebook_page','instagram_business')),
  display_name text not null,
  status text not null default 'pending' check (status in ('pending','connected','expired','revoked','error')),
  meta_business_id text,
  page_id text,
  instagram_account_id text,
  scopes text[] not null default '{}',
  token_secret_name text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta_prospect_targets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.meta_connections(id) on delete cascade,
  prospect_id uuid references public.prospect_profiles(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram')),
  external_id text,
  profile_url text,
  discovery_method text not null default 'manual' check (discovery_method in ('manual','api','website_referral','authorized_search')),
  match_confidence numeric(5,4) not null default 0 check (match_confidence between 0 and 1),
  status text not null default 'candidate' check (status in ('candidate','matched','rejected','suppressed')),
  evidence jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id, platform, external_id)
);

create index if not exists idx_meta_connections_status on public.meta_connections(status);
create index if not exists idx_meta_targets_prospect on public.meta_prospect_targets(prospect_id);
create index if not exists idx_meta_targets_platform on public.meta_prospect_targets(platform);

alter table public.meta_connections enable row level security;
alter table public.meta_prospect_targets enable row level security;

create policy "meta connections shared workspace read" on public.meta_connections for select to anon, authenticated using (true);
create policy "meta connections shared workspace insert" on public.meta_connections for insert to anon, authenticated with check (true);
create policy "meta connections shared workspace update" on public.meta_connections for update to anon, authenticated using (true) with check (true);
create policy "meta targets shared workspace read" on public.meta_prospect_targets for select to anon, authenticated using (true);
create policy "meta targets shared workspace insert" on public.meta_prospect_targets for insert to anon, authenticated with check (true);
create policy "meta targets shared workspace update" on public.meta_prospect_targets for update to anon, authenticated using (true) with check (true);

comment on table public.meta_connections is 'Metadata for governed Meta/Facebook/Instagram OAuth connections. Access tokens are never stored in this table; token_secret_name points to a server-side secret.';
comment on table public.meta_prospect_targets is 'Candidate/matched Facebook and Instagram prospect targets discovered through authorized or explicit sources.';
