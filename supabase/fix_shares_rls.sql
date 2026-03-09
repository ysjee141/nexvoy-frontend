-- Add missing RLS policies for trip_shares
CREATE POLICY "Owners can manage share links" ON public.trip_shares
  FOR ALL USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

-- Allow anyone to select share links by token (for public/password access)
CREATE POLICY "Anyone can select share link by token" ON public.trip_shares
  FOR SELECT USING (true);
