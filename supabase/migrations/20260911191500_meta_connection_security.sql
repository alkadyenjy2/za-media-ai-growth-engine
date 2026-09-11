revoke all on table public.meta_connections from anon, authenticated;
revoke all on table public.meta_prospect_targets from anon, authenticated;

create policy "meta connections authenticated read" on public.meta_connections for select to authenticated using (true);
create policy "meta targets authenticated read" on public.meta_prospect_targets for select to authenticated using (true);

comment on table public.meta_connections is 'Sensitive Meta connection metadata. No access token is stored here; provider tokens belong in server-side secrets/Vault.';
