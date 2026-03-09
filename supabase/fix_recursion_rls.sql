-- 1. Create security functions to break recursion
CREATE OR REPLACE FUNCTION public.check_is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = _trip_id AND user_id = _user_id
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = _trip_id AND user_id = _user_id AND status = 'accepted'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_is_trip_editor(_trip_id uuid, _user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = _trip_id AND user_id = _user_id AND status = 'accepted' AND role IN ('owner', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Update Trips Policies
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
CREATE POLICY "Users can view trips they own or are members of." ON public.trips
  FOR SELECT USING (
    auth.uid() = user_id OR public.check_is_trip_member(id, auth.uid())
  );

-- 3. Update Trip Members Policies
DROP POLICY IF EXISTS "Users can see members of trips they belong to" ON public.trip_members;
CREATE POLICY "Users can see members of trips they belong to" ON public.trip_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    invited_email = (auth.jwt() ->> 'email') OR
    public.check_is_trip_owner(trip_id, auth.uid()) OR
    public.check_is_trip_member(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners can manage members" ON public.trip_members;
CREATE POLICY "Owners can manage members" ON public.trip_members
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid())
  );

-- 4. Update Trip Shares Policies
DROP POLICY IF EXISTS "Owners can manage share links" ON public.trip_shares;
CREATE POLICY "Owners can manage share links" ON public.trip_shares
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid())
  );

-- 5. Update Plans Policies
DROP POLICY IF EXISTS "Users with edit permission can manage plans" ON public.plans;
CREATE POLICY "Users with edit permission can manage plans" ON public.plans
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_editor(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Viewers can select plans" ON public.plans;
CREATE POLICY "Viewers can select plans" ON public.plans
  FOR SELECT USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_member(trip_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.trip_shares WHERE trip_id = public.plans.trip_id AND share_type = 'public')
  );

-- 6. Update Checklists Policies
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
CREATE POLICY "Users with edit permission can manage checklists" ON public.checklists
  FOR ALL USING (
    public.check_is_trip_owner(trip_id, auth.uid()) OR 
    public.check_is_trip_editor(trip_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
CREATE POLICY "Users with edit permission can manage checklist items" ON public.checklist_items
  FOR ALL USING (
    checklist_id IN (
      SELECT id FROM public.checklists 
      WHERE public.check_is_trip_owner(trip_id, auth.uid()) OR public.check_is_trip_editor(trip_id, auth.uid())
    )
  );
