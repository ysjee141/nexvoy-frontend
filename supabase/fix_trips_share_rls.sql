-- Allow anyone to select trip basic info if a public share link exists
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
CREATE POLICY "Users can view trips via owner, member or public share" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares WHERE trip_id = public.trips.id AND share_type = 'public')
  );
