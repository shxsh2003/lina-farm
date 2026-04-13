
-- Inventory table: tracks available stock per egg size
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  egg_size text NOT NULL UNIQUE,
  total_produced integer NOT NULL DEFAULT 0,
  total_sold integer NOT NULL DEFAULT 0,
  available_stock integer NOT NULL DEFAULT 0,
  last_updated timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed with all egg sizes
INSERT INTO public.inventory (egg_size) VALUES
  ('pewee'), ('pullets'), ('small'), ('medium'), ('large'), ('extra_large'), ('jumbo');

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory" ON public.inventory
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update inventory" ON public.inventory
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Function: recalculate inventory for a given egg size
CREATE OR REPLACE FUNCTION public.recalculate_inventory(p_egg_size text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_produced integer;
  v_sold integer;
BEGIN
  SELECT COALESCE(SUM(trays_collected), 0) INTO v_produced
  FROM public.production_log_items WHERE egg_size = p_egg_size;

  SELECT COALESCE(SUM(quantity), 0) INTO v_sold
  FROM public.order_items WHERE egg_size = p_egg_size;

  UPDATE public.inventory
  SET total_produced = v_produced,
      total_sold = v_sold,
      available_stock = v_produced - v_sold,
      last_updated = now()
  WHERE egg_size = p_egg_size;
END;
$$;

-- Trigger function for production_log_items changes
CREATE OR REPLACE FUNCTION public.trigger_update_inventory_from_production()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_inventory(OLD.egg_size);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_inventory(NEW.egg_size);
    IF TG_OP = 'UPDATE' AND OLD.egg_size != NEW.egg_size THEN
      PERFORM public.recalculate_inventory(OLD.egg_size);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger function for order_items changes
CREATE OR REPLACE FUNCTION public.trigger_update_inventory_from_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_inventory(OLD.egg_size);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_inventory(NEW.egg_size);
    IF TG_OP = 'UPDATE' AND OLD.egg_size != NEW.egg_size THEN
      PERFORM public.recalculate_inventory(OLD.egg_size);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

-- Attach triggers
CREATE TRIGGER trg_inventory_production
  AFTER INSERT OR UPDATE OR DELETE ON public.production_log_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_inventory_from_production();

CREATE TRIGGER trg_inventory_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_update_inventory_from_orders();
