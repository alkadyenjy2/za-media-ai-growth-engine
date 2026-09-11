-- P0-08 Prospect Monitoring: durable review scheduling and audit trail.
create or replace function public.monitor_prospects(batch_size integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_count integer := 0;
  v_due integer := 0;
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from (
    select id
    from public.prospect_profiles
    where lifecycle_status not in ('archived','disqualified')
      and (next_review_at is null or next_review_at <= now())
    order by coalesce(next_review_at, created_at), updated_at
    limit greatest(1, least(batch_size, 100))
  ) q;

  v_due := coalesce(array_length(v_ids, 1), 0);
  if v_due = 0 then
    return jsonb_build_object('ok', true, 'due', 0, 'queued', 0, 'note', 'No prospects are due for review');
  end if;

  foreach v_id in array v_ids loop
    update public.prospect_profiles
    set next_review_at = now() + interval '1 hour', updated_at = now()
    where id = v_id;
    v_count := v_count + 1;
  end loop;

  insert into public.audit_logs(action, entity_type, entity_id, actor, details)
  select 'prospect_monitoring_scheduled', 'prospect_profile', id, 'AI Core',
         jsonb_build_object('review_reason', 'scheduled_monitoring', 'scheduled_at', now())
  from unnest(v_ids) as ids(id);

  return jsonb_build_object('ok', true, 'due', v_due, 'queued', v_count, 'next_review_window', '1 hour');
end;
$$;

grant execute on function public.monitor_prospects(integer) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('za-media-prospect-monitoring')
where exists (select 1 from cron.job where jobname = 'za-media-prospect-monitoring');

-- The scheduled job invokes the authenticated monitor Edge Function.
-- Vault must contain the project URL and publishable key under these names.
select cron.schedule(
  'za-media-prospect-monitoring',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/monitor-prospects',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
    ),
    body := '{"batch_size":10}'::jsonb
  );
  $$
);
