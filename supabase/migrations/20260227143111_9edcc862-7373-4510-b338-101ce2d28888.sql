
CREATE POLICY "Authenticated users can delete orders"
ON public.orders
FOR DELETE
USING (auth.uid() IS NOT NULL);
