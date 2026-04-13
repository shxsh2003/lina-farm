-- Facebook Page connections (per owner)
CREATE TABLE IF NOT EXISTS public.facebook_page_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL DEFAULT '',
  page_access_token TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS facebook_page_connections_user_id_idx
  ON public.facebook_page_connections(user_id);

ALTER TABLE public.facebook_page_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facebook pages"
  ON public.facebook_page_connections
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own facebook pages"
  ON public.facebook_page_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own facebook pages"
  ON public.facebook_page_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own facebook pages"
  ON public.facebook_page_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Facebook messages (inbound + outbound)
CREATE TABLE IF NOT EXISTS public.facebook_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  sender_psid TEXT NOT NULL,
  message_text TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB
);

CREATE INDEX IF NOT EXISTS facebook_messages_user_id_idx
  ON public.facebook_messages(user_id);

CREATE INDEX IF NOT EXISTS facebook_messages_page_id_idx
  ON public.facebook_messages(page_id);

ALTER TABLE public.facebook_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facebook messages"
  ON public.facebook_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own facebook messages"
  ON public.facebook_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own facebook messages"
  ON public.facebook_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own facebook messages"
  ON public.facebook_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_facebook_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_facebook_page_connections_updated_at ON public.facebook_page_connections;

CREATE TRIGGER trg_facebook_page_connections_updated_at
BEFORE UPDATE ON public.facebook_page_connections
FOR EACH ROW EXECUTE FUNCTION public.update_facebook_connections_updated_at();
