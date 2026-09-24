-- Reconcile the live revenue-loop idempotency hardening with the repository migration history.
alter table public.leads
  add column if not exists idempotency_key text;

create unique index if not exists leads_workspace_id_idempotency_key_uq
  on public.leads (workspace_id, idempotency_key)
  where idempotency_key is not null;
