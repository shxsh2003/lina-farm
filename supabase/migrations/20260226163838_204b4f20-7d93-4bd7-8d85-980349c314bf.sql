
-- Create egg size enum
CREATE TYPE public.egg_size AS ENUM ('pewee', 'pullets', 'small', 'medium', 'large', 'extra_large', 'jumbo');

-- Pricing sets table (one active at a time)
CREATE TABLE public.pricing_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  wholesale_discount NUMERIC NOT NULL DEFAULT 20,
  wholesale_min_trays INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.pricing_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing sets" ON public.pricing_sets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert pricing sets" ON public.pricing_sets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update pricing sets" ON public.pricing_sets FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete pricing sets" ON public.pricing_sets FOR DELETE USING (auth.uid() IS NOT NULL);

-- Pricing set items (price per tray per size)
CREATE TABLE public.pricing_set_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pricing_set_id UUID NOT NULL REFERENCES public.pricing_sets(id) ON DELETE CASCADE,
  egg_size egg_size NOT NULL,
  price_per_tray NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(pricing_set_id, egg_size)
);

ALTER TABLE public.pricing_set_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricing items" ON public.pricing_set_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert pricing items" ON public.pricing_set_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update pricing items" ON public.pricing_set_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete pricing items" ON public.pricing_set_items FOR DELETE USING (auth.uid() IS NOT NULL);

-- Add delivery_method and payment_status to orders
ALTER TABLE public.orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'pickup';
ALTER TABLE public.orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';

-- Add egg_size to order_items
ALTER TABLE public.order_items ADD COLUMN egg_size TEXT NOT NULL DEFAULT 'medium';

-- Trigger to update pricing_sets.updated_at
CREATE OR REPLACE FUNCTION public.update_pricing_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pricing_sets_updated_at
  BEFORE UPDATE ON public.pricing_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pricing_set_timestamp();

-- Function to ensure only one pricing set is active
CREATE OR REPLACE FUNCTION public.ensure_single_active_pricing()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE public.pricing_sets SET is_active = false WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ensure_single_active_pricing
  BEFORE INSERT OR UPDATE ON public.pricing_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_active_pricing();

-- Drop old tables we no longer need
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.pricing_rules CASCADE;
