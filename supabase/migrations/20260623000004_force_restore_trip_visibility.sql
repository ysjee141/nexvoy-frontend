-- Force restore production visibility for existing trips/checklists.
-- This intentionally resets only access policies touched by checklist alignment.

CREATE TABLE IF NOT EXISTS public.checklist_item_assignees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid REFERENCES public.checklist_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(item_id, user_id)
);

ALTER TABLE public.checklist_item_assignees ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trips
    WHERE id = _trip_id
      AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _trip_id
      AND user_id = _user_id
      AND status = 'accepted'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_trip_editor(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_members
    WHERE trip_id = _trip_id
      AND user_id = _user_id
      AND status = 'accepted'
      AND role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_public_trip(_trip_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_shares
    WHERE trip_id = _trip_id
      AND share_type = 'public'
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_is_trip_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_trip_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_trip_editor(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_public_trip(uuid) TO anon, authenticated;

-- Trips ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own trips." ON public.trips;
DROP POLICY IF EXISTS "Users can view trips they own or are members of." ON public.trips;
DROP POLICY IF EXISTS "Users can view trips via owner, member or public share" ON public.trips;
DROP POLICY IF EXISTS "Public select trips if shared" ON public.trips;
DROP POLICY IF EXISTS "Access trips by owner, member, or public share" ON public.trips;

CREATE POLICY "Access trips by owner, member, or public share"
  ON public.trips
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.check_is_trip_member(id, auth.uid())
    OR public.check_is_public_trip(id)
  );

-- Trip members ---------------------------------------------------------------
DROP POLICY IF EXISTS "Users can see members of trips they belong to" ON public.trip_members;
DROP POLICY IF EXISTS "Select members if related" ON public.trip_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.trip_members;
DROP POLICY IF EXISTS "Manage members as owner" ON public.trip_members;
DROP POLICY IF EXISTS "Invited users can accept invitations" ON public.trip_members;

CREATE POLICY "Select members if related"
  ON public.trip_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR invited_email = (auth.jwt() ->> 'email')
    OR public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
  );

CREATE POLICY "Manage members as owner"
  ON public.trip_members
  FOR ALL
  USING (public.check_is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (public.check_is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "Invited users can accept invitations"
  ON public.trip_members
  FOR UPDATE
  USING (
    invited_email = (auth.jwt() ->> 'email')
    AND status = 'pending'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'accepted'
  );

-- Trip shares ----------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can select share link by token" ON public.trip_shares;
DROP POLICY IF EXISTS "Public select trip_shares" ON public.trip_shares;
DROP POLICY IF EXISTS "Public select shares" ON public.trip_shares;
DROP POLICY IF EXISTS "Owners can manage share links" ON public.trip_shares;
DROP POLICY IF EXISTS "Manage shares as owner" ON public.trip_shares;

CREATE POLICY "Public select shares"
  ON public.trip_shares
  FOR SELECT
  USING (true);

CREATE POLICY "Manage shares as owner"
  ON public.trip_shares
  FOR ALL
  USING (public.check_is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (public.check_is_trip_owner(trip_id, auth.uid()));

-- Checklists -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklists for their trips" ON public.checklists;
DROP POLICY IF EXISTS "Users with edit permission can manage checklists" ON public.checklists;
DROP POLICY IF EXISTS "Select checklists if shared or related" ON public.checklists;
DROP POLICY IF EXISTS "Manage checklists if editor or owner" ON public.checklists;

CREATE POLICY "Select checklists if shared or related"
  ON public.checklists
  FOR SELECT
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_member(trip_id, auth.uid())
    OR public.check_is_public_trip(trip_id)
  );

CREATE POLICY "Manage checklists if editor or owner"
  ON public.checklists
  FOR ALL
  USING (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  )
  WITH CHECK (
    public.check_is_trip_owner(trip_id, auth.uid())
    OR public.check_is_trip_editor(trip_id, auth.uid())
  );

-- Checklist items ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage checklist items for their trips" ON public.checklist_items;
DROP POLICY IF EXISTS "Users with edit permission can manage checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Select checklist items if shared or related" ON public.checklist_items;
DROP POLICY IF EXISTS "Manage checklist items if editor or owner" ON public.checklist_items;

CREATE POLICY "Select checklist items if shared or related"
  ON public.checklist_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_member(c.trip_id, auth.uid())
          OR public.check_is_public_trip(c.trip_id)
        )
    )
    AND (
      COALESCE(is_private, false) = false
      OR assigned_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.checklist_item_assignees a
        WHERE a.item_id = public.checklist_items.id
          AND a.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Manage checklist items if editor or owner"
  ON public.checklist_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = public.checklist_items.checklist_id
        AND (
          public.check_is_trip_owner(c.trip_id, auth.uid())
          OR public.check_is_trip_editor(c.trip_id, auth.uid())
        )
    )
  );
