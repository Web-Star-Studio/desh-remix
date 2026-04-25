
-- api_cache table for server-side caching in composio-proxy
CREATE TABLE IF NOT EXISTS public.api_cache (
  cache_key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON public.api_cache(expires_at);

-- No RLS needed — this table is only accessed by service_role from edge functions
ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;
