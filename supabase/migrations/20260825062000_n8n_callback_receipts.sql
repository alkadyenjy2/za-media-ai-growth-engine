CREATE TABLE IF NOT EXISTS public.n8n_callback_receipts (
  event_id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  execution_id text,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.n8n_callback_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.n8n_callback_receipts FROM PUBLIC, anon, authenticated;
