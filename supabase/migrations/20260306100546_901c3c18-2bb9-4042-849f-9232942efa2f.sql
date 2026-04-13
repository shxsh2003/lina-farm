-- Drop and recreate to ensure they're correct
DROP TRIGGER IF EXISTS trg_inventory_production ON public.production_log_items;
DROP TRIGGER IF EXISTS trg_inventory_orders ON public.order_items;

CREATE TRIGGER trg_inventory_production
AFTER INSERT OR UPDATE OR DELETE ON public.production_log_items
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_inventory_from_production();

CREATE TRIGGER trg_inventory_orders
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_inventory_from_orders();