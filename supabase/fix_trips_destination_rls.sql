-- Create a function to check if a trip has any public share link
CREATE OR REPLACE FUNCTION public.check_is_public_trip(_trip_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_shares
    WHERE trip_id = _trip_id AND share_type = 'public'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Update trips SELECT policy
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
CREATE POLICY "Users can view trips via owner, member or public share" ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR 
    public.check_is_trip_member(id, auth.uid()) OR
    public.check_is_public_trip(id)
  );
