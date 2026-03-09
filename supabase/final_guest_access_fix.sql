-- Final RLS fix for trips and shares to ensure guest access
-- 1. Ensure trip_shares is truly public for SELECT
DROP POLICY IF EXISTS "Anyone can select share link by token" ON public.trip_shares;
CREATE POLICY "Public select trip_shares" ON public.trip_shares
  FOR SELECT USING (true);

-- 2. Ensure trips is readable if a public share link exists
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
CREATE POLICY "Public select trips if shared" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares ts WHERE ts.trip_id = id AND ts.share_type = 'public')
  );

-- 3. Ensure plans are also readable
DROP POLICY IF EXISTS "Viewers can select plans" ON public.plans;
CREATE POLICY "Public select plans if shared" ON public.plans
  FOR SELECT USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_member(trip_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares ts WHERE ts.trip_id = trip_id AND ts.share_type = 'public')
  );
