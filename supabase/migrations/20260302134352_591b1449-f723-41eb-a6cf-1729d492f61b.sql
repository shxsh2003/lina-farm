
-- Create production_log_items for per-size tray tracking
CREATE TABLE public.production_log_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_log_id UUID NOT NULL REFERENCES public.production_logs(id) ON DELETE CASCADE,
  egg_size TEXT NOT NULL DEFAULT 'medium',
  trays_collected INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.production_log_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view production log items"
ON public.production_log_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert production log items"
ON public.production_log_items FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update production log items"
ON public.production_log_items FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete production log items"
ON public.production_log_items FOR DELETE
USING (auth.uid() IS NOT NULL);
