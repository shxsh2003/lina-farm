CREATE POLICY "Authenticated users can delete order items"
ON public.order_items
FOR DELETE
USING (auth.uid() IS NOT NULL);